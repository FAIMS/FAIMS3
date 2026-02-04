export interface FormLogger {
  /** Log an error with optional context */
  error: (error: Error, context?: Record<string, unknown>) => void;
  /** Log a warning - matches console log style */
  warn: (message: string, ...args: unknown[]) => void;
  /** Log a debug - matches console log style */
  debug: (message: string, ...args: unknown[]) => void;
  /** Log informational message (for debug/trace) - matches console log style */
  info: (message: string, ...args: unknown[]) => void;
  /** Add metadata that persists across all logs in this session */
  setContext: (context: Record<string, unknown>) => void;
}
