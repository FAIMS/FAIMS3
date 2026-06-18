/** Structured info log prefixed for CloudWatch filtering. */
export function coordinatorLog(message: string): void {
  console.log(`[coordinator] ${message}`);
}

/** Structured warning log; optionally includes an error object. */
export function coordinatorWarn(message: string, err?: unknown): void {
  if (err !== undefined) {
    console.warn(`[coordinator] ${message}`, err);
  } else {
    console.warn(`[coordinator] ${message}`);
  }
}
