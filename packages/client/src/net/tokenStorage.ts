const KEY = 'gem-rush.session-token';

/** Persists the guest token so a reload resumes the same session (and any feature in progress). */
export const tokenStorage = {
  load(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  save(token: string): void {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      // Storage unavailable (private mode): the session simply won't survive a reload.
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
