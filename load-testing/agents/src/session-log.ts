export function sessionLog(sessionId: string, message: string): void {
  console.log(`[session ${sessionId}] ${message}`);
}
