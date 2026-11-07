/**
 * Comprehensive Data Structures for Agent Skills Matrix (v0.2.0 Dual-Perspective Architecture)
 */

export type MountStatus = 'linked' | 'physical' | 'external' | 'broken' | 'off';

export interface AgentDefinition {
  id: string;
  name: string;
  cliArg: string;
  relativeSkillsDir: string;
  fullSkillsDir: string;
  isDetected: boolean;
  color: string;
  accent: string;
}

/**
 * A skill residing in the central public pool (~/.agents/skills)
 */
export interface PublicSkillItem {
  name: string;
  path: string;
  description?: string;
  isSymlinkInCentral: boolean;
  centralTarget?: string;
  hasYamlError?: boolean;
  yamlErrorMsg?: string;
  /** Map of agentId -> MountStatus */
  agentStates: Record<string, MountStatus>;
  /** Number of detected agents where this skill is active ('linked' or 'physical') */
  mountedCount: number;
}

export type PrivateSkillKind =
  | 'unique_physical'
  | 'duplicate_physical'
  | 'broken_symlink'
  | 'external_symlink';

/**
 * Partition 1 in Dedicated Agent View:
 * Skills located in an agent's directory that are NOT standard symlinks to ~/.agents/skills
 */
export interface LocalPrivateSkillItem {
  name: string;
  agentId: string;
  path: string;
  description?: string;
  kind: PrivateSkillKind;
  symlinkTarget?: string;
}

/**
 * Partition 3 in Dedicated Agent View:
 * System built-in, plugin-managed, or core runtime skills (Read-only)
 */
export interface BuiltinSkillItem {
  name: string;
  agentId: string;
  path: string;
  description?: string;
  category: 'builtin' | 'plugin' | 'runtime';
  badgeText: string;
}

/**
 * Full inventory for a specific Agent's Dedicated View
 */
export interface AgentDetailData {
  agent: AgentDefinition;
  linkedCount: number;
  privateCount: number;
  brokenCount: number;
  builtinCount: number;
  totalActiveCount: number;
  privateSkills: LocalPrivateSkillItem[];
  builtinSkills: BuiltinSkillItem[];
}

export interface MatrixData {
  hostAgentId?: string;
  workspaceFolders: string[];
  workspaceSkills: Array<{ name: string; path: string; workspace: string; source: string; description: string }>;
  workspaceScanErrors: string[];
  centralDirPath: string;
  publicSkills: PublicSkillItem[];
  agents: AgentDefinition[];
  agentDetails: Record<string, AgentDetailData>;
  timestamp: number;
  totalPublicSkills: number;
  detectedAgentsCount: number;
}

export type WebviewToExtensionMsg =
  | { type: 'ready' }
  | { type: 'refresh' }
  | {
      type: 'toggleAgentSkill';
      payload: {
        skillName: string;
        agentId: string;
        enabled: boolean;
      };
    }
  | {
      type: 'mountAllAgents';
      payload: {
        skillName: string;
      };
    }
  | {
      type: 'promotePrivateSkill';
      payload: {
        skillName: string;
        agentId: string;
      };
    }
  | {
      type: 'deduplicatePrivateSkill';
      payload: {
        skillName: string;
        agentId: string;
      };
    }
  | {
      type: 'normalizeAllAgentSkills';
      payload: {
        agentId: string;
      };
    }
  | {
      type: 'deletePrivateSkill';
      payload: {
        skillName: string;
        agentId: string;
        kind: PrivateSkillKind;
      };
    }
  | {
      type: 'cleanBrokenSymlinks';
      payload: {
        agentId: string;
      };
    }
  | {
      type: 'installSkill';
      payload: {
        packageName: string;
        agents: string[];
      };
    }
  | {
      type: 'removePublicSkill';
      payload: {
        skillName: string;
      };
    }
  | {
      type: 'openSkillFile';
      payload: {
        skillPath: string;
      };
    }
  | {
      type: 'fixYamlSyntax';
      payload: {
        skillPath: string;
        skillName: string;
      };
    }
  | {
      type: 'openExternalUrl';
      payload: {
        url: string;
      };
    };

export type ExtensionToWebviewMsg =
  | { type: 'setData'; data: MatrixData }
  | { type: 'setLoading'; loading: boolean; text?: string }
  | {
      type: 'notify';
      status: 'info' | 'success' | 'warning' | 'error';
      message: string;
    };
