'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { clientApi } from '@/lib/api';
import { clearSession } from '@/lib/session';
import { useSessionUser } from '@/lib/use-session-user';

export default function AuthNav({ hideLinks }: { hideLinks: boolean }) {
  const router = useRouter();
  const user = useSessionUser();
  const userId = user?.id;

  // Kiểm tra phiên đăng nhập còn hợp lệ (clientApi tự đăng xuất nếu backend trả 401)
  useEffect(() => {
    if (userId) clientApi('/auth/me').catch(() => {});
  }, [userId]);

  // Chưa đọc được localStorage (lúc render trên server)
  if (user === undefined) return null;

  if (user) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <span className="text-[#64716a]">Xin chào, <span className="font-medium text-[#182b25]">{user.fullName}</span></span>
        <button
          type="button"
          onClick={() => { clearSession(); router.push('/'); router.refresh(); }}
          className="rounded-md border border-[#182b25]/20 bg-white px-4 py-2 text-sm font-medium hover:bg-[#f0f2ed]"
        >
          Đăng xuất
        </button>
      </div>
    );
  }

  if (hideLinks) return null;
  return (
    <div className="flex items-center gap-4 text-sm font-medium">
      <Link prefetch={false} href="/login" className="hover:underline">Đăng nhập</Link>
      <Link prefetch={false} href="/register" className="rounded-md bg-[#234e3c] px-4 py-2 text-white hover:bg-[#163b2b]">Đăng ký</Link>
    </div>
  );
}
