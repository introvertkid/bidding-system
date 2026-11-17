'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafaf8] px-6 py-12 text-[#182b25]">
      <section aria-labelledby="error-title" className="w-full max-w-md rounded-md border border-[#182b25]/15 bg-white p-6 text-center sm:p-8">
        <p className="text-sm font-semibold text-[#234e3c]">Bidwell</p>
        <h1 id="error-title" className="mt-3 text-2xl font-semibold tracking-tight">Không tải được nội dung</h1>
        <p className="mt-3 text-sm leading-6 text-[#64716a]">
          Đã xảy ra sự cố khi tải dữ liệu. Vui lòng thử lại sau.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b]"
        >
          Thử lại
        </button>
      </section>
    </main>
  );
}
