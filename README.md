# Online Bidding System (Hệ thống Đấu giá Trực tuyến)

## Tech Stack
- **Frontend:** Next.js, TailwindCSS
- **Backend:** NestJS, TypeORM
- **Database & Cache:** PostgreSQL, Redis

## Yêu cầu môi trường
- Node.js (v18 hoặc v20)
- Docker & Docker Compose

## Hướng dẫn cài đặt và chạy dự án

### 1. Cấu hình biến môi trường
Copy file `.env.example` thành `.env` ở thư mục gốc:
```bash
# Windows
copy .env.example .env
# Mac/Linux
cp .env.example .env
```

### 2. Chạy toàn bộ bằng Docker (khuyên dùng)
```bash
docker compose up --build --watch
```
- Lần đầu build mất ~2 phút, các lần sau vài giây (đã cache dependencies).
- **Hot reload:** sửa code trong `backend/src`, `frontend/src`, `frontend/public` sẽ tự cập nhật vào container, không cần tắt/bật lại.
- Sửa `package.json` (thêm thư viện) → container tự build lại.
- Sửa `.env` → chạy lại `docker compose up -d` để nạp biến mới.
- Muốn chạy nền không cần hot reload: `docker compose up -d --build`.
- Tắt: `Ctrl + C` rồi `docker compose down` (thêm `-v` nếu muốn xóa luôn dữ liệu DB).

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3001 |
| Backend API (NestJS) | http://localhost:3000 |
| Swagger API Docs | http://localhost:3000/api/docs |
| PostgreSQL | localhost:5432 (admin/password123) |
| Redis | localhost:6379 |

### 3. (Tuỳ chọn) Chạy tay không dùng Docker cho BE/FE
Chỉ bật DB và Redis bằng Docker:
```bash
docker compose up -d postgres redis
```
Backend (terminal 1):
```bash
cd backend
npm install
npm run start:dev
```
Frontend (terminal 2):
```bash
cd frontend
npm install
npm run dev
```
> Lưu ý: không chạy song song cách này với `docker compose up` vì trùng port 3000/3001.

## Cấu trúc thư mục chính
- `/docs`: Tài liệu phân tích thiết kế, database schema, spec nghiệp vụ.
- `/frontend`: Source code giao diện web (Next.js).
- `/backend`: Source code xử lý logic, API (NestJS).
- `docker-compose.yml`: Chạy toàn bộ hệ thống (Postgres, Redis, Backend, Frontend).
- `backend/Dockerfile`, `frontend/Dockerfile`: Multi-stage build (`dev` cho phát triển, `prod` cho production).