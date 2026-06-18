import type {AgentEnv} from './config.js';

export interface SessionContext {
  sessionId: string;
  agentId: string;
  env: AgentEnv;
  jwtToken?: string;
}

export interface SessionResult {
  sessionId: string;
  success: boolean;
  error?: string;
}

export interface IpcMessage {
  type: 'metric' | 'ready' | 'phase_complete' | 'error' | 'done';
  sessionId?: string;
  payload?: unknown;
}
