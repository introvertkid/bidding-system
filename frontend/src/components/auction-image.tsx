"use client";

import Image from 'next/image';
import { useState } from 'react';

export default function AuctionImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) {
    return <div role="img" aria-label={alt} className="flex h-full w-full items-center justify-center bg-[#e8ebdf] px-6 text-center text-sm text-[#64716a]">Ảnh sản phẩm đang được cập nhật</div>;
  }
  // Ảnh upload được proxy từ backend nên không qua bộ tối ưu ảnh của Next.js
  return <Image src={src} alt={alt} fill sizes={sizes} unoptimized={src.startsWith('/uploads/')} className="object-contain p-6" onError={() => setFailedSource(src)} />;
}
