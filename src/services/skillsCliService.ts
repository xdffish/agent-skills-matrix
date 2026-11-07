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
import { getLocalizedDescription } from '../types/descriptions';

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
    id: 'workbuddy',
    name: 'WorkBuddy',
    cliArg: 'workbuddy',
    relDir: path.join('.workbuddy', 'skills'),
    color: '#0284C7',
    accent: 'rgba(2, 132, 199, 0.15)'
  },
  {
    id: 'trae',
    name: 'Trae',
    cliArg: 'trae',
    relDir: path.join('.trae', 'skills'),
    color: '#00C48C',
    accent: 'rgba(0, 196, 140, 0.15)'
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
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    cliArg: 'copilot',
    relDir: path.join('.copilot', 'skills'),
    color: '#6366F1',
    accent: 'rgba(99, 102, 241, 0.15)'
  }
];

function safeSymlink(target: string, linkPath: string): void {
  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(target, linkPath, symlinkType);
}

function pointsTo(link: string, target: string): boolean {
  try {
    if (path.resolve(path.dirname(link), fs.readlinkSync(link)) === path.resolve(target)) return true;
    return fs.realpathSync(link) === fs.realpathSync(target);
  } catch { return false; }
}
function identicalTrees(a: string, b: string): boolean {
  const x = fs.lstatSync(a), y = fs.lstatSync(b);
  if (x.isSymbolicLink() || y.isSymbolicLink()) return false;
  if (x.isFile() && y.isFile()) return x.size === y.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  if (!x.isDirectory() || !y.isDirectory()) return false;
  const aa = fs.readdirSync(a).sort(), bb = fs.readdirSync(b).sort();
  return aa.length === bb.length && aa.every((n, i) => n === bb[i] && identicalTrees(path.join(a, n), path.join(b, n)));
}

export class SkillsCliService {
  private homedir: string;
  private centralDir: string;

  constructor() {
    this.homedir = os.homedir();
    this.centralDir = path.join(this.homedir, '.agents', 'skills');
  }

  public detectAgents(): AgentDefinition[] {
    return KNOWN_AGENTS_CONFIG.map(cfg => {
      let fullPath = path.join(this.homedir, cfg.relDir);
      if (cfg.id === 'copilot') {
        const ghSkills = path.join(this.homedir, '.github', 'skills');
        if (fs.existsSync(ghSkills)) fullPath = ghSkills;
        else if (!fs.existsSync(fullPath)) fullPath = path.join(this.homedir, '.copilot', 'skills');
      }
      const isDetected = fs.existsSync(fullPath);
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
      let command = 'npx';
      let commandArgs = ['--yes', 'skills', ...args];
      if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(this.homedir, 'AppData', 'Roaming');
        const candidates = [
          path.join(appData, 'npm', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
          path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
          path.join(path.dirname(path.dirname(process.execPath)), 'node_modules', 'npm', 'bin', 'npx-cli.js')
        ];
        const npxCli = candidates.find(candidate => fs.existsSync(candidate));
        if (!npxCli) {
          reject(new Error('找不到 npm 的 npx-cli.js。请确认 Node.js/npm 已安装，并重启编辑器后重试。'));
          return;
        }
        command = process.execPath;
        commandArgs = [npxCli, '--yes', 'skills', ...args];
      }
      const proc = childProcess.spawn(command, commandArgs, {
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', data => { stdout += data.toString(); });
      proc.stderr.on('data', data => { stderr += data.toString(); });
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out: npx skills ${args.join(' ')}`));
      }, 30000);
      proc.on('close', code => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(stderr.trim() || stdout.trim() || `Command failed with code ${code}: npx skills ${args.join(' ')}`));
        } else {
          resolve({ stdout, stderr });
        }
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
            } else if (!pointsTo(agentSkillPath, fullPath)) {
              agentStates[agent.id] = 'external';
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
        description: getLocalizedDescription(name, description),
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
            } else if (publicNamesSet.has(item) && pointsTo(p, path.join(this.centralDir, item))) {
              linkedCount++;
            } else {
              privateSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                kind: 'external_symlink',
                symlinkTarget: target,
                description: getLocalizedDescription(item, this.extractSkillDescription(p).description)
              });
            }
          } else if (lstat.isDirectory()) {
            if (item === '.system') {
              try {
                for (const sysItem of fs.readdirSync(p)) {
                  if (sysItem.startsWith('.')) continue;
                  const sysP = path.join(p, sysItem);
                  if (fs.existsSync(path.join(sysP, 'SKILL.md'))) {
                    builtinSkills.push({
                      name: sysItem,
                      agentId: agent.id,
                      path: sysP,
                      category: 'runtime',
                      badgeText: 'Codex System',
                      description: getLocalizedDescription(sysItem, this.extractSkillDescription(sysP).description || 'Codex 核心系统技能（只读保护）')
                    });
                  }
                }
              } catch {}
            } else if (item === 'codex-primary-runtime') {
              builtinSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                category: 'runtime',
                badgeText: 'Core Runtime',
                description: 'Codex 核心运行时系统底层组件（强制写保护）'
              });
            } else if (agent.id === 'hermes' && !fs.existsSync(path.join(p, 'SKILL.md'))) {
              // Hermes category folders containing sub-skills
              try {
                for (const subItem of fs.readdirSync(p)) {
                  if (subItem.startsWith('.')) continue;
                  const subP = path.join(p, subItem);
                  if (fs.existsSync(path.join(subP, 'SKILL.md'))) {
                    builtinSkills.push({
                      name: subItem,
                      agentId: agent.id,
                      path: subP,
                      category: 'builtin',
                      badgeText: `Hermes (${item})`,
                      description: getLocalizedDescription(subItem, this.extractSkillDescription(subP).description)
                    });
                  }
                }
              } catch {}
            } else {
              const isDuplicate = publicNamesSet.has(item);
              privateSkills.push({
                name: item,
                agentId: agent.id,
                path: p,
                kind: isDuplicate ? 'duplicate_physical' : 'unique_physical',
                description: getLocalizedDescription(item, this.extractSkillDescription(p).description)
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
                description: getLocalizedDescription(b, this.extractSkillDescription(bp).description)
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
                    description: getLocalizedDescription(sk, this.extractSkillDescription(skp).description)
                  });
                }
              }
            }
          }
        }
      }

      if (agent.id === 'claude-code') {
        const claudePluginsDir = path.join(this.homedir, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', 'plugins');
        if (fs.existsSync(claudePluginsDir)) {
          for (const pkg of fs.readdirSync(claudePluginsDir)) {
            const pkgSkillsDir = path.join(claudePluginsDir, pkg, 'skills');
            if (fs.existsSync(pkgSkillsDir)) {
              for (const sk of fs.readdirSync(pkgSkillsDir)) {
                const skp = path.join(pkgSkillsDir, sk);
                if (fs.existsSync(path.join(skp, 'SKILL.md'))) {
                  builtinSkills.push({
                    name: sk,
                    agentId: agent.id,
                    path: skp,
                    category: 'plugin',
                    badgeText: `Claude Plugin (${pkg})`,
                    description: getLocalizedDescription(sk, this.extractSkillDescription(skp).description)
                  });
                }
              }
            }
          }
        }
      }

      if (agent.id === 'cursor') {
        const cursorSkillsDir = path.join(this.homedir, '.cursor', 'skills-cursor');
        if (fs.existsSync(cursorSkillsDir)) {
          const builtinSet = new Set<string>();
          const manifestPath = path.join(cursorSkillsDir, '.cursor-managed-skills-manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              (manifest.builtinSkillIds || []).forEach((id: string) => builtinSet.add(id));
            } catch {}
          }
          for (const item of fs.readdirSync(cursorSkillsDir)) {
            if (item.startsWith('.')) continue;
            const itemPath = path.join(cursorSkillsDir, item);
            if (fs.existsSync(path.join(itemPath, 'SKILL.md'))) {
              const isBuiltin = builtinSet.has(item);
              const badgeText = isBuiltin ? 'Cursor Built-in' : 'Cursor Managed';
              const category = isBuiltin ? 'builtin' : 'plugin';
              const desc = this.extractSkillDescription(itemPath).description;
              builtinSkills.push({
                name: item,
                agentId: agent.id,
                path: itemPath,
                category,
                badgeText,
                description: getLocalizedDescription(item, desc)
              });
            }
          }
        }
      }

      if (agent.id === 'codex') {
        const codexCacheDir = path.join(this.homedir, '.codex', 'plugins', 'cache');
        if (fs.existsSync(codexCacheDir)) {
          const seenCodex = new Set<string>(builtinSkills.map(b => b.path));
          const scanCodexCache = (dir: string, depth = 0) => {
            if (depth > 6) return;
            try {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  if (fs.existsSync(path.join(full, 'SKILL.md'))) {
                    if (seenCodex.has(full)) continue;
                    seenCodex.add(full);

                    const rel = path.relative(codexCacheDir, full);
                    const parts = rel.split(path.sep);
                    const group = parts[0] || 'plugin';
                    const pkg = group === 'openai-curated-remote' && parts.length > 3
                      ? parts.slice(1, -2).join('/')
                      : parts[1] || entry.name;
                    let badgeText = `Codex Plugin (${pkg})`;
                    let category: 'builtin' | 'plugin' | 'runtime' = 'plugin';
                    if (group === 'openai-primary-runtime') {
                      badgeText = `Codex Runtime (${pkg})`;
                      category = 'runtime';
                    } else if (group === 'openai-bundled') {
                      badgeText = `Codex Bundled (${pkg})`;
                      category = 'builtin';
                    } else if (group === 'openai-curated') {
                      badgeText = `Codex Curated (${pkg})`;
                      category = 'plugin';
                    }
                    const desc = this.extractSkillDescription(full).description;
                    builtinSkills.push({
                      name: `${pkg}:${entry.name}`,
                      agentId: agent.id,
                      path: full,
                      category,
                      badgeText,
                      description: desc
                    });
                  } else {
                    scanCodexCache(full, depth + 1);
                  }
                }
              }
            } catch {}
          };
          scanCodexCache(codexCacheDir);
        }
      }

      if (agent.id === 'workbuddy') {
        let workbuddyLoaded = false;
        const cacheFile = path.join(this.homedir, '.workbuddy', '.skill-list-cache.json');
        if (fs.existsSync(cacheFile)) {
          try {
            const cacheContent = fs.readFileSync(cacheFile, 'utf8');
            const cacheData = JSON.parse(cacheContent);
            const results: any[] = cacheData.results || [];
            for (const item of results) {
              const fp: string = item.filePath || '';
              // Skip user skills already tracked in ~/.workbuddy/skills
              if (fp.startsWith(agent.fullSkillsDir)) {
                continue;
              }
              const skillDir = path.dirname(fp);
              if (!fs.existsSync(fp)) continue;

              const source = item.source;
              let badgeText = 'WorkBuddy Plugin';
              let category: 'builtin' | 'plugin' = 'plugin';
              if (source === 'builtin') {
                badgeText = 'WorkBuddy Built-in';
                category = 'builtin';
              } else if (source === 'connector') {
                badgeText = 'WorkBuddy Connector';
                category = 'plugin';
              }

              const desc = item.description || this.extractSkillDescription(skillDir).description;

              builtinSkills.push({
                name: item.name,
                agentId: agent.id,
                path: skillDir,
                category,
                badgeText,
                description: getLocalizedDescription(item.name, desc)
              });
            }
            workbuddyLoaded = true;
          } catch {}
        }

        // Fallback to directory scan if cache file is not found
        if (!workbuddyLoaded) {
          const wbPluginCache = path.join(this.homedir, '.workbuddy', 'plugins', 'cache');
          if (fs.existsSync(wbPluginCache)) {
            const scanDirForSkills = (dir: string, depth = 0) => {
              if (depth > 5) return;
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  const full = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    if (fs.existsSync(path.join(full, 'SKILL.md'))) {
                      const desc = this.extractSkillDescription(full).description;
                      builtinSkills.push({
                        name: entry.name,
                        agentId: agent.id,
                        path: full,
                        category: 'plugin',
                        badgeText: 'WorkBuddy Plugin',
                        description: getLocalizedDescription(entry.name, desc)
                      });
                    } else {
                      scanDirForSkills(full, depth + 1);
                    }
                  }
                }
              } catch {}
            };
            scanDirForSkills(wbPluginCache);
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
      workspaceFolders: [],
      workspaceSkills: [],
      workspaceScanErrors: [],
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
    if (existingStat?.isSymbolicLink() && !pointsTo(agentSkillPath, centralSkillPath)) throw new Error(`同名链接 ${skillName} 不指向公共池，已保留。`);

    if (enable) {
      if (!fs.existsSync(centralSkillPath)) {
        throw new Error(`Skill ${skillName} does not exist in central pool`);
      }
      if (existingStat) {
        if (existingStat.isSymbolicLink()) {
          return { success: true, message: `${skillName} 已挂载至 ${targetAgent.name}。` };
        } else {
          throw new Error(`${skillName} is a physical directory in ${targetAgent.name}. Please promote or convert it first.`);
        }
      }
      safeSymlink(centralSkillPath, agentSkillPath);
      return { success: true, message: `Linked ${skillName} -> ${targetAgent.name}` };
    } else {
      if (existingStat) {
        if (existingStat.isSymbolicLink()) {
          fs.unlinkSync(agentSkillPath);
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
    const failures: string[] = [];
    for (const a of agents) {
      if (!a.isDetected) continue;
      try { await this.toggleAgentSkill(skillName, a.id, true); count++; }
      catch (err: any) { failures.push(`${a.name}: ${err.message}`); }
    }
    return { success: failures.length === 0, message: `已挂载 ${count} 个 Agent。${failures.length ? `失败：${failures.join('；')}` : ''}` };
  }

  public async promotePrivateSkill(skillName: string, agentId: string): Promise<{ success: boolean; message: string }> {
    const agents = this.detectAgents();
    const targetAgent = agents.find(a => a.id === agentId);
    if (!targetAgent) throw new Error(`Agent ${agentId} not found`);

    const sourcePath = path.join(targetAgent.fullSkillsDir, skillName);
    const destPath = path.join(this.centralDir, skillName);

    if (!fs.existsSync(sourcePath)) throw new Error(`Source skill not found: ${sourcePath}`);
    if (safeLstat(destPath)) throw new Error(`Skill "${skillName}" already exists in central pool.`);

    if (!safeLstat(sourcePath)?.isDirectory()) throw new Error('仅可收编实体目录');
    fs.renameSync(sourcePath, destPath);
    try { safeSymlink(destPath, sourcePath); } catch (err) { fs.renameSync(destPath, sourcePath); throw err; }

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

    if (!safeLstat(sourcePath)?.isDirectory() || !identicalTrees(sourcePath, fs.realpathSync(centralPath))) throw new Error(`同名技能内容不同或包含软链接，已保留：${skillName}`);
    const backup = fs.mkdtempSync(path.join(path.dirname(sourcePath), '.skills-matrix-backup-'));
    const saved = path.join(backup, skillName);
    fs.renameSync(sourcePath, saved);
    try { safeSymlink(centralPath, sourcePath); } catch (err) { fs.renameSync(saved, sourcePath); fs.rmdirSync(backup); throw err; }

    return { success: true, message: `已转换 ${skillName}；原目录备份于 ${saved}` };
  }

  public async normalizeAllAgentSkills(agentId: string): Promise<{ success: boolean; message: string }> {
    const matrix = await this.getMatrixData();
    const detail = matrix.agentDetails[agentId];
    if (!detail) throw new Error(`Agent detail not found for ${agentId}`);

    let promoted = 0;
    let deduped = 0;

    const failures: string[] = [];
    for (const item of detail.privateSkills) {
      try {
      if (item.kind === 'unique_physical') {
        await this.promotePrivateSkill(item.name, agentId);
        promoted++;
      } else if (item.kind === 'duplicate_physical') {
        await this.deduplicatePrivateSkill(item.name, agentId);
        deduped++;
      }
      } catch (err: any) { failures.push(`${item.name}: ${err.message}`); }
    }
    return {
      success: failures.length === 0,
      message: `已收编 ${promoted}，转换 ${deduped}。${failures.length ? `未完成：${failures.join('；')}` : ''}`
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
    if (!fs.existsSync(targetAgent.fullSkillsDir)) {
      return { success: true, message: `No skills directory found for ${targetAgent.name}` };
    }
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
    const removed: string[] = [];
    const failures: string[] = [];
    for (const a of agents) {
      if (!a.isDetected) continue;
      const ap = path.join(a.fullSkillsDir, skillName);
      const stat = safeLstat(ap);
      if (stat && stat.isSymbolicLink() && pointsTo(ap, path.join(this.centralDir, skillName))) {
        try { fs.unlinkSync(ap); removed.push(a.name); }
        catch (err: any) { failures.push(`${a.name}: ${err.message}`); }
      }
    }
    const centralP = path.join(this.centralDir, skillName);
    if (failures.length) {
      return { success: false, message: `已解除 ${removed.length} 个挂载；公共技能已保留。失败：${failures.join('；')}` };
    }
    try { if (safeLstat(centralP)) fs.rmSync(centralP, { recursive: true, force: true }); }
    catch (err: any) { return { success: false, message: `已解除 ${removed.length} 个挂载；删除公共技能失败：${err.message}` }; }
    return { success: true, message: `已删除公共技能 ${skillName}，解除 ${removed.length} 个挂载。` };
  }

  public async installSkill(packageName: string, agents: string[]): Promise<{ success: boolean; message: string; needsSelection?: boolean }> {
    const before = new Set(fs.existsSync(this.centralDir) ? fs.readdirSync(this.centralDir) : []);
    await this.runCli(['add', packageName, '-g', '-y', '--json']);
    const added = fs.existsSync(this.centralDir) ? fs.readdirSync(this.centralDir).filter(n => !before.has(n) && fs.existsSync(path.join(this.centralDir, n, 'SKILL.md'))) : [];
    const failures: string[] = [];
    for (const a of agents) for (const name of added) {
      try { await this.toggleAgentSkill(name, a, true); } catch (err: any) { failures.push(`${a}/${name}: ${err.message}`); }
    }
    return { success: added.length > 0 && failures.length === 0, needsSelection: added.length === 0 && agents.length > 0, message: added.length ? `新增技能：${added.join('、')}。${failures.length ? `挂载失败：${failures.join('；')}` : ''}` : '安装命令已完成，但未发现新增技能；请核对公共池。' };
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
    workbuddy: 'WorkBuddy',
    trae: 'Trae',
    warp: 'Warp',
    hermes: 'Hermes',
    copilot: 'GitHub Copilot'
  };
  return map[id] || id;
}
