'use client';

import { useSyncExternalStore } from 'react';
import { CHANGE_EVENT, STORAGE_KEY, type Session, type SessionUser } from './session';

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// Trả về chuỗi JSON để useSyncExternalStore so sánh được giữa các lần đọc
const getSnapshot = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

// undefined = chưa xác định (lúc render trên server), null = chưa đăng nhập
export function useSessionUser(): SessionUser | null | undefined {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  if (raw === undefined) return undefined;
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Session).user;
  } catch {
    return null;
  }
}
