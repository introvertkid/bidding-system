export type SessionUser = { id: string; email: string; fullName: string; role: string };
export type Session = { accessToken: string; user: SessionUser };

export const STORAGE_KEY = 'bidwell.session';
export const CHANGE_EVENT = 'bidwell:session';

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return typeof window === 'undefined' ? null : readSession()?.accessToken ?? null;
}

export function saveSession(session: Session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
