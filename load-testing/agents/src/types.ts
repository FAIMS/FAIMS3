import type {SharedEnv} from '@faims3/load-testing-shared';

export interface SessionContext {
  sessionId: string;
  agentId: string;
  env: SharedEnv;
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
