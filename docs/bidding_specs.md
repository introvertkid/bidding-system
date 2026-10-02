# Đặc tả Nghiệp vụ Cốt lõi (Bidding Specifications)

Tài liệu này mô tả chi tiết luật chơi, luồng xử lý và API Contract cho chức năng quan trọng nhất: **Tham gia đặt giá (Bidding Engine)**.

---

## 1. Luật Đấu Giá Tiêu Chuẩn (Dựa trên eBay & Sotheby's)

Để hệ thống mang tính thực tế cao, Business Logic sẽ áp dụng các tiêu chuẩn của các sàn đấu giá lớn trên thế giới:

1. **Đấu giá Tự động (Proxy Bidding / Automatic Bidding):**
   - Người dùng không cần liên tục canh màn hình để nâng từng bước giá. Họ chỉ cần nhập **Giá tối đa (Maximum Bid)** mà họ sẵn sàng trả (bảo mật, không ai thấy).
   - Hệ thống (Proxy) sẽ đóng vai trò đại diện, tự động nâng giá lên mức tối thiểu đủ để họ giữ vị trí dẫn đầu (`current_price + bid_increment`).
   - *Ví dụ:* Giá hiện tại là $10. Bước giá $1. User A nhập max bid là $50. Hệ thống hiển thị giá mới là $11 (User A dẫn đầu). User B vào nhập max bid là $20. Hệ thống ngay lập tức đẩy giá lên $21 cho User A (vì A sẵn sàng trả tới $50).

2. **Bước giá động (Dynamic Bid Increments):**
   - Bước giá không nên là một số cố định (ví dụ 10.000đ). Ở các hệ thống lớn, bước giá tăng dần theo giá trị sản phẩm.
   - *Quy tắc mẫu:*
     - Từ 0đ - 100.000đ: Bước giá 5.000đ
     - Từ 100.000đ - 1.000.000đ: Bước giá 20.000đ
     - Trên 1.000.000đ: Bước giá 100.000đ

3. **Giá Lưu Kho / Giá Sàn (Reserve Price):**
   - Là mức giá tối thiểu được ẩn đi mà người bán (Seller) muốn nhận được. 
   - Nếu kết thúc phiên đấu giá, người trả giá cao nhất (Highest Bid) vẫn chưa vượt qua `Reserve Price`, phiên đấu giá đó được tính là **Thất bại (Unsold)** và người bán không có nghĩa vụ phải bán.

4. **Giá Mua Ngay (Buy It Now - BIN):**
   - Một số sản phẩm cho phép người mua trả một giá cố định để sở hữu ngay lập tức.
   - *Luật:* Nút "Buy It Now" sẽ biến mất ngay khi có người đầu tiên đặt giá (Bid) hợp lệ, hoặc khi giá đấu vượt qua một mức nào đó.

5. **Luật Chống Bắn Tỉa (Anti-Sniper / Popcorn Bidding):**
   - Rất nhiều người dùng dùng bot để đặt giá vào đúng 1 giây cuối cùng (Sniping) khiến người khác không kịp trở tay.
   - *Giải pháp:* Nếu có bất kỳ một lượt đặt giá nào diễn ra trong vòng **1 phút cuối cùng**, đồng hồ đếm ngược sẽ tự động reset về lại **đúng 1 phút (hoặc 3 phút)**. Phiên đấu chỉ kết thúc khi không còn ai tranh giành nữa. (eBay không dùng luật này, nhưng các sàn đấu giá nghệ thuật, bất động sản luôn dùng để tối đa hóa lợi nhuận).

6. **Rút lại giá (Bid Retraction):**
   - Nghiêm cấm rút lại giá, trừ trường hợp đặc biệt (Gõ nhầm số 100k thành 1 triệu) nhưng phải diễn ra trước 12 tiếng trước khi phiên kết thúc. Trong hệ thống bài tập, ta sẽ **Không cho phép hủy Bid**.


---

## 2. Đặc tả API Đặt Giá (REST API)

### `POST /api/v1/auctions/{auctionId}/bids`
Endpoint để gửi yêu cầu đặt giá (Bid).

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>`

**Request Body:**
```json
{
  "amount": 150000 
}
```

**Luồng Xử Lý Nội Bộ (Backend Flow):**
1. Xác thực JWT, lấy `userId`. Kiểm tra trạng thái tài khoản.
2. Query Cache (Redis) xem `auctionId` có đang `ACTIVE` không.
3. So sánh `amount` với `current_price + bid_increment` trong Redis. Nếu nhỏ hơn -> Trả về lỗi `400 Bad Request` ngay lập tức.
4. Nếu giá hợp lệ, đẩy dữ liệu vào Database bằng SQL Transaction + Optimistic Locking (`version`).
5. Nếu Database báo lỗi `version` không khớp (Tức là có người khác vừa bid nhanh hơn) -> Trả về lỗi `409 Conflict`.
6. Nếu Database lưu thành công -> Cập nhật `current_price` mới vào Redis.
7. Trigger sự kiện qua WebSockets để báo cho các User khác.
8. Trả kết quả về cho người dùng.

**Response - Thành công (201 Created):**
```json
{
  "status": "success",
  "message": "Placed bid successfully",
  "data": {
    "bidId": "uuid-...",
    "amount": 150000,
    "createdAt": "2026-10-02T15:30:00Z"
  }
}
```

**Response - Bị thay đổi giá (409 Conflict):**
```json
{
  "status": "error",
  "message": "Giá sản phẩm vừa bị người khác thay đổi. Vui lòng tải lại và thử lại!"
}
```

---

## 3. Đặc tả Thời gian thực (WebSockets / Socket.io)

Để khách hàng thấy giá nhảy liên tục mà không cần tải lại trang F5.

**1. Tham gia phòng (Join Room):**
Khi mở trang chi tiết sản phẩm `A`, Client gửi event `join_auction` để vào room.
- `Client -> Server`: `emit('join_auction', { auctionId: 'A' })`

**2. Nhận cập nhật giá mới (Receive Bid Update):**
Bất cứ khi nào có 1 người đặt giá thành công ở API `POST /bids`, Server sẽ broadcast xuống tất cả client trong room `A`.
- `Server -> Client`: `emit('auction_updated', data)`
```json
// Dữ liệu Server gửi xuống (data)
{
  "currentPrice": 150000,
  "highestBidderName": "Nguyễn V*** A*", // Che dấu tên thật
  "totalBids": 14,
  "endTime": "2026-10-05T10:00:00Z" // Có thể bị cộng thêm do Anti-Sniper
}
```

**3. Cảnh báo bị vượt mặt (Outbid Alert):**
Nếu User X đang là người giữ giá cao nhất, nhưng User Y vừa đặt giá cao hơn, Server gửi riêng (private message) cho User X một cảnh báo.
- `Server -> Client (Chỉ người thua)`: `emit('outbid_alert', { auctionId: 'A', productName: '...' })`
