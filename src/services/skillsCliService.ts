import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AgentDefinition,
  AgentDetailData,
  BuiltinSkillItem,
  LocalPrivateSkillItem,
  MatrixData,
  MountStatus,
  PublicSkillItem
} from '../types/skills';

const PROTECTED_NAMES = new Set(['.system', 'codex-primary-runtime', 'skills_backup']);

/**
 * Safely get lstat without throwing ENOENT if path doesn't exist
 */
function safeLstat(targetPath: string): fs.Stats | null {
  try {
    return fs.lstatSync(targetPath);
  } catch {
    return null;
  }
}

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
    id: 'cursor',
    name: 'Cursor',
    cliArg: 'cursor',
    relDir: path.join('.cursor', 'skills'),
    color: '#10B981',
    accent: 'rgba(16, 185, 129, 0.15)'
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
    id: 'claude-code',
    name: 'Claude Code',
    cliArg: 'claude-code',
    relDir: path.join('.claude', 'skills'),
    color: '#F59E0B',
    accent: 'rgba(245, 158, 11, 0.15)'
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
  private centralDir: string;

  constructor() {
    this.homedir = os.homedir();
    this.centralDir = path.join(this.homedir, '.agents', 'skills');
  }

  public detectAgents(): AgentDefinition[] {
    return KNOWN_AGENTS_CONFIG.map(cfg => {
      const fullPath = path.join(this.homedir, cfg.relDir);
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

  public async runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = childProcess.spawn('npx', ['skills', ...args], {
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', data => { stdout += data.toString(); });
      proc.stderr.on('data', data => { stderr += data.toString(); });
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`Command timed out: npx skills ${args.join(' ')}`));
      }, 30000);
      proc.on('close', () => {
        clearTimeout(timer);
        resolve({ stdout, stderr });
      });
      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  public extractSkillDescription(skillPath: string | null): { description: string; hasYamlError: boolean; yamlErrorMsg?: string } {
    if (!skillPath) return { description: '', hasYamlError: false };
    const skillMd = path.join(skillPath, 'SKILL.md');
    try {
      if (!fs.existsSync(skillMd)) return { description: '', hasYamlError: false };
      const content = fs.readFileSync(skillMd, 'utf-8');
      const lines = content.split('\n');

      let inYaml = false;
      let captureMultiline = false;
      let multiline = '';
      let hasYamlError = false;
      let yamlErrorMsg: string | undefined;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '---') {
          if (!inYaml) { inYaml = true; continue; }
          else { break; }
        }
        if (inYaml) {
          if (captureMultiline) {
            if (line.startsWith('  ') || line.startsWith('\t')) {
              multiline += ' ' + trimmed;
              continue;
            } else {
              captureMultiline = false;
            }
          }
          if (trimmed.startsWith('description:')) {
            const desc = trimmed.substring('description:'.length).trim();
            if (['>', '>-', '|', '|-'].includes(desc)) {
              captureMultiline = true;
              continue;
            }
            if (desc.includes(': ') && !desc.startsWith('"') && !desc.startsWith("'")) {
              hasYamlError = true;
              yamlErrorMsg = 'Contains unquoted colon, which breaks standard YAML parsers';
            }
            if (desc) return { description: desc.replace(/^['"]|['"]$/g, ''), hasYamlError, yamlErrorMsg };
          }
        } else {
          if (trimmed && !trimmed.startsWith('#')) {
            return { description: trimmed.slice(0, 160), hasYamlError: false };
          }
        }
      }
      return {
        description: multiline.trim().slice(0, 160),
        hasYamlError,
        yamlErrorMsg
      };
    } catch (e: any) {
      return { description: '', hasYamlError: true, yamlErrorMsg: e?.message };
    }
  }

  public async getMatrixData(): Promise<MatrixData> {
    const agents = this.detectAgents();
    if (!fs.existsSync(this.centralDir)) {
      fs.mkdirSync(this.centralDir, { recursive: true });
    }

    const centralItems = fs.readdirSync(this.centralDir).sort();
    const publicSkills: PublicSkillItem[] = [];
    const publicNamesSet = new Set<string>();

    for (const name of centralItems) {
      if (PROTECTED_NAMES.has(name) || name.startsWith('.')) continue;
      const fullPath = path.join(this.centralDir, name);
      const stat = safeLstat(fullPath);
      if (!stat || (!stat.isDirectory() && !stat.isSymbolicLink())) continue;

      const isSymlinkInCentral = stat.isSymbolicLink();
      let centralTarget: string | undefined;
      try {
        if (isSymlinkInCentral) centralTarget = fs.readlinkSync(fullPath);
      } catch {}

      const { description, hasYamlError, yamlErrorMsg } = this.extractSkillDescription(fullPath);
      const agentStates: Record<string, MountStatus> = {};
      let mountedCount = 0;

      for (const agent of agents) {
        if (!agent.isDetected) {
          agentStates[agent.id] = 'off';
          continue;
        }
        const agentSkillPath = path.join(agent.fullSkillsDir, name);
        const aStat = safeLstat(agentSkillPath);

        if (aStat) {
          if (aStat.isSymbolicLink()) {
            if (!fs.existsSync(agentSkillPath)) {
              agentStates[agent.id] = 'broken';
            } else {
              agentStates[agent.id] = 'linked';
              mountedCount++;
            }
          } else if (aStat.isDirectory()) {
            agentStates[agent.id] = 'physical';
            mountedCount++;
          }
        } else {
          agentStates[agent.id] = 'off';
        }
      }

      publicSkills.push({
        name,
        path: fullPath,
        description,
        isSymlinkInCentral,
        centralTarget,
        hasYamlError,
        yamlErrorMsg,
        agentStates,
        mountedCount
      });
      publicNamesSet.add(name);
    }

    const agentDetails: Record<string, AgentDetailData> = {};

    for (const agent of agents) {
      const privateSkills: LocalPrivateSkillItem[] = [];
      const builtinSkills: BuiltinSkillItem[] = [];
      let linkedCount = 0;
      let brokenCount = 0;

      if (agent.isDetected && fs.existsSync(agent.fullSkillsDir)) {
        const localItems = fs.readdirSync(agent.fullSkillsDir).sort();
        for (const item of localItems) {
          if (item.startsWith('.') && item !== '.system') continue;
          const p = path.join(agent.fullSkillsDir, item);
          const lstat = safeLstat(p);
          if (!lstat) continue;

          if (lstat.isSymbolicLink()) {
            let target = '';
            try { target = fs.readlinkSync(p); } catch {}
            const exists = fs.existsSync(p);
            if (!exists) {
              brokenCount++;
              privateSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                kind: 'broken_symlink',
                symlinkTarget: target
              });
            } else if (target.includes('.agents/skills') || publicNamesSet.has(item)) {
              linkedCount++;
            } else {
              privateSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                kind: 'external_symlink',
                symlinkTarget: target,
                description: this.extractSkillDescription(p).description
              });
            }
          } else if (lstat.isDirectory()) {
            if (item === '.system' || item === 'codex-primary-runtime') {
              builtinSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                category: 'runtime',
                badgeText: 'Core Runtime',
                description: 'Codex internal runtime core dependencies (Strictly Protected)'
              });
            } else {
              const isDuplicate = publicNamesSet.has(item);
              privateSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                kind: isDuplicate ? 'duplicate_physical' : 'unique_physical',
                description: this.extractSkillDescription(p).description
              });
            }
          }
        }
      }

      if (agent.id === 'antigravity') {
        const builtinDir = path.join(this.homedir, '.gemini', 'antigravity', 'builtin', 'skills');
        if (fs.existsSync(builtinDir)) {
          for (const b of fs.readdirSync(builtinDir)) {
            const bp = path.join(builtinDir, b);
            if (fs.existsSync(path.join(bp, 'SKILL.md'))) {
              builtinSkills.push({
                name: b,
                agentId: agent.id,
                path: bp,
                category: 'builtin',
                badgeText: 'Built-in',
                description: this.extractSkillDescription(bp).description
              });
            }
          }
        }
        const pluginDir = path.join(this.homedir, '.gemini', 'config', 'plugins');
        if (fs.existsSync(pluginDir)) {
          for (const pkg of fs.readdirSync(pluginDir)) {
            const pkgSkillsDir = path.join(pluginDir, pkg, 'skills');
            if (fs.existsSync(pkgSkillsDir)) {
              for (const sk of fs.readdirSync(pkgSkillsDir)) {
                const skp = path.join(pkgSkillsDir, sk);
                if (fs.existsSync(path.join(skp, 'SKILL.md'))) {
                  builtinSkills.push({
                    name: sk,
                    agentId: agent.id,
                    path: skp,
                    category: 'plugin',
                    badgeText: `Plugin (${pkg})`,
                    description: this.extractSkillDescription(skp).description
                  });
                }
              }
            }
          }
        }
      }

      agentDetails[agent.id] = {
        agent,
        linkedCount,
        privateCount: privateSkills.length,
        brokenCount,
        builtinCount: builtinSkills.length,
        totalActiveCount: linkedCount + privateSkills.filter(s => s.kind !== 'broken_symlink').length,
        privateSkills,
        builtinSkills
      };
    }

    return {
      centralDirPath: this.centralDir,
      publicSkills,
      agents,
      agentDetails,
      timestamp: Date.now(),
      totalPublicSkills: publicSkills.length,
      detectedAgentsCount: agents.filter(a => a.isDetected).length
    };
  }

  public async toggleAgentSkill(skillName: string, agentId: string, enable: boolean): Promise<{ success: boolean; message: string }> {
    if (PROTECTED_NAMES.has(skillName)) {
      throw new Error(`Protected system component "${skillName}" cannot be toggled.`);
    }
    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId);
    if (!targetAgent) throw new Error(`Agent ${agentId} not found`);

    if (!fs.existsSync(targetAgent.fullSkillsDir)) {
      fs.mkdirSync(targetAgent.fullSkillsDir, { recursive: true });
    }
    const agentSkillPath = path.join(targetAgent.fullSkillsDir, skillName);
    const centralSkillPath = path.join(this.centralDir, skillName);

    const existingStat = safeLstat(agentSkillPath);

    if (enable) {
      if (!fs.existsSync(centralSkillPath)) {
        throw new Error(`Skill ${skillName} does not exist in central pool`);
      }
      if (existingStat) {
        if (existingStat.isSymbolicLink()) {
          try { fs.unlinkSync(agentSkillPath); } catch {}
        } else {
          throw new Error(`${skillName} is a physical directory in ${targetAgent.name}. Please promote or convert it first.`);
        }
      }
      fs.symlinkSync(centralSkillPath, agentSkillPath);
      return { success: true, message: `Linked ${skillName} -> ${targetAgent.name}` };
    } else {
      if (existingStat) {
        if (existingStat.isSymbolicLink()) {
          try { fs.unlinkSync(agentSkillPath); } catch {}
        } else {
          throw new Error(`${skillName} is a physical directory in ${targetAgent.name}. Use dedicated agent view to promote or delete.`);
        }
      }
      return { success: true, message: `Disconnected ${skillName} from ${targetAgent.name}` };
    }
  }

  public async mountAllAgents(skillName: string): Promise<{ success: boolean; message: string }> {
    const agents = this.detectAgents();
    let count = 0;
    for (const a of agents) {
      if (!a.isDetected) continue;
      await this.toggleAgentSkill(skillName, a.id, true);
      count++;
    }
    return { success: true, message: `Mounted ${skillName} to all ${count} active agents.` };
  }

  public async promotePrivateSkill(skillName: string, agentId: string): Promise<{ success: boolean; message: string }> {
    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId);
    if (!targetAgent) throw new Error(`Agent ${agentId} not found`);

    const sourcePath = path.join(targetAgent.fullSkillsDir, skillName);
    const destPath = path.join(this.centralDir, skillName);

    if (!fs.existsSync(sourcePath)) throw new Error(`Source skill not found: ${sourcePath}`);
    if (fs.existsSync(destPath)) throw new Error(`Skill "${skillName}" already exists in central pool.`);

    fs.renameSync(sourcePath, destPath);
    fs.symlinkSync(destPath, sourcePath);

    return { success: true, message: `Successfully promoted "${skillName}" to Central Pool and converted to symlink!` };
  }

  public async deduplicatePrivateSkill(skillName: string, agentId: string): Promise<{ success: boolean; message: string }> {
    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId);
    if (!targetAgent) throw new Error(`Agent ${agentId} not found`);

    const sourcePath = path.join(targetAgent.fullSkillsDir, skillName);
    const centralPath = path.join(this.centralDir, skillName);

    if (!fs.existsSync(centralPath)) {
      throw new Error(`Central skill ${skillName} does not exist. Cannot deduplicate.`);
    }

    if (fs.existsSync(sourcePath)) {
      fs.rmSync(sourcePath, { recursive: true, force: true });
    }
    fs.symlinkSync(centralPath, sourcePath);

    return { success: true, message: `Replaced physical duplicate "${skillName}" with standard central symlink.` };
  }

  public async normalizeAllAgentSkills(agentId: string): Promise<{ success: boolean; message: string }> {
    const matrix = await this.getMatrixData();
    const detail = matrix.agentDetails[agentId];
    if (!detail) throw new Error(`Agent detail not found for ${agentId}`);

    let promoted = 0;
    let deduped = 0;

    for (const item of detail.privateSkills) {
      if (item.kind === 'unique_physical') {
        await this.promotePrivateSkill(item.name, agentId);
        promoted++;
      } else if (item.kind === 'duplicate_physical') {
        await this.deduplicatePrivateSkill(item.name, agentId);
        deduped++;
      }
    }
    return {
      success: true,
      message: `Normalized ${targetName(agentId)}: ${promoted} promoted to central pool, ${deduped} converted to symlinks.`
    };
  }

  public async deletePrivateSkill(skillName: string, agentId: string): Promise<{ success: boolean; message: string }> {
    if (PROTECTED_NAMES.has(skillName)) throw new Error(`Cannot delete protected component`);
    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId);
    if (!targetAgent) throw new Error(`Agent ${agentId} not found`);

    const p = path.join(targetAgent.fullSkillsDir, skillName);
    const stat = safeLstat(p);
    if (stat) {
      if (stat.isSymbolicLink()) {
        try { fs.unlinkSync(p); } catch {}
      } else {
        fs.rmSync(p, { recursive: true, force: true });
      }
    }
    return { success: true, message: `Deleted ${skillName} from ${targetAgent.name}` };
  }

  public async cleanBrokenSymlinks(agentId: string): Promise<{ success: boolean; message: string }> {
    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId);
    if (!targetAgent) throw new Error(`Agent not found`);

    let cleaned = 0;
    const items = fs.readdirSync(targetAgent.fullSkillsDir);
    for (const item of items) {
      const p = path.join(targetAgent.fullSkillsDir, item);
      const stat = safeLstat(p);
      if (stat && stat.isSymbolicLink() && !fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          cleaned++;
        } catch {}
      }
    }
    return { success: true, message: `Cleaned ${cleaned} broken symlinks in ${targetAgent.name}` };
  }

  public async removePublicSkill(skillName: string): Promise<{ success: boolean; message: string }> {
    if (PROTECTED_NAMES.has(skillName)) throw new Error(`Cannot delete protected component`);
    const agents = this.detectAgents();
    for (const a of agents) {
      if (!a.isDetected) continue;
      const ap = path.join(a.fullSkillsDir, skillName);
      const stat = safeLstat(ap);
      if (stat && stat.isSymbolicLink()) {
        try { fs.unlinkSync(ap); } catch {}
      }
    }
    const centralP = path.join(this.centralDir, skillName);
    if (fs.existsSync(centralP)) {
      fs.rmSync(centralP, { recursive: true, force: true });
    }
    return { success: true, message: `Completely removed "${skillName}" from central pool and all agents.` };
  }

  public async installSkill(packageName: string, agents: string[]): Promise<{ success: boolean; message: string }> {
    const args = ['add', packageName, '-g', '-y', '--json'];
    await this.runCli(args);
    for (const a of agents) {
      const skillName = packageName.split('/').pop()?.replace('.git', '') || packageName;
      try {
        await this.toggleAgentSkill(skillName, a, true);
      } catch {}
    }
    return { success: true, message: `Installed ${packageName} into central pool.` };
  }

  public fixYamlSyntax(skillPath: string): { success: boolean; message: string } {
    const skillMd = path.join(skillPath, 'SKILL.md');
    if (!fs.existsSync(skillMd)) throw new Error('SKILL.md not found');
    let content = fs.readFileSync(skillMd, 'utf-8');
    content = content.replace(/^description:\s*(.+)$/m, (match, desc) => {
      const d = desc.trim();
      if (!d.startsWith('"') && !d.startsWith("'")) {
        return `description: "${d.replace(/"/g, '\\"')}"`;
      }
      return match;
    });
    fs.writeFileSync(skillMd, content, 'utf-8');
    return { success: true, message: 'Fixed YAML description syntax in SKILL.md' };
  }
}

function targetName(id: string): string {
  const map: Record<string, string> = {
    antigravity: 'Antigravity',
    cursor: 'Cursor',
    codex: 'Codex',
    'claude-code': 'Claude Code',
    warp: 'Warp',
    hermes: 'Hermes'
  };
  return map[id] || id;
}
