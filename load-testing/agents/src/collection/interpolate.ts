export interface TemplateContext {
  agentId: string;
  sessionId: string;
  recordIndex: number;
}

/** Replace `{{token}}` placeholders in profile values. */
export function interpolateValue(
  template: string,
  context: TemplateContext
): string {
  const now = Date.now();
  const replacements: Record<string, string> = {
    agentId: context.agentId,
    sessionId: context.sessionId,
    recordIndex: String(context.recordIndex),
    timestamp: String(now),
    isoTimestamp: new Date(now).toISOString(),
  };

  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, token: string) => {
    return replacements[token] ?? match;
  });
}
