'use client';

import { useRef, useState, type FormEvent } from 'react';

export default function BidPanel({ currentBid }: { currentBid: number }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bid = Number(amount);
    let nextError = '';
    if (!amount.trim()) nextError = 'Vui lòng nhập giá trả.';
    else if (!Number.isFinite(bid) || bid <= 0) nextError = 'Giá trả phải lớn hơn 0.';
    else if (bid <= currentBid) nextError = 'Giá trả phải cao hơn giá hiện tại.';
    setError(nextError);
    if (nextError) inputRef.current?.focus();
    // Validation only. The backend will process bids later.
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-6 border-t border-[#182b25]/10 pt-5">
      <label htmlFor="bid-amount" className="mb-2 block text-sm font-medium">Giá trả của bạn</label>
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id="bid-amount"
          name="amount"
          type="number"
          step="any"
          required
          value={amount}
          onChange={event => { setAmount(event.target.value); setError(''); }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'bid-currency bid-error' : 'bid-currency'}
          className={`min-w-0 flex-1 rounded-md border bg-white px-4 py-2.5 text-base sm:text-sm ${error ? 'border-[#a34539]' : 'border-[#182b25]/20'}`}
        />
        <span id="bid-currency" className="text-sm text-[#64716a]">VNĐ</span>
      </div>
      {error && <p id="bid-error" role="alert" className="mt-2 text-sm text-[#a34539]">{error}</p>}
      <button type="submit" className="mt-4 w-full rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b]">Đặt giá</button>
    </form>
  );
}
