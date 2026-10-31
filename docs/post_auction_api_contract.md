# Tài Liệu Đặc Tả API & WebSocket Luồng Hậu Đấu Giá (Post-Auction & Settlement Contract)

Tài liệu này quy chuẩn toàn bộ **REST API Endpoints** và **WebSocket Realtime Events** cho luồng hậu đấu giá (GP5 - Saga), tiền cọc giả lập (`deposits`), hóa đơn (`invoices`), và lời mời mua dành cho Á quân (`offers`).

> **Mục tiêu:** Cung cấp tài liệu chi tiết, chuẩn xác để Frontend (Ly Nady) tích hợp giao diện, hỗ trợ mock data hoặc gọi API thật; đồng thời làm căn cứ kiểm thử và bàn giao giữa các thành viên.

---

## 1. Thông Tin Chung

* **Base URL:** `http://localhost:3000/api/v1`
* **Content-Type:** `application/json`
* **Authentication:** `Bearer Token` (Header: `Authorization: Bearer <access_token>`)
* **Định dạng phản hồi chung:**
  * **Thành công (Success):**
    ```json
    {
      "status": "success",
      "message": "Thông báo ngắn (nếu có)",
      "data": { ... }
    }
    ```
  * **Thất bại (Error):**
    ```json
    {
      "statusCode": 400,
      "message": "Nội dung lỗi chi tiết",
      "error": "Tên mã lỗi HTTP"
    }
    ```

---

## 2. Bảng Tổng Hợp Endpoints

| STT | Phương thức | Đường dẫn (Endpoint) | Quyền | Mục đích |
|---|---|---|---|---|
| **1** | `POST` | `/api/v1/auctions/:id/deposits` | BIDDER, SELLER | Đặt cọc giả lập để tham gia đấu giá |
| **2** | `GET` | `/api/v1/auctions/:id/deposits/me` | Logged in | Xem trạng thái tiền cọc của tôi tại phiên |
| **3** | `GET` | `/api/v1/me/invoices` | Logged in | Lấy danh sách tất cả hóa đơn của tôi |
| **4** | `POST` | `/api/v1/invoices/:id/pay` | Người thắng | Thanh toán hóa đơn giả lập |
| **5** | `GET` | `/api/v1/me/offers` | Logged in | Lấy danh sách lời mời mua dành cho Á quân |
| **6** | `POST` | `/api/v1/offers/:id/accept` | Á quân nhận offer | Chấp nhận mua sản phẩm theo giá bid của mình |
| **7** | `POST` | `/api/v1/offers/:id/decline` | Á quân nhận offer | Từ chối lời mời mua |

---

## 3. Chi Tiết Các REST API Endpoints

### 3.1. Phân Hệ Tiền Cọc (`deposits`)

#### 1. Đặt cọc tham gia phiên đấu giá
* **Endpoint:** `POST /api/v1/auctions/:id/deposits`
* **Mô tả:** Khóa/tạm giữ tiền cọc giả lập (`status: HELD`) để người dùng đủ điều kiện vượt qua `DepositGuard` khi gọi `POST /api/v1/auctions/:id/bids`. Nếu không truyền số tiền, hệ thống mặc định lấy **10% giá khởi điểm** (tối thiểu `50.000đ`).
* **Path Parameters:**
  * `id` *(UUID, bắt buộc)*: ID của phiên đấu giá.
* **Headers:**
  * `Authorization: Bearer <token>`
* **Request Body (Tùy chọn):**
  ```json
  {
    "amount": 1000000
  }
  ```
* **Response Thành công (`201 Created`):**
  ```json
  {
    "status": "success",
    "message": "Đặt cọc tham gia phiên đấu giá thành công",
    "data": {
      "id": "7f8b871c-7203-4966-9aa9-94b9148d4881",
      "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
      "userId": "a8b94157-1906-4fe4-aa34-1188d6c8b9a2",
      "amount": 1000000,
      "status": "HELD",
      "createdAt": "2026-10-31T08:00:00.000Z",
      "updatedAt": "2026-10-31T08:00:00.000Z"
    }
  }
  ```
* **Mã lỗi thường gặp:**
  * `400 Bad Request`: Phiên đấu giá không ở trạng thái `UPCOMING` hoặc `ACTIVE`.
  * `404 Not Found`: Không tìm thấy phiên đấu giá với `id` truyền vào.
  * `409 Conflict`: Người dùng đã có khoản cọc trạng thái `HELD` cho phiên này.

---

#### 2. Kiểm tra trạng thái cọc của tôi
* **Endpoint:** `GET /api/v1/auctions/:id/deposits/me`
* **Mô tả:** Giúp Frontend kiểm tra người dùng đã cọc cho phiên này chưa để bật/tắt nút **"Đặt cọc"** hoặc mở khóa form đặt giá.
* **Path Parameters:**
  * `id` *(UUID, bắt buộc)*: ID phiên đấu giá.
* **Response Thành công (`200 OK`):**
  * *Trường hợp đã cọc:*
    ```json
    {
      "status": "success",
      "data": {
        "id": "7f8b871c-7203-4966-9aa9-94b9148d4881",
        "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
        "userId": "a8b94157-1906-4fe4-aa34-1188d6c8b9a2",
        "amount": 1000000,
        "status": "HELD",
        "createdAt": "2026-10-31T08:00:00.000Z",
        "updatedAt": "2026-10-31T08:00:00.000Z"
      }
    }
    ```
  * *Trường hợp chưa cọc:*
    ```json
    {
      "status": "success",
      "data": null
    }
    ```

---

### 3.2. Phân Hệ Hóa Đơn (`invoices`)

#### 3. Danh sách hóa đơn của tôi
* **Endpoint:** `GET /api/v1/me/invoices`
* **Mô tả:** Lấy toàn bộ hóa đơn của người dùng đăng nhập hiện tại, sắp xếp theo thời gian tạo mới nhất. Trả về kèm thông tin phiên đấu giá và sản phẩm (`auction.product`).
* **Headers:**
  * `Authorization: Bearer <token>`
* **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "c138f972-2c09-497d-aa53-b26a6dbb4a39",
        "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
        "winnerId": "a8b94157-1906-4fe4-aa34-1188d6c8b9a2",
        "amount": 18500000,
        "status": "PENDING",
        "dueDate": "2026-11-03T08:00:00.000Z",
        "paidAt": null,
        "createdAt": "2026-10-31T08:00:00.000Z",
        "updatedAt": "2026-10-31T08:00:00.000Z",
        "auction": {
          "id": "b1a64da8-4447-4952-ba63-548c773998b3",
          "status": "ENDED",
          "currentPrice": 18500000,
          "product": {
            "id": "f5e93c12-3209-4112-984e-7b56a9db3f10",
            "title": "MacBook Air M2 16GB / 512GB",
            "images": ["/images/auctions/macbook.jpg"]
          }
        }
      }
    ]
  }
  ```

---

#### 4. Thanh toán hóa đơn giả lập
* **Endpoint:** `POST /api/v1/invoices/:id/pay`
* **Mô tả:** Người trúng đấu giá thực hiện thanh toán. Khi thanh toán thành công:
  - Hóa đơn chuyển trạng thái sang `PAID` kèm mốc thời gian `paidAt`.
  - Tiến trình Saga (`Settlement`) chuyển trạng thái sang `SETTLED` (`step: COMPLETED`).
  - Tiền cọc của người thắng được tự động hoàn trả (`status: REFUNDED`).
* **Path Parameters:**
  * `id` *(UUID, bắt buộc)*: ID của hóa đơn.
* **Headers:**
  * `Authorization: Bearer <token>`
* **Request Body:** Không cần body (`{}`).
* **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Thanh toán hóa đơn thành công",
    "data": {
      "id": "c138f972-2c09-497d-aa53-b26a6dbb4a39",
      "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
      "winnerId": "a8b94157-1906-4fe4-aa34-1188d6c8b9a2",
      "amount": 18500000,
      "status": "PAID",
      "dueDate": "2026-11-03T08:00:00.000Z",
      "paidAt": "2026-10-31T08:15:00.000Z",
      "createdAt": "2026-10-31T08:00:00.000Z",
      "updatedAt": "2026-10-31T08:15:00.000Z"
    }
  }
  ```
* **Mã lỗi thường gặp:**
  * `403 Forbidden`: Người dùng hiện tại không phải là chủ nhân hóa đơn (`winnerId != currentUserId`).
  * `404 Not Found`: Không tìm thấy hóa đơn.
  * `400 Bad Request`:
    - Hóa đơn đã được thanh toán trước đó (`status == PAID`).
    - Hóa đơn đã bị hủy do quá hạn (`status == CANCELED`).
    - Hóa đơn đã quá thời hạn thanh toán (`now > dueDate`).

---

### 3.3. Phân Hệ Lời Mời Mua Cho Á Quân (`offers`)

#### 5. Lấy danh sách lời mời mua của tôi
* **Endpoint:** `GET /api/v1/me/offers`
* **Mô tả:** Dành cho người về nhì/ba (Runner-up) kiểm tra xem mình có nhận được đề nghị mua món hàng khi người thắng cuộc trước đó bùng hàng hay không.
* **Headers:**
  * `Authorization: Bearer <token>`
* **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "d4e21a78-4567-4890-a123-b456c789d012",
        "settlementId": "e1234567-89ab-cdef-0123-456789abcdef",
        "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
        "bidderId": "b2c3d4e5-6789-0123-4567-89abcdef0123",
        "bidId": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
        "offeredPrice": 18300000,
        "status": "PENDING",
        "expiresAt": "2026-11-01T08:00:00.000Z",
        "createdAt": "2026-10-31T08:00:00.000Z",
        "updatedAt": "2026-10-31T08:00:00.000Z",
        "auction": {
          "id": "b1a64da8-4447-4952-ba63-548c773998b3",
          "product": {
            "id": "f5e93c12-3209-4112-984e-7b56a9db3f10",
            "title": "MacBook Air M2 16GB / 512GB",
            "images": ["/images/auctions/macbook.jpg"]
          }
        }
      }
    ]
  }
  ```

---

#### 6. Chấp nhận lời mời mua sản phẩm
* **Endpoint:** `POST /api/v1/offers/:id/accept`
* **Mô tả:** Á quân đồng ý mua sản phẩm với mức giá mình đã đặt trước đó (`offeredPrice`).
  - Lời mời chuyển trạng thái sang `ACCEPTED`.
  - Phiên đấu giá cập nhật `highestBidderId = runnerUp.id` và `currentPrice = offer.offeredPrice`.
  - Hệ thống tự động sinh hóa đơn (`Invoice`) mới cho Á quân với thời hạn 3 ngày thanh toán.
* **Path Parameters:**
  * `id` *(UUID, bắt buộc)*: ID của lời mời mua (`offer.id`).
* **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Đã chấp nhận lời mời mua sản phẩm thành công",
    "data": {
      "offer": {
        "id": "d4e21a78-4567-4890-a123-b456c789d012",
        "status": "ACCEPTED"
      },
      "invoice": {
        "id": "a9876543-210f-edcb-a987-6543210fedcb",
        "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
        "winnerId": "b2c3d4e5-6789-0123-4567-89abcdef0123",
        "amount": 18300000,
        "status": "PENDING",
        "dueDate": "2026-11-03T08:30:00.000Z",
        "createdAt": "2026-10-31T08:30:00.000Z"
      }
    }
  }
  ```
* **Mã lỗi thường gặp:**
  * `403 Forbidden`: Người dùng hiện tại không phải là người nhận lời mời (`bidderId != currentUserId`).
  * `404 Not Found`: Không tìm thấy lời mời.
  * `400 Bad Request`: Lời mời đã được xử lý hoặc đã quá hạn (`now > expiresAt`).

---

#### 7. Từ chối lời mời mua sản phẩm
* **Endpoint:** `POST /api/v1/offers/:id/decline`
* **Mô tả:** Á quân từ chối nhận mua sản phẩm.
  - Lời mời chuyển trạng thái sang `DECLINED`.
  - Hệ thống tự động kích hoạt thuật toán tìm kiếm người trả giá cao tiếp theo trong danh sách `bids`.
  - Nếu tìm thấy: tự động sinh `Offer` mới gửi cho người kế tiếp.
  - Nếu không còn ai khác: chuyển trạng thái phiên sang `FAILED`.
* **Path Parameters:**
  * `id` *(UUID, bắt buộc)*: ID của lời mời mua.
* **Response Thành công (`200 OK`):**
  ```json
  {
    "status": "success",
    "message": "Đã từ chối lời mời mua thành công",
    "data": {
      "message": "Đã từ chối lời mời mua thành công",
      "hasNextRunnerUp": true
    }
  }
  ```

---

## 4. WebSocket Realtime Events (`AuctionGateway`)

Giao thức Socket.io được cấu hình qua Gateway `@WebSocketGateway({ cors: { origin: true } })`.

### 4.1. Cơ chế xác thực & Tham gia Room
1. **Kết nối có xác thực:**
   Client gửi JWT token lúc kết nối qua handshake auth:
   ```javascript
   const socket = io("http://localhost:3000", {
     auth: { token: "<JWT_ACCESS_TOKEN>" }
   });
   ```
   *Khi token hợp lệ, Gateway tự động đưa client vào room riêng tư: `user:{userId}`.*

2. **Tham gia phòng đấu giá (Join Room):**
   ```javascript
   socket.emit('join_auction', { auctionId: 'b1a64da8-4447-4952-ba63-548c773998b3' });
   ```

---

### 4.2. Các sự kiện Server phát xuống Client

#### A. Sự kiện `auction_ended` (Phát sóng tới room `auction:{auctionId}`)
Phát khi phiên đấu giá kết thúc thành công hoặc thất bại:
```json
{
  "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
  "status": "ENDED",
  "winnerId": "a8b94157-1906-4fe4-aa34-1188d6c8b9a2",
  "finalPrice": 18500000
}
```
*(Nếu thất bại: `status: "FAILED"`, không có winnerId).*

#### B. Sự kiện `offer_received` (Phát riêng tới room `user:{userId}`)
Phát khi Á quân nhận được lời mời mua sản phẩm do người trước bùng hàng:
```json
{
  "offerId": "d4e21a78-4567-4890-a123-b456c789d012",
  "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
  "productName": "MacBook Air M2 16GB / 512GB",
  "offeredPrice": 18300000,
  "expiresAt": "2026-11-01T08:00:00.000Z"
}
```

#### C. Sự kiện `invoice_created` (Phát riêng tới room `user:{userId}`)
Phát cho người trúng đấu giá / Á quân chấp nhận mua khi hóa đơn được sinh ra:
```json
{
  "invoiceId": "c138f972-2c09-497d-aa53-b26a6dbb4a39",
  "auctionId": "b1a64da8-4447-4952-ba63-548c773998b3",
  "amount": 18500000,
  "dueDate": "2026-11-03T08:00:00.000Z"
}
```

---

## 5. Bảng Tham Chiếu Trạng Thái (Enums Reference)

### `DepositStatus`
* `HELD`: Tiền cọc đang bị tạm giữ (điều kiện để được tham gia đặt giá).
* `REFUNDED`: Đã hoàn tiền cọc (dành cho người thua khi phiên đóng, hoặc người thắng sau khi đã thanh toán hóa đơn đầy đủ).
* `FORFEITED`: Bị tịch thu tiền cọc làm phí phạt (người thắng bùng hàng quá 3 ngày).

### `InvoiceStatus`
* `PENDING`: Đang chờ thanh toán (thời hạn 3 ngày kể từ lúc tạo).
* `PAID`: Đã thanh toán thành công.
* `CANCELED`: Hóa đơn bị hủy do người mua quá hạn thanh toán.

### `SettlementStatus` (Saga State)
* `INVOICE_PENDING`: Đã kết thúc phiên, hóa đơn đang chờ người thắng/á quân thanh toán.
* `SETTLED`: Toàn bộ quy trình hoàn tất thành công, hàng đã được thanh toán.
* `FALLBACK_RUNNER_UP`: Người trước vi phạm, đang kích hoạt quy trình mời Á quân.
* `FAILED`: Phiên thất bại (không có ai bid, hoặc tất cả Á quân đều từ chối/hết hạn).

### `OfferStatus`
* `PENDING`: Đang chờ Á quân phản hồi (thời hạn 24 giờ).
* `ACCEPTED`: Á quân đã đồng ý mua.
* `DECLINED`: Á quân đã từ chối mua.
* `EXPIRED`: Quá 24 giờ mà Á quân không phản hồi.
