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
Bật hệ thống (chạy nền):
```bash
docker compose up -d --build
```
Khi đang code, mở thêm 1 terminal để tự cập nhật code vào container (backend ~3 giây, frontend ~1 giây, không cần tắt/bật container):
```bash
docker compose watch
```
- `Ctrl + C` để tắt `watch`; các container vẫn chạy bình thường. Demo không cần `watch`.
- Vì sao không mount thư mục code như thường lệ: trên Windows, thư mục mount vào container không báo khi file thay đổi, phải bật chế độ quét file → chậm hơn (~10 giây) và frontend tốn gấp ~3 lần RAM. `watch` chép file vào container nên nhanh và nhẹ hơn.
- Đang chạy `watch` mà sửa `package.json` → tự build lại. Không chạy `watch` thì dùng lại `docker compose up -d --build`.
- Sửa `.env` → chạy lại `docker compose up -d` để nạp biến mới.
- Xem log: `docker compose logs -f backend` (hoặc `frontend`).
- Tắt: `docker compose down` (thêm `-v` nếu muốn xóa luôn dữ liệu DB và ảnh đã upload).

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3001 |
| Backend API (NestJS) | http://localhost:3000 |
| Swagger API Docs | http://localhost:3000/api/docs |
| PostgreSQL | localhost:5432 (admin/password123) |
| Redis | localhost:6379 |

### Dữ liệu demo
Khi database trống, backend tự tạo 10 phiên đấu giá mẫu (đang diễn ra / sắp diễn ra / đã kết thúc) và các tài khoản sau, mật khẩu đều là `123456`:

| Email | Vai trò trong dữ liệu mẫu |
|---|---|
| `an@bidwell.test` | Đã đặt giá nhiều phiên (đang dẫn đầu, bị vượt, thắng, thua) và có 2 phiên tự tạo |
| `binh@bidwell.test`, `chau@bidwell.test` | Người đặt giá khác, dùng để demo tranh giá |
| `shop@bidwell.test` | Người bán phần lớn sản phẩm |

Thời gian các phiên được tính **từ lúc tạo dữ liệu**, nên sau vài giờ các phiên "đang diễn ra" sẽ kết thúc. Trước khi demo, xóa dữ liệu cũ để tạo lại:
```bash
docker compose down -v
docker compose up -d --build
```
> `-v` xóa toàn bộ dữ liệu database và ảnh đã upload. Tắt tự tạo dữ liệu bằng `SEED_DEMO_DATA=false` trong `.env`.

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