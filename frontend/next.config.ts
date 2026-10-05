import type { NextConfig } from "next";
import { config } from "dotenv";
import { join } from "path";

// Đọc file .env từ thư mục gốc của dự án (bidding-system/.env)
config({ path: join(process.cwd(), '..', '.env') });

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  // Build gọn để chạy production trong Docker (chỉ copy file cần thiết)
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Trình duyệt gọi /api/v1 và /uploads cùng origin, Next.js chuyển tiếp sang backend (không cần CORS)
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${backendUrl}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${backendUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
