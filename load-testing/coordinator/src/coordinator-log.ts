export function coordinatorLog(message: string): void {
  console.log(`[coordinator] ${message}`);
}

export function coordinatorWarn(message: string, err?: unknown): void {
  if (err !== undefined) {
    console.warn(`[coordinator] ${message}`, err);
  } else {
    console.warn(`[coordinator] ${message}`);
  }
}
