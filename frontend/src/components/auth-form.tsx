'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi } from '@/lib/api';
import { saveSession, type SessionUser } from '@/lib/session';

type AuthMode = 'login' | 'register';
type FieldName = 'fullName' | 'email' | 'password' | 'confirmPassword';
type FormValues = Record<FieldName, string>;
type FormErrors = Partial<Record<FieldName, string>>;

const fields: { name: FieldName; label: string; type: string; autoComplete: string }[] = [
  { name: 'fullName', label: 'Họ và tên', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Mật khẩu', type: 'password', autoComplete: 'current-password' },
  { name: 'confirmPassword', label: 'Xác nhận mật khẩu', type: 'password', autoComplete: 'new-password' },
];

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegister = mode === 'register';
  const [values, setValues] = useState<FormValues>({ fullName: '', email: '', password: '', confirmPassword: '' });
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const visibleFields = fields.filter(field => isRegister || field.name === 'email' || field.name === 'password');

  function updateField(name: FieldName, value: string) {
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined, ...(name === 'password' ? { confirmPassword: undefined } : {}) }));
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (isRegister && !values.fullName.trim()) nextErrors.fullName = 'Vui lòng nhập họ và tên.';
    if (!values.email.trim()) nextErrors.email = 'Vui lòng nhập email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = 'Email không hợp lệ.';
    if (!values.password.trim()) nextErrors.password = 'Vui lòng nhập mật khẩu.';
    else if (isRegister && values.password.length < 6) nextErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    if (isRegister) {
      if (!values.confirmPassword.trim()) nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
      else if (values.confirmPassword !== values.password) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }
    setErrors(nextErrors);
    const firstInvalidField = visibleFields.find(field => nextErrors[field.name]);
    if (firstInvalidField) {
      const input = event.currentTarget.elements.namedItem(firstInvalidField.name);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    setSubmitting(true);
    try {
      const body = isRegister
        ? { fullName: values.fullName.trim(), email: values.email.trim(), password: values.password }
        : { email: values.email.trim(), password: values.password };
      const session = await clientApi<{ accessToken: string; user: SessionUser }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      saveSession(session);
      router.push('/auctions');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby="auth-title" className="mt-6 space-y-5">
      {visibleFields.map(field => {
        const inputId = `${mode}-${field.name}`;
        const errorId = `${inputId}-error`;
        const hintId = `${inputId}-hint`;
        const hasPasswordHint = isRegister && field.name === 'password';
        return (
          <div key={field.name}>
            <label htmlFor={inputId} className="mb-2 block text-sm font-medium">{field.label}</label>
            <input
              id={inputId}
              name={field.name}
              type={field.type}
              autoComplete={isRegister && field.name === 'password' ? 'new-password' : field.autoComplete}
              autoCapitalize={field.name === 'email' ? 'none' : undefined}
              spellCheck={field.name === 'email' ? false : undefined}
              required
              minLength={hasPasswordHint ? 6 : undefined}
              value={values[field.name]}
              onChange={event => updateField(field.name, event.target.value)}
              aria-invalid={Boolean(errors[field.name])}
              aria-describedby={[hasPasswordHint ? hintId : '', errors[field.name] ? errorId : ''].filter(Boolean).join(' ') || undefined}
              className={`w-full rounded-md border bg-white px-4 py-2.5 text-base sm:text-sm ${errors[field.name] ? 'border-[#a34539]' : 'border-[#182b25]/20'}`}
            />
            {hasPasswordHint && <p id={hintId} className="mt-2 text-xs text-[#64716a]">Mật khẩu phải có ít nhất 6 ký tự.</p>}
            {errors[field.name] && <p id={errorId} role="alert" className="mt-2 text-sm text-[#a34539]">{errors[field.name]}</p>}
          </div>
        );
      })}
      {formError && <p role="alert" className="text-sm text-[#a34539]">{formError}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded-md bg-[#234e3c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163b2b] disabled:opacity-60">
        {submitting ? 'Đang xử lý…' : isRegister ? 'Đăng ký' : 'Đăng nhập'}
      </button>
      <p className="text-center text-sm text-[#64716a]">
        {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
        <Link href={isRegister ? '/login' : '/register'} className="font-medium text-[#234e3c] underline underline-offset-4">
          {isRegister ? 'Đăng nhập' : 'Đăng ký'}
        </Link>
      </p>
    </form>
  );
}
