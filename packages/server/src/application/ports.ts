import type { Session } from '../domain/session/Session.js';

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  /** Removes sessions idle since before `cutoff` (epoch ms). Returns their ids. */
  deleteIdleSince(cutoff: number): Promise<string[]>;
}

/**
 * Wallet port. Every movement carries a reference (the round id) so a real
 * wallet can make calls idempotent and reconcile rounds.
 */
export interface Wallet {
  open(accountId: string, initialBalance: number): Promise<void>;
  balance(accountId: string): Promise<number>;
  /** Throws `AppError('INSUFFICIENT_FUNDS')` when the balance is too low. */
  debit(accountId: string, amount: number, reference: string): Promise<number>;
  credit(accountId: string, amount: number, reference: string): Promise<number>;
  close(accountId: string): Promise<void>;
}

export type Clock = () => number;
