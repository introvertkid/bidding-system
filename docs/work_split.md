# Phân chia công việc triển khai kiến trúc nâng cao

Tài liệu này chia việc triển khai 5 giải pháp trong [archtecture_specific.md](archtecture_specific.md) cho 3 thành viên. Mục tiêu là mỗi người làm **độc lập**, ít sửa chung file, và giảm tải cho Ly Nady trong thời gian ôn thi giữa kì.

**Phạm vi đã chốt:** code đủ 5 giải pháp, có **tiền cọc giả lập** (không tích hợp cổng thanh toán thật).

---

## 1. Tổng quan

| Người | Phạm vi | Ước lượng |
|---|---|---|
| **introvertkid** | Luồng đặt giá: commit khung + GP1, GP2, GP3, GP4 | ~4–5 buổi |
| **MINH TRUONG** | Luồng hậu đấu giá: GP5 (Saga + cọc) + sửa tài liệu | ~4–5 buổi |
| **Ly Nady** | Frontend, không nằm trên đường găng | ~2 buổi |

Thứ tự: **commit khung merge trước** → 3 người làm song song → **1 buổi ghép và test chung** theo mục 8 của tài liệu kiến trúc.

---

## 2. Commit khung (introvertkid, ~1 giờ, merge trước tiên)

Làm trước để sau đó không ai phải sửa chung file:

- `backend/package.json`: cài đủ `ioredis`, `bullmq`, `@nestjs/bullmq`, `@nestjs/schedule`, `nestjs-pino`. Không ai thêm dependency riêng sau đó nếu không báo nhóm.
- `RedisModule` dùng chung (đọc `REDIS_HOST`, `REDIS_PORT`).
- `DepositGuard` stub (luôn trả `true`), gắn sẵn vào route `POST /api/v1/auctions/:auctionId/bids`.
- Đăng ký sẵn các module rỗng trong `app.module.ts`: `OutboxModule`, `CacheModule`, `DepositsModule`, `SettlementModule`.

---

## 3. introvertkid — Luồng đặt giá (GP1–4)

Sở hữu: `bids/`, `auctions.service.ts` (phần đọc), `common/`, `main.ts`, `outbox/`, `cache/`.

**GP1 – Correlation ID**
- `CorrelationIdMiddleware`: đọc `X-Correlation-ID` hoặc tạo UUID, lưu vào `AsyncLocalStorage`, trả lại trong response header.
- Logger JSON (`nestjs-pino`) có trường `correlationId`.
- Lưu `correlation_id` vào bảng outbox để relay/worker lấy lại (worker chạy ngoài request nên không có ALS).

**GP2 – Idempotency Key**
- `IdempotencyInterceptor`: key `idempotency:<userId>:<key>`, `SET NX EX` cho `IN_PROGRESS`, lưu `COMPLETED` + response, lưu fingerprint body.
- Cùng key khác payload → `422`. Đang xử lý → `409`.
- Chốt rõ: lỗi 4xx nghiệp vụ được cache hay xóa key.
- Tuỳ chọn: unique `(bidder_id, idempotency_key)` trong bảng `bids` để chặn trường hợp crash sau commit.

**GP3 – Transactional Outbox**
- Entity `outbox_events` (thêm cột `correlation_id`), ghi trong cùng transaction với update Auction + insert Bid.
- Relay worker quét `PENDING` bằng `FOR UPDATE SKIP LOCKED`, push BullMQ với `jobId = outbox.id` để chống trùng, có số lần retry tối đa trước khi `FAILED`.
- Consumer broadcast Socket.io (`auction_updated`, `outbid_alert`), chuyển phần emit hiện tại ra khỏi `bids.service.ts`.
- Ghi rõ khoảng polling (ví dụ 200–500ms). Nếu worker chạy process riêng thì cần `@socket.io/redis-adapter`.

**GP4 – Cache-Aside**
- `AuctionCacheService`, key `cache:auction:{id}`, chỉ cache **dữ liệu thô** (giá, người dẫn đầu, `endTime`, `version`…), tính `status`/`remainingMinutes`/`minNextBid` lúc đọc.
- Consumer `BID_PLACED` cập nhật cache **chỉ khi version mới lớn hơn** (Lua script) để tránh ghi đè sai thứ tự.
- `GET /api/v1/auctions/:id` đọc cache, miss thì query DB rồi nạp lại.

---

## 4. MINH TRUONG — Luồng hậu đấu giá (GP5) + tài liệu

Sở hữu: `deposits/`, `invoices/`, `settlements/`, `auction.entity.ts`, `docs/`.

**Việc đầu tiên: chốt API và event cho Ly** (để Ly dựng giao diện với dữ liệu giả):

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/auctions/:id/deposits` | Đặt cọc giả lập để tham gia phiên |
| GET | `/api/v1/me/invoices` | Hóa đơn của tôi |
| POST | `/api/v1/invoices/:id/pay` | Thanh toán giả lập |
| GET | `/api/v1/me/offers` | Lời mời mua (runner-up) |
| POST | `/api/v1/offers/:id/accept` | Nhận lời mời |
| POST | `/api/v1/offers/:id/decline` | Từ chối lời mời |

Socket events: `auction_ended`, `offer_received` (tên có thể đổi, nhưng phải báo Ly).

**GP5 – Saga + cọc**
- Bảng `deposits` (`HELD` / `REFUNDED` / `FORFEITED`), viết ruột `DepositGuard` (chưa cọc thì không được bid).
- Cron đóng phiên: quét `ACTIVE` có `end_time < now` (vì anti-sniper có thể đổi `endTime`) → `ENDED` + tạo invoice + hoàn cọc người thua, hoặc `FAILED` nếu không ai bid.
- Bỏ ràng buộc `OneToOne` giữa Invoice và Auction (runner-up cần invoice thứ hai).
- Bảng `settlements` lưu state Saga (enum Auction hiện không có các state `INVOICE_PENDING`, `SETTLED`…).
- Cron quá hạn: phạt cọc người thắng + hủy invoice + ghi vi phạm, rồi tạo `offers` cho runner-up hợp lệ (khác người thắng, không bị khóa), có hạn chót.
- Xử lý cả nhánh runner-up **từ chối hoặc hết hạn** → mời người kế tiếp, hết người thì `FAILED`.
- Thông báo realtime gọi thẳng `AuctionGateway`, không đi qua outbox.
- Thống nhất chính sách: quá hạn có `BANNED` hay không (`database_schema.md` đang ghi có, đề xuất ghi "tùy chính sách").

**Sửa tài liệu `archtecture_specific.md`** theo review:
- Sơ đồ 1.3: API ghi vào outbox, không gọi thẳng `addJob`.
- Thêm `correlation_id` vào bảng outbox.
- Thêm kiểm tra version khi cập nhật cache; cache dữ liệu thô thay vì view.
- Bổ sung case `422` và chính sách lỗi 4xx cho idempotency.
- Ví dụ WHY của GP2: code hiện đã chặn người dẫn đầu tự bid tiếp, nên retry gây lỗi 400 khó hiểu chứ không tự nâng giá.
- Sửa endpoint thành `/api/v1/auctions/:auctionId/bids`.
- Thêm phần cọc giả lập, bảng `settlements`, nhánh runner-up từ chối.

---

## 5. Ly Nady — Frontend (không ai phải chờ)

Sở hữu: các file trong `frontend/` liên quan dưới đây. Làm lúc nào rảnh cũng được; backend vẫn demo được qua Swagger nếu phần này xong muộn.

- `bid-panel`: tạo `Idempotency-Key` (`crypto.randomUUID()`) mỗi lần bấm đặt giá, **dùng lại cùng key khi retry** (~1 giờ).
- Nút **đặt cọc** trên trang chi tiết phiên.
- Trang **"Hóa đơn của tôi"** có nút thanh toán.
- Giao diện **nhận / từ chối lời mời** runner-up.
- Hiển thị thông báo realtime `auction_ended`, `offer_received`.

Dựng trước bằng dữ liệu giả theo bảng API ở mục 4, khi Minh xong backend thì chuyển sang gọi API thật.

**Phương án dự phòng:** nếu Ly thi xong sau buổi ghép và test chung, chuyển phần trang cọc / hóa đơn / lời mời sang Minh; Ly giữ việc `Idempotency-Key` và review giao diện.

---

## 6. Quy ước để làm độc lập

- Mỗi người chỉ sửa file trong phạm vi của mình. Cần sửa file của người khác thì báo trước trong nhóm.
- Mỗi người làm trên nhánh riêng, mở PR vào `main`.
- Mỗi người tự viết test cho kịch bản thuộc phần mình ở mục 8 của tài liệu kiến trúc.
