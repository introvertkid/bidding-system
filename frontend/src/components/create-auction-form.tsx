'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { clientApi } from '@/lib/api';
import { useSessionUser } from '@/lib/use-session-user';

type FormValues = {
  title: string;
  description: string;
  startingPrice: string;
  startTime: string;
  endTime: string;
};
type FieldName = keyof FormValues | 'image';
type FormErrors = Partial<Record<FieldName, string>>;

export default function CreateAuctionForm() {
  const [values, setValues] = useState<FormValues>({ title: '', description: '', startingPrice: '', startTime: '', endTime: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const router = useRouter();
  const user = useSessionUser();
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function updateField(name: keyof FormValues, value: string) {
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined, ...(name === 'startTime' ? { endTime: undefined } : {}) }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreviewUrl('');
    setImageFile(null);
    if (file && !file.type.startsWith('image/')) {
      event.target.value = '';
      setErrors(previous => ({ ...previous, image: 'Vui lòng chọn tệp ảnh.' }));
      return;
    }
    setErrors(previous => ({ ...previous, image: undefined }));
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setImageFile(file);
      setPreviewUrl(url);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!values.title.trim()) nextErrors.title = 'Vui lòng nhập tên sản phẩm.';
    if (!values.description.trim()) nextErrors.description = 'Vui lòng nhập mô tả.';
    if (!imageFile) nextErrors.image = 'Vui lòng chọn ảnh sản phẩm.';
    if (!values.startingPrice.trim()) nextErrors.startingPrice = 'Vui lòng nhập giá khởi điểm.';
    else if (!Number.isFinite(Number(values.startingPrice)) || Number(values.startingPrice) <= 0) nextErrors.startingPrice = 'Giá khởi điểm phải lớn hơn 0.';
    const startTime = new Date(values.startTime).getTime();
    const endTime = new Date(values.endTime).getTime();
    if (!values.startTime || !Number.isFinite(startTime)) nextErrors.startTime = 'Vui lòng chọn thời gian bắt đầu.';
    if (!values.endTime || !Number.isFinite(endTime)) nextErrors.endTime = 'Vui lòng chọn thời gian kết thúc.';
    else if (Number.isFinite(startTime) && endTime <= startTime) nextErrors.endTime = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    setErrors(nextErrors);
    const fieldOrder: FieldName[] = ['title', 'description', 'image', 'startingPrice', 'startTime', 'endTime'];
    const firstInvalidField = fieldOrder.find(name => nextErrors[name]);
    if (firstInvalidField) {
      const input = event.currentTarget.elements.namedItem(firstInvalidField);
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.focus();
      return;
    }

    const formData = new FormData();
    formData.append('title', values.title.trim());
    formData.append('description', values.description.trim());
    formData.append('startingPrice', values.startingPrice);
    // datetime-local là giờ địa phương, gửi ISO (UTC) để backend hiểu đúng múi giờ
    formData.append('startTime', new Date(values.startTime).toISOString());
    formData.append('endTime', new Date(values.endTime).toISOString());
    if (imageFile) formData.append('image', imageFile);

    setFormError('');
    setSubmitting(true);
    try {
      const auction = await clientApi<{ id: string }>('/auctions', { method: 'POST', body: formData });
      router.push(`/auctions/${auction.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Tạo phiên thất bại.');
      setSubmitting(false);
    }
  }

  function inputClass(name: FieldName) {
    return `w-full rounded-md border bg-white px-4 py-2.5 text-base sm:text-sm ${errors[name] ? 'border-[#a34539]' : 'border-[#182b25]/20'}`;
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby="create-auction-title" className="w-full">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <fieldset className="min-w-0 space-y-5">
            <legend className="mb-5 text-lg font-semibold">Thông tin sản phẩm</legend>
            <div>
              <label htmlFor="auction-title" className="mb-2 block text-sm font-medium">Tên sản phẩm</label>
              <input id="auction-title" name="title" type="text" required placeholder="Nhập tên sản phẩm" value={values.title} onChange={event => updateField('title', event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} className={inputClass('title')} />
              {errors.title && <p id="title-error" role="alert" className="mt-2 text-sm text-[#a34539]">{errors.title}</p>}
            </div>
            <div>
              <label htmlFor="auction-description" className="mb-2 block text-sm font-medium">Mô tả</label>
              <textarea id="auction-description" name="description" required rows={4} placeholder="Mô tả tình trạng và thông tin sản phẩm" value={values.description} onChange={event => updateField('description', event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} className={`${inputClass('description')} resize-y focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#688447]`} />
              {errors.description && <p id="description-error" role="alert" className="mt-2 text-sm text-[#a34539]">{errors.description}</p>}
            </div>
          </fieldset>
          <fieldset className="mt-6 min-w-0 space-y-5 border-t border-[#182b25]/10 pt-5">
            <legend className="text-lg font-semibold">Thông tin phiên đấu giá</legend>
            <div>
              <label htmlFor="auction-starting-price" className="mb-2 block text-sm font-medium">Giá khởi điểm (VNĐ)</label>
              <input id="auction-starting-price" name="startingPrice" type="number" step="any" required value={values.startingPrice} onChange={event => updateField('startingPrice', event.target.value)} aria-invalid={Boolean(errors.startingPrice)} aria-describedby={errors.startingPrice ? 'starting-price-error' : undefined} className={inputClass('startingPrice')} />
              {errors.startingPrice && <p id="starting-price-error" role="alert" className="mt-2 text-sm text-[#a34539]">{errors.startingPrice}</p>}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="auction-start-time" className="mb-2 block text-sm font-medium">Thời gian bắt đầu</label>
                <input id="auction-start-time" name="startTime" type="datetime-local" required value={values.startTime} onChange={event => updateField('startTime', event.target.value)} aria-invalid={Boolean(errors.startTime)} aria-describedby={errors.startTime ? 'start-time-error' : undefined} className={inputClass('startTime')} />
                {errors.startTime && <p id="start-time-error" role="alert" className="mt-2 text-sm text-[#a34539]">{errors.startTime}</p>}
              </div>
              <div className="min-w-0">
                <label htmlFor="auction-end-time" className="mb-2 block text-sm font-medium">Thời gian kết thúc</label>
                <input id="auction-end-time" name="endTime" type="datetime-local" required value={values.endTime} onChange={event => updateField('endTime', event.target.value)} aria-invalid={Boolean(errors.endTime)} aria-describedby={errors.endTime ? 'end-time-error' : undefined} className={inputClass('endTime')} />
                {errors.endTime && <p id="end-time-error" role="alert" className="mt-2 text-sm text-[#a34539]">{errors.endTime}</p>}
              </div>
            </div>
          </fieldset>
        </div>
        <section aria-labelledby="image-section-title" className="min-w-0">
          <h2 id="image-section-title" className="mb-5 text-lg font-semibold">Ảnh sản phẩm</h2>
          <input id="auction-image" name="image" type="file" accept="image/*" required onChange={handleImageChange} aria-labelledby="image-section-title" aria-invalid={Boolean(errors.image)} aria-describedby={errors.image ? 'image-error' : undefined} className="peer sr-only" />
          <label htmlFor="auction-image" className={`flex min-h-72 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-white p-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#688447] lg:min-h-96 ${errors.image ? 'border-[#a34539]' : 'border-[#182b25]/20'}`}>
            {imageFile && previewUrl ? (
              <Image src={previewUrl} alt="Ảnh sản phẩm đã chọn" width={640} height={480} unoptimized className="h-64 w-full object-contain lg:h-88" />
            ) : (
              <span className="rounded-md border border-[#234e3c]/30 px-4 py-2.5 text-sm font-medium text-[#234e3c]">Chọn ảnh sản phẩm</span>
            )}
          </label>
          {errors.image && <p id="image-error" role="alert" className="mt-2 text-sm text-[#a34539]">{errors.image}</p>}
          {imageFile && previewUrl && (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-1 break-all text-xs leading-6 text-[#64716a]">{imageFile.name}</p>
              <label htmlFor="auction-image" className="shrink-0 cursor-pointer text-sm font-medium text-[#234e3c] underline underline-offset-4">Chọn ảnh khác</label>
            </div>
          )}
        </section>
      </div>
      {user === null && (
        <p role="alert" className="mt-6 text-sm text-[#a34539]">
          Bạn cần <Link href="/login" className="font-medium underline underline-offset-4">đăng nhập</Link> để tạo phiên đấu giá.
        </p>
      )}
      {formError && <p role="alert" className="mt-6 text-sm text-[#a34539]">{formError}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#182b25]/10 pt-5 text-sm font-medium">
        <Link href="/auctions" className="rounded-md border border-[#182b25]/20 px-4 py-2.5 hover:bg-[#f0f2ed]">Hủy</Link>
        <button type="submit" disabled={submitting} className="rounded-md bg-[#234e3c] px-4 py-2.5 text-white hover:bg-[#163b2b] disabled:opacity-60">{submitting ? 'Đang tạo…' : 'Tạo phiên đấu giá'}</button>
      </div>
    </form>
  );
}
