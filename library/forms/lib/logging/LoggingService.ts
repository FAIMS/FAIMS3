import {FormLogger} from './types';

/** Console-only fallback logger */
const consoleLogger: FormLogger = {
  error: (error, context) => {
    console.error('[FormLogger] Error:', error.message, {
      ...context,
      stack: error.stack,
    });
  },
  warn: (message, ...args) => {
    console.warn('[FormLogger] Warning:', message, ...args);
  },
  info: (message, ...args) => {
    console.info('[FormLogger] Info:', message, ...args);
  },
  debug: (message, ...args) => {
    console.debug('[FormLogger] Debug:', message, ...args);
  },
  setContext: () => {},
};

class LoggingServiceClass implements FormLogger {
  private static instance: LoggingServiceClass;
  private logger: FormLogger = consoleLogger;

  private constructor() {}

  static getInstance(): LoggingServiceClass {
    if (!LoggingServiceClass.instance) {
      LoggingServiceClass.instance = new LoggingServiceClass();
    }
    return LoggingServiceClass.instance;
  }

  /**
   * Register a custom logger implementation (e.g., Bugsnag adapter)
   * Call this once at app initialization
   */
  register(logger: FormLogger): void {
    this.logger = logger;
  }

  /**
   * Reset to default console logger
   */
  reset(): void {
    this.logger = consoleLogger;
  }

  error(error: Error, context?: Record<string, unknown>): void {
    this.logger.error(error, context);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, ...args);
  }

  setContext(context: Record<string, unknown>): void {
    this.logger.setContext(context);
  }
}

/** Singleton logging service instance */
export const LoggingService = LoggingServiceClass.getInstance();

// Convenience function exports
export const logError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  LoggingService.error(error, context);
};

export const logWarn = (message: string, ...args: unknown[]): void => {
  LoggingService.warn(message, ...args);
};

export const logDebug = (message: string, ...args: unknown[]): void => {
  LoggingService.debug(message, ...args);
};

export const logInfo = (message: string, ...args: unknown[]): void => {
  LoggingService.info(message, ...args);
};

export const logSetContext = (context: Record<string, unknown>): void => {
  LoggingService.setContext(context);
};
