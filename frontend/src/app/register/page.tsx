import type { Metadata } from 'next';
import SiteHeader from '@/components/site-header';
import AuthForm from '@/components/auth-form';

export const metadata: Metadata = {
  title: 'Đăng ký | Bidwell',
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#182b25]">
      <SiteHeader currentPage="register" />
      <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:py-10 lg:px-10">
        <section aria-labelledby="auth-title" className="mx-auto w-full max-w-md rounded-md border border-[#182b25]/15 bg-white p-5 sm:p-8">
          <h1 id="auth-title" className="text-2xl font-semibold tracking-tight">Đăng ký</h1>
          <p className="mt-3 text-sm leading-6 text-[#64716a]">Tạo tài khoản để tham gia và quản lý các phiên đấu giá.</p>
          <AuthForm mode="register" />
        </section>
      </main>
    </div>
  );
}
