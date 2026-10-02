import type { NextConfig } from "next";
import { config } from "dotenv";
import { join } from "path";

// Đọc file .env từ thư mục gốc của dự án (bidding-system/.env)
config({ path: join(process.cwd(), '..', '.env') });

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
