import type { SessionRepository } from '../application/ports.js';
import type { Session } from '../domain/session/Session.js';

/** Process-local storage. Swap for Redis/Postgres behind the same port to scale out. */
export class InMemorySessionRepository implements SessionRepository {
  private readonly byTokenHash = new Map<string, Session>();

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.byTokenHash.get(tokenHash) ?? null;
  }

  async save(session: Session): Promise<void> {
    this.byTokenHash.set(session.tokenHash, session);
  }

  async deleteIdleSince(cutoff: number): Promise<string[]> {
    const removed: string[] = [];
    for (const [hash, session] of this.byTokenHash) {
      if (session.lastActiveAt < cutoff) {
        this.byTokenHash.delete(hash);
        removed.push(session.id);
      }
    }
    return removed;
  }
}
