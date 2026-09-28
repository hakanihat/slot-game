import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { GAME_CONFIG, type SessionState } from '@gem-rush/shared';
import type { Session } from '../domain/session/Session.js';
import { AppError } from './errors.js';
import type { Clock, SessionRepository, Wallet } from './ports.js';

export interface SessionServiceOptions {
  /** Demo credits granted to new sessions (and on refill), in cents. */
  readonly startingBalance: number;
  readonly idleTimeoutMs: number;
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Owns the session lifecycle: guest sign-in, authentication, refills and expiry. */
export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly wallet: Wallet,
    private readonly clock: Clock,
    private readonly options: SessionServiceOptions,
  ) {}

  async create(): Promise<{ token: string; session: Session }> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock();
    const session: Session = {
      id: randomUUID(),
      tokenHash: hashToken(token),
      createdAt: now,
      lastActiveAt: now,
      freeSpins: null,
      lastRound: null,
      history: [],
    };
    await this.wallet.open(session.id, this.options.startingBalance);
    await this.repository.save(session);
    return { token, session };
  }

  async authenticate(token: string | undefined): Promise<Session> {
    if (!token) throw new AppError('UNAUTHORIZED', 'Missing session token');
    const session = await this.repository.findByTokenHash(hashToken(token));
    if (!session || this.isIdle(session)) {
      throw new AppError('UNAUTHORIZED', 'Session expired or unknown');
    }
    session.lastActiveAt = this.clock();
    return session;
  }

  async state(session: Session): Promise<SessionState> {
    return {
      balance: await this.wallet.balance(session.id),
      currency: GAME_CONFIG.currency,
      freeSpins: session.freeSpins,
      lastRound: session.lastRound,
    };
  }

  /**
   * Demo-only top-up. Allowed only when the player can no longer afford the
   * minimum bet, so it can't be used to inflate a balance mid-session.
   */
  async refill(session: Session): Promise<SessionState> {
    const balance = await this.wallet.balance(session.id);
    const minBet = Math.min(...GAME_CONFIG.betLevels);
    if (session.freeSpins || balance >= minBet) {
      throw new AppError(
        'REFILL_NOT_ALLOWED',
        'Refill is only available when you are out of credits',
      );
    }
    await this.wallet.credit(
      session.id,
      this.options.startingBalance - balance,
      `refill:${randomUUID()}`,
    );
    return this.state(session);
  }

  async sweepIdle(): Promise<number> {
    const removed = await this.repository.deleteIdleSince(
      this.clock() - this.options.idleTimeoutMs,
    );
    await Promise.all(removed.map((id) => this.wallet.close(id)));
    return removed.length;
  }

  private isIdle(session: Session): boolean {
    return this.clock() - session.lastActiveAt > this.options.idleTimeoutMs;
  }
}
