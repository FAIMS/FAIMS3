import {
  AgentDoneRequestSchema,
  MetricReportSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  ReadyRequestSchema,
  StatusResponseSchema,
  StepCompleteRequestSchema,
  StepCompleteResponseSchema,
  StepResponseSchema,
  type AgentDoneRequest,
  type MetricReport,
  type RegisterRequest,
  type RegisterResponse,
  type ReadyRequest,
  type StatusResponse,
  type StepCompleteRequest,
  type StepCompleteResponse,
  type StepResponse,
} from './coordinator-api';

async function parseJson<T>(
  response: Response,
  schema: {parse: (data: unknown) => T}
): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data: unknown = await response.json();
  return schema.parse(data);
}

export class CoordinatorClient {
  constructor(private readonly baseUrl: string) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async register(body: RegisterRequest): Promise<RegisterResponse> {
    RegisterRequestSchema.parse(body);
    const response = await fetch(this.url('/register'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, RegisterResponseSchema);
  }

  async ready(body: ReadyRequest): Promise<StepResponse> {
    ReadyRequestSchema.parse(body);
    const response = await fetch(this.url('/ready'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, StepResponseSchema);
  }

  async getStep(agentId: string): Promise<StepResponse> {
    const response = await fetch(
      this.url(`/step?agentId=${encodeURIComponent(agentId)}`)
    );
    return parseJson(response, StepResponseSchema);
  }

  async report(metric: MetricReport): Promise<void> {
    MetricReportSchema.parse(metric);
    const response = await fetch(this.url('/report'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(metric),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
  }

  async stepComplete(body: StepCompleteRequest): Promise<StepCompleteResponse> {
    StepCompleteRequestSchema.parse(body);
    const response = await fetch(this.url('/step-complete'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, StepCompleteResponseSchema);
  }

  async agentDone(body: AgentDoneRequest): Promise<StepResponse> {
    AgentDoneRequestSchema.parse(body);
    const response = await fetch(this.url('/agent-done'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, StepResponseSchema);
  }

  async getStatus(): Promise<StatusResponse> {
    const response = await fetch(this.url('/status'));
    return parseJson(response, StatusResponseSchema);
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(this.url('/health'));
      return response.ok;
    } catch {
      return false;
    }
  }
}
