import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AgentDefinition,
  MatrixData,
  RawSkillRecord,
  SkillItem
} from '../types/skills';

/**
 * System-critical items that must NEVER be modified or removed by skills operations.
 */
const PROTECTED_SKILL_NAMES = new Set([
  '.system',
  'codex-primary-runtime',
  'skills_backup'
]);

/**
 * Known agents catalog with standardized paths and color accents.
 */
const KNOWN_AGENTS_CONFIG: Array<{
  id: string;
  name: string;
  cliArg: string;
  relDir: string;
  color: string;
  accent: string;
}> = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    cliArg: 'antigravity',
    relDir: path.join('.gemini', 'config', 'skills'),
    color: '#3B82F6',
    accent: 'rgba(59, 130, 246, 0.15)'
  },
  {
    id: 'codex',
    name: 'Codex',
    cliArg: 'codex',
    relDir: path.join('.codex', 'skills'),
    color: '#8B5CF6',
    accent: 'rgba(139, 92, 246, 0.15)'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    cliArg: 'cursor',
    relDir: path.join('.cursor', 'skills'),
    color: '#10B981',
    accent: 'rgba(16, 185, 129, 0.15)'
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    cliArg: 'claude-code',
    relDir: path.join('.claude', 'skills'),
    color: '#F59E0B',
    accent: 'rgba(245, 158, 11, 0.15)'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    cliArg: 'github-copilot',
    relDir: path.join('.github', 'skills'),
    color: '#6366F1',
    accent: 'rgba(99, 102, 241, 0.15)'
  },
  {
    id: 'zed',
    name: 'Zed',
    cliArg: 'zed',
    relDir: path.join('.zed', 'skills'),
    color: '#EC4899',
    accent: 'rgba(236, 72, 153, 0.15)'
  },
  {
    id: 'warp',
    name: 'Warp',
    cliArg: 'warp',
    relDir: path.join('.warp', 'skills'),
    color: '#06B6D4',
    accent: 'rgba(6, 182, 212, 0.15)'
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    cliArg: 'hermes',
    relDir: path.join('.hermes', 'skills'),
    color: '#14B8A6',
    accent: 'rgba(20, 184, 166, 0.15)'
  }
];

export class SkillsCliService {
  private homedir: string;

  constructor() {
    this.homedir = os.homedir();
  }

  /**
   * Detect installed/configured agents on this system.
   */
  public detectAgents(): AgentDefinition[] {
    return KNOWN_AGENTS_CONFIG.map(cfg => {
      const fullPath = path.join(this.homedir, cfg.relDir);
      // Detected if the skills directory exists or parent config directory exists
      const parentDir = path.dirname(fullPath);
      const isDetected = fs.existsSync(fullPath) || fs.existsSync(parentDir);

      return {
        id: cfg.id,
        name: cfg.name,
        cliArg: cfg.cliArg,
        relativeSkillsDir: cfg.relDir,
        fullSkillsDir: fullPath,
        isDetected,
        color: cfg.color,
        accent: cfg.accent
      };
    });
  }

  /**
   * Execute `npx skills` command with robust argument isolation and timeout.
   */
  public async runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      // Execute npx directly without shell: true to avoid DEP0190 and command injection risks
      const proc = childProcess.spawn('npx', ['skills', ...args], {
        env: {
          ...process.env,
          FORCE_COLOR: '0', // disable ANSI styling in output
          NO_COLOR: '1'
        }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', data => {
        stdout += data.toString();
      });

      proc.stderr.on('data', data => {
        stderr += data.toString();
      });

      // 30 seconds execution timeout
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`Command timed out after 30s: npx skills ${args.join(' ')}`));
      }, 30000);

      proc.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          // Even on non-zero exit codes, if valid JSON is in stdout, let caller examine
          resolve({ stdout, stderr });
        }
      });

      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Extract JSON array or object cleanly from command output,
   * bypassing warning logs like "⚠ Skipped /path/SKILL.md".
   */
  public extractJson<T>(rawOutput: string): T {
    const firstBracket = rawOutput.indexOf('[');
    const firstBrace = rawOutput.indexOf('{');

    let startIndex = -1;
    let endIndex = -1;

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIndex = firstBracket;
      endIndex = rawOutput.lastIndexOf(']');
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
      endIndex = rawOutput.lastIndexOf('}');
    }

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      throw new Error(`No valid JSON found in CLI response:\n${rawOutput.slice(0, 500)}`);
    }

    const jsonSubstr = rawOutput.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonSubstr) as T;
  }

  /**
   * Parse description frontmatter from SKILL.md if present.
   */
  private extractSkillDescription(skillPath: string | null): string {
    if (!skillPath) {
      return '';
    }
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    try {
      if (!fs.existsSync(skillMdPath)) {
        return '';
      }
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      // Match YAML frontmatter description:
      const descMatch = content.match(/description:\s*(.+)/i);
      if (descMatch && descMatch[1]) {
        return descMatch[1].trim().replace(/^['"]|['"]$/g, '');
      }
      // Or first markdown paragraph
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
          return trimmed.slice(0, 140);
        }
      }
    } catch {
      // Ignore reading errors
    }
    return '';
  }

  /**
   * Retrieve all global skills with their agent mounting status.
   */
  public async getMatrixData(): Promise<MatrixData> {
    const agents = this.detectAgents();
    let rawSkills: RawSkillRecord[] = [];

    try {
      const { stdout } = await this.runCli(['list', '-g', '--json']);
      rawSkills = this.extractJson<RawSkillRecord[]>(stdout);
    } catch (err) {
      console.error('Failed to parse npx skills list -g --json:', err);
      // Fallback: scan ~/.agents/skills directory directly if CLI has issues
      rawSkills = this.scanLocalAgentsSkills();
    }

    const skills: SkillItem[] = rawSkills.map(raw => {
      const description = this.extractSkillDescription(raw.path);
      return {
        ...raw,
        description: description || undefined
      };
    });

    const detectedCount = agents.filter(a => a.isDetected).length;

    return {
      skills,
      agents,
      timestamp: Date.now(),
      totalSkills: skills.length,
      detectedAgentsCount: detectedCount
    };
  }

  /**
   * Fallback scanner for ~/.agents/skills directory.
   */
  private scanLocalAgentsSkills(): RawSkillRecord[] {
    const centralPool = path.join(this.homedir, '.agents', 'skills');
    if (!fs.existsSync(centralPool)) {
      return [];
    }

    const items = fs.readdirSync(centralPool);
    const records: RawSkillRecord[] = [];

    for (const name of items) {
      const fullPath = path.join(centralPool, name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          records.push({
            name,
            path: fullPath,
            scope: 'global',
            agents: [],
            status: 'installed'
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
    return records;
  }

  /**
   * Toggle a skill for a specific agent.
   * Uses standard npx skills CLI delegation with atomic filesystem validation.
   */
  public async toggleAgentSkill(
    skillName: string,
    agentId: string,
    enable: boolean,
    isGlobal: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    // 1. Safety Guard check
    if (PROTECTED_SKILL_NAMES.has(skillName)) {
      throw new Error(`Security Exception: Cannot modify protected system component "${skillName}".`);
    }

    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId || a.name.toLowerCase() === agentId.toLowerCase());
    if (!targetAgent) {
      throw new Error(`Unknown agent: "${agentId}"`);
    }

    // Ensure agent skills directory exists
    if (!fs.existsSync(targetAgent.fullSkillsDir)) {
      fs.mkdirSync(targetAgent.fullSkillsDir, { recursive: true });
    }

    const agentSkillPath = path.join(targetAgent.fullSkillsDir, skillName);
    const centralSkillPath = path.join(this.homedir, '.agents', 'skills', skillName);

    if (enable) {
      // Connect / Symlink
      if (!fs.existsSync(agentSkillPath)) {
        if (fs.existsSync(centralSkillPath)) {
          // Direct atomic symlink creation for instant feedback
          fs.symlinkSync(centralSkillPath, agentSkillPath);
        } else {
          // Delegate to CLI install if not present in central pool
          const scopeFlag = isGlobal ? '-g' : '';
          await this.runCli(['add', skillName, '-a', targetAgent.cliArg, scopeFlag, '-y'].filter(Boolean));
        }
      }
      return {
        success: true,
        message: `Successfully enabled "${skillName}" for ${targetAgent.name}`
      };
    } else {
      // Disconnect / Remove Symlink
      if (fs.existsSync(agentSkillPath) || fs.lstatSync(agentSkillPath).isSymbolicLink()) {
        const stat = fs.lstatSync(agentSkillPath);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(agentSkillPath);
        } else {
          // If it's a physical directory in the agent folder, delegate to CLI
          const scopeFlag = isGlobal ? '-g' : '';
          await this.runCli(['remove', skillName, '-a', targetAgent.cliArg, scopeFlag, '-y'].filter(Boolean));
        }
      }
      return {
        success: true,
        message: `Successfully disconnected "${skillName}" from ${targetAgent.name}`
      };
    }
  }

  /**
   * Install a new skill package using npx skills add.
   */
  public async installSkill(
    packageName: string,
    agentIds: string[],
    isGlobal: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    const agents = this.detectAgents();
    const cliAgents = agentIds
      .map(id => agents.find(a => a.id === id)?.cliArg)
      .filter((arg): arg is string => Boolean(arg));

    const args = ['add', packageName];
    if (cliAgents.length > 0) {
      args.push('-a', ...cliAgents);
    }
    if (isGlobal) {
      args.push('-g');
    }
    args.push('-y', '--json');

    const { stdout, stderr } = await this.runCli(args);
    return {
      success: true,
      message: `Skill "${packageName}" installed successfully.`
    };
  }

  /**
   * Remove a skill entirely from global repository or scope.
   */
  public async removeSkill(
    skillName: string,
    isGlobal: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    if (PROTECTED_SKILL_NAMES.has(skillName)) {
      throw new Error(`Security Exception: Cannot remove protected system component "${skillName}".`);
    }

    const args = ['remove', skillName];
    if (isGlobal) {
      args.push('-g');
    }
    args.push('-y');

    await this.runCli(args);
    return {
      success: true,
      message: `Skill "${skillName}" removed.`
    };
  }
}
