# Online Bidding System (Hệ thống Đấu giá Trực tuyến)

## Tech Stack
- **Frontend:** Next.js, TailwindCSS
- **Backend:** NestJS, TypeORM
- **Database & Cache:** PostgreSQL, Redis

## Yêu cầu môi trường
- Node.js (v18 hoặc v20)
- Docker & Docker Compose

## Hướng dẫn cài đặt và chạy dự án

### 1. Khởi chạy Database
Mở terminal tại thư mục gốc của dự án, chạy lệnh:
```bash
docker-compose up -d
```
> Database PostgreSQL sẽ chạy ở port 5432 (admin/password123). Redis chạy ở port 6379.

### 2. Cấu hình biến môi trường
Copy file `.env.example` thành `.env` ở thư mục gốc:
```bash
# Windows
copy .env.example .env
# Mac/Linux
cp .env.example .env
```

### 3. Khởi chạy Backend
Mở terminal mới:
```bash
cd backend
npm install
npm run start:dev
```
> API Server chạy tại: http://localhost:3000
> Swagger API Docs: http://localhost:3000/api/docs

### 4. Khởi chạy Frontend
Mở terminal mới:
```bash
cd frontend
npm install
npm run dev
```
> Web App chạy tại: http://localhost:3001 (hoặc 3000)

## Cấu trúc thư mục chính
- `/docs`: Tài liệu phân tích thiết kế, database schema, spec nghiệp vụ.
- `/frontend`: Source code giao diện web (Next.js).
- `/backend`: Source code xử lý logic, API (NestJS).
- `docker-compose.yml`: Script khởi tạo DB và Redis.