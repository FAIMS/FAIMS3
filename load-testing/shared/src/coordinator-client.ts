import {
  AgentDoneRequestSchema,
  MetricReportSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  CredentialsResponseSchema,
  ReadyRequestSchema,
  StatusResponseSchema,
  StepCompleteRequestSchema,
  StepCompleteResponseSchema,
  StepResponseSchema,
  type AgentDoneRequest,
  type MetricReport,
  type RegisterRequest,
  type RegisterResponse,
  type CredentialsResponse,
  type ReadyRequest,
  type StatusResponse,
  type StepCompleteRequest,
  type StepCompleteResponse,
  type StepResponse,
} from './coordinator-api';

export interface CoordinatorClientOptions {
  /** Timeout for register / ready / step / status calls (default 30s). */
  requestTimeoutMs?: number;
  /** Timeout per /report attempt (default 15s). */
  reportTimeoutMs?: number;
  /** Retries for critical coordinator calls (default 3). */
  requestRetries?: number;
  /** Retries for /report (default 3). */
  reportRetries?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_REPORT_TIMEOUT_MS = 15_000;
const DEFAULT_REQUEST_RETRIES = 3;
const DEFAULT_REPORT_RETRIES = 3;

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  if (err.name === 'AbortError') {
    return true;
  }
  const cause = (err as Error & {cause?: unknown}).cause;
  if (cause instanceof Error) {
    const code = (cause as Error & {code?: string}).code ?? '';
    if (
      code.includes('TIMEOUT') ||
      code.includes('ECONNREFUSED') ||
      code.includes('ECONNRESET') ||
      code.includes('EHOSTUNREACH') ||
      code.includes('ENETUNREACH')
    ) {
      return true;
    }
  }
  return err.message.includes('fetch failed');
}

function isRetryableResponse(response: Response): boolean {
  return response.status >= 500 || response.status === 429;
}

async function fetchCoordinator(
  url: string,
  init: RequestInit,
  options: {timeoutMs: number; retries: number}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (isRetryableResponse(response) && attempt < options.retries) {
        await sleep(250 * attempt);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < options.retries && isRetryableFetchError(err)) {
        await sleep(250 * attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Coordinator request failed');
}

export class CoordinatorClient {
  private readonly requestTimeoutMs: number;
  private readonly reportTimeoutMs: number;
  private readonly requestRetries: number;
  private readonly reportRetries: number;

  constructor(
    private readonly baseUrl: string,
    options: CoordinatorClientOptions = {}
  ) {
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.reportTimeoutMs = options.reportTimeoutMs ?? DEFAULT_REPORT_TIMEOUT_MS;
    this.requestRetries = options.requestRetries ?? DEFAULT_REQUEST_RETRIES;
    this.reportRetries = options.reportRetries ?? DEFAULT_REPORT_RETRIES;
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async request(
    path: string,
    init?: RequestInit
  ): Promise<Response> {
    return fetchCoordinator(this.url(path), init ?? {}, {
      timeoutMs: this.requestTimeoutMs,
      retries: this.requestRetries,
    });
  }

  async getCredentials(agentId: string): Promise<CredentialsResponse> {
    const response = await this.request(
      `/credentials?agentId=${encodeURIComponent(agentId)}`
    );
    return parseJson(response, CredentialsResponseSchema);
  }

  async register(body: RegisterRequest): Promise<RegisterResponse> {
    RegisterRequestSchema.parse(body);
    const response = await this.request('/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, RegisterResponseSchema);
  }

  async ready(body: ReadyRequest): Promise<StepResponse> {
    ReadyRequestSchema.parse(body);
    const response = await this.request('/ready', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, StepResponseSchema);
  }

  async getStep(agentId: string): Promise<StepResponse> {
    const response = await this.request(
      `/step?agentId=${encodeURIComponent(agentId)}`
    );
    return parseJson(response, StepResponseSchema);
  }

  /** Best-effort metric delivery; returns false when coordinator is unreachable. */
  async report(metric: MetricReport): Promise<boolean> {
    MetricReportSchema.parse(metric);

    try {
      const response = await fetchCoordinator(
        this.url('/report'),
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(metric),
        },
        {
          timeoutMs: this.reportTimeoutMs,
          retries: this.reportRetries,
        }
      );

      if (!response.ok) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async stepComplete(body: StepCompleteRequest): Promise<StepCompleteResponse> {
    StepCompleteRequestSchema.parse(body);
    const response = await this.request('/step-complete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, StepCompleteResponseSchema);
  }

  async agentDone(body: AgentDoneRequest): Promise<StepResponse> {
    AgentDoneRequestSchema.parse(body);
    const response = await this.request('/agent-done', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return parseJson(response, StepResponseSchema);
  }

  async getStatus(): Promise<StatusResponse> {
    const response = await this.request('/status');
    return parseJson(response, StatusResponseSchema);
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetchCoordinator(
        this.url('/health'),
        {},
        {timeoutMs: 5_000, retries: 1}
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
