# Thiết kế Cơ sở Dữ liệu (Database Schema) - Đã Đơn Giản Hóa

Dưới đây là thiết kế chi tiết các bảng trong cơ sở dữ liệu **PostgreSQL** cho hệ thống đấu giá, tập trung tối đa vào nghiệp vụ đấu giá (Bidding Engine) và lược bỏ các hệ thống tài chính phức tạp (Ví nội bộ) để phù hợp với quy mô bài tập lớn.

## 1. Sơ đồ Thực thể Liên kết (ER Diagram)

```mermaid
erDiagram
    USERS ||--o{ PRODUCTS : "đăng bán"
    USERS ||--o{ BIDS : "đặt giá"
    USERS ||--o{ INVOICES : "thanh toán"
    
    CATEGORIES ||--o{ PRODUCTS : "chứa"
    
    PRODUCTS ||--|| AUCTIONS : "thuộc về"
    
    AUCTIONS ||--o{ BIDS : "nhận"
    AUCTIONS ||--|| INVOICES : "tạo ra"

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string phone
        enum role "ADMIN, SELLER, BIDDER"
        enum account_status "ACTIVE, BANNED" "Khóa nếu bùng hàng"
        float rating_score "Điểm uy tín"
    }

    CATEGORIES {
        int id PK
        string name
        int parent_id FK
    }

    PRODUCTS {
        uuid id PK
        uuid seller_id FK
        int category_id FK
        string title
        text description
        jsonb images "Mảng URL hình ảnh"
        timestamp created_at
    }

    AUCTIONS {
        uuid id PK
        uuid product_id FK
        enum status "DRAFT, UPCOMING, ACTIVE, ENDED, FAILED, CANCELED"
        timestamp start_time
        timestamp end_time
        decimal starting_price "Giá khởi điểm"
        decimal bid_increment "Bước giá tối thiểu"
        decimal current_price "Giá cao nhất hiện tại"
        uuid highest_bidder_id FK "Người đang trả cao nhất"
        int version "Dùng cho Optimistic Locking"
    }

    BIDS {
        uuid id PK
        uuid auction_id FK
        uuid bidder_id FK
        decimal amount "Số tiền đặt"
        timestamp created_at "Thời gian đặt"
        enum status "VALID, OUTBID, WINNING"
    }

    INVOICES {
        uuid id PK
        uuid auction_id FK
        uuid winner_id FK
        decimal amount "Số tiền cần thanh toán"
        enum status "PENDING, PAID, CANCELED"
        timestamp due_date "Hạn chót thanh toán"
        timestamp created_at
    }
```

---

## 2. Giải thích chi tiết các Bảng cốt lõi

### Bảng `USERS` (Người dùng)
Lưu trữ thông tin của hệ thống, phân biệt qua cột `role` (ADMIN, SELLER, BIDDER). 
- Cột quan trọng là `account_status`: Dùng để quản lý rủi ro bùng hàng. Nếu người dùng thắng đấu giá nhưng không thanh toán, hệ thống sẽ chuyển trạng thái sang `BANNED` (cấm tham gia vĩnh viễn).
- `rating_score`: Điểm uy tín, hệ thống có thể dùng để lọc người mua (ví dụ: điểm uy tín phải > 4.0 mới được tham gia).

### Bảng `PRODUCTS` (Sản phẩm)
Chứa thông tin vật lý của món hàng (hình ảnh, mô tả). Được tách biệt hoàn toàn với `AUCTIONS`.
- Tại sao phải tách biệt? Vì một sản phẩm (Product) nếu đấu giá thất bại (không ai mua), người bán (Seller) có thể tạo một Phiên đấu giá mới (`AUCTIONS`) cho chính sản phẩm đó vào tuần sau mà không cần tạo lại thông tin hình ảnh từ đầu.

### Bảng `AUCTIONS` (Phiên đấu giá)
Đây là bảng quan trọng nhất hệ thống, nơi lưu trạng thái của cuộc đấu giá.
- Cột `current_price` luôn lưu giữ mức giá cao nhất ở thời điểm hiện tại.
- **`version` (Cực kỳ quan trọng):** Dùng để áp dụng kỹ thuật **Optimistic Locking**. Khi 2 request cùng lúc muốn cập nhật `current_price`, database sẽ so sánh `version`. Chỉ 1 request có version khớp mới thành công, request kia sẽ bị văng lỗi (Concurrency Exception), giúp ngăn ngừa lỗi "Race Condition" rất phổ biến trong đấu giá.

### Bảng `BIDS` (Lịch sử Đặt giá)
Bảng này ghi lại toàn bộ lịch sử đấu giá một cách minh bạch (Audit log).
- Cột `status`: Khi một người A đặt 100k, trạng thái là `VALID`. Khi người B đặt 110k thành công, dòng của B thành `VALID` và dòng của A tự động chuyển thành `OUTBID` (đã bị vượt qua).

### Bảng `INVOICES` (Hóa đơn - Thay thế cho hệ thống Ví)
- Khi phiên đấu giá kết thúc thành công (Có người bid), một bản ghi `INVOICES` tự động được sinh ra với trạng thái `PENDING`.
- Cột `due_date` giới hạn thời gian thanh toán (ví dụ: 3 ngày).
- Một **Cron Job (Background Task)** sẽ quét bảng này mỗi giờ, nếu hóa đơn quá hạn mà vẫn `PENDING`, nó sẽ chuyển thành `CANCELED` và cập nhật bảng `USERS`, đổi `account_status` của người dùng đó thành `BANNED` (Luật chơi nghiêm khắc để chống phá rối).

---

## 3. Query Mẫu Xử Lý Đặt Giá (Optimistic Locking)

Khi một user đặt giá mới, hệ thống sẽ thực thi luồng sau:
1. Lấy `version` hiện tại:
   `SELECT current_price, version FROM auctions WHERE id = '...';`
2. Lưu `BIDS` mới và Cập nhật `AUCTIONS` trong 1 Transaction, yêu cầu `version` phải khớp:
   ```sql
   BEGIN;
   -- Tạo lịch sử
   INSERT INTO bids(auction_id, bidder_id, amount, status) VALUES (...);
   
   -- Cập nhật giá và tăng version lên 1 (Chỉ thành công nếu version không bị đổi bởi ai khác)
   UPDATE auctions 
   SET current_price = {new_price}, version = version + 1 
   WHERE id = '...' AND version = {old_version};
   COMMIT;
   ```
   *Nếu UPDATE trả về `0 rows affected`, nghĩa là trong 1 mili-giây qua đã có người khác nhanh tay hơn. Backend sẽ quăng lỗi: "Giá đã bị thay đổi, vui lòng thử lại!"*
