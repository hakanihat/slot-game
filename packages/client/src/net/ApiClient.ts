import type {
  ApiErrorBody,
  ApiErrorCode,
  BonusPickResponse,
  CheatScenario,
  CreateSessionResponse,
  GameInfo,
  HistoryResponse,
  SessionState,
  SpinResponse,
} from '@gem-rush/shared';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'NETWORK',
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Worth retrying: the server was unreachable or failed, rather than rejecting the request. */
  get isTransient(): boolean {
    return this.code === 'NETWORK' || this.status >= 500;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Typed wrapper over the REST contract. The client never computes outcomes:
 * everything that affects money comes from these calls.
 */
export class ApiClient {
  private token: string | null = null;

  constructor(private readonly baseUrl = '') {}

  setToken(token: string | null): void {
    this.token = token;
  }

  getGameInfo(): Promise<GameInfo> {
    return this.request('GET', '/api/game');
  }

  createSession(): Promise<CreateSessionResponse> {
    return this.request('POST', '/api/sessions');
  }

  getSession(): Promise<SessionState> {
    return this.request('GET', '/api/sessions/me');
  }

  refill(): Promise<SessionState> {
    return this.request('POST', '/api/sessions/me/refill');
  }

  spin(bet: number, cheat?: CheatScenario): Promise<SpinResponse> {
    return this.request('POST', '/api/spin', cheat ? { bet, cheat } : { bet });
  }

  pickBonus(tile: number): Promise<BonusPickResponse> {
    return this.request('POST', '/api/bonus/pick', { tile });
  }

  history(): Promise<HistoryResponse> {
    return this.request('GET', '/api/history');
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ApiError(
        'NETWORK',
        'Connection problem — please check your network and try again.',
      );
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        payload?.error.code ?? 'INTERNAL',
        payload?.error.message ?? `Request failed (${response.status})`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }
}
