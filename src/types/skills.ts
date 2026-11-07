/**
 * Standard data structures for Agent Skills Matrix
 */

export interface RawSkillRecord {
  name: string;
  path: string | null;
  scope: 'global' | 'project' | string;
  agents: string[];
  source?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  status: string;
}

export interface SkillItem extends RawSkillRecord {
  description?: string;
  isCustom?: boolean;
}

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

export interface MatrixData {
  skills: SkillItem[];
  agents: AgentDefinition[];
  timestamp: number;
  totalSkills: number;
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
        isGlobal: boolean;
      };
    }
  | {
      type: 'installSkill';
      payload: {
        packageName: string;
        agents: string[];
        isGlobal: boolean;
      };
    }
  | {
      type: 'removeSkill';
      payload: {
        skillName: string;
        isGlobal: boolean;
      };
    }
  | {
      type: 'openSkillPath';
      payload: {
        skillPath: string;
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
