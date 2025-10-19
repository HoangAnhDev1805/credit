
Tài liệu này mô tả endpoint yêu cầu xác thực (JWT) dành cho client tự động (như ZennoPoster) để:
- Lấy thẻ cần kiểm tra (LoaiDV=1)
- Gửi trả kết quả sau khi kiểm tra (LoaiDV=2)

Base URL: https://checkcc.live

Endpoint: POST /api/checkcc

Xác thực: Bắt buộc dùng JWT qua header Authorization: Bearer <token>

Tổng quan
- Endpoint yêu cầu JWT hợp lệ. Lấy token qua đăng nhập và gửi trong header Authorization. Thiếu/không hợp lệ sẽ trả ErrorId=1, Title="unauthorized".
- Body có thể là JSON hoặc form-encoded. Tất cả tham số có thể truyền qua body hoặc querystring.
- Có 2 chế độ thao tác, điều khiển bằng tham số LoaiDV.


## 1) Lấy thẻ cần kiểm tra (LoaiDV=1)

Request
- Method: POST
- URL: /api/checkcc
- Headers: Authorization: Bearer <JWT>
- Body/query tham số:
  - LoaiDV (number, bắt buộc): 1
  - Amount (number, tùy chọn): số lượng thẻ mong muốn. Sẽ được ràng buộc trong [min_cards_per_check, max_cards_per_check] (mặc định 1..1000, cấu hình trong SiteConfig).
  - TypeCheck (number, tùy chọn): 1 = chỉ validate, 2 = test charge. Mặc định: 2.
  - Device (string, tùy chọn): thông tin thiết bị/máy.
  - token (string, tùy chọn): KHÔNG dùng ở route này (giữ vì tương thích), thay vào đó dùng header Authorization.

Hành vi máy chủ
- Cần cấu hình SiteConfig khóa post_api_user_id trỏ đến ObjectId hợp lệ của user nguồn tồn kho thẻ trong hệ thống. Thiếu/không hợp lệ sẽ trả lỗi.
- Lấy ngẫu nhiên Amount thẻ có trạng thái unknown của user nguồn, đánh dấu status="checking" và tăng bộ đếm checkAttempts.

Phản hồi (thành công)
- HTTP 200, JSON đầy đủ mẫu:
  {
    "ErrorId": 0,
    "Title": "",
    "Message": "",
    "Content": [
      {
        "Id": "66fb7e2a4b3f45f3a5d6a901",
        "FullThe": "453226******1234|06|27|123",
        "TypeCheck": 2,
        "Price": 0
      },
      {
        "Id": "66fb7e2a4b3f45f3a5d6a902",
        "FullThe": "520985******5678|08|26|456",
        "TypeCheck": 2,
        "Price": 0
      }
    ]
  }

Phản hồi (lỗi)
- Không xác thực (thiếu/sai JWT):
  { "ErrorId": 1, "Title": "unauthorized", "Message": "Invalid or missing JWT token", "Content": "" }
- Chưa cấu hình nguồn tồn kho:
  { "ErrorId": 1, "Title": "error", "Message": "Stock source (post_api_user_id) not configured", "Content": "" }
- Hết tồn:
  { "ErrorId": 1, "Title": "error", "Message": "Out of stock", "Content": "" }
- Lỗi nội bộ khác:
  { "ErrorId": 1, "Title": "error", "Message": "Failed to fetch cards", "Content": "" }

Ví dụ
- POST /api/checkcc với body JSON:
  { "LoaiDV": 1, "Amount": 50, "TypeCheck": 2 }


## 2) Gửi trả kết quả thẻ (LoaiDV=2)

Request
- Method: POST
- URL: /api/checkcc
- Headers: Authorization: Bearer <JWT>
- Body/query tham số:
  - LoaiDV (number, bắt buộc): 2
  - Id (string, bắt buộc): MongoDB ObjectId của thẻ.
  - Status (number, bắt buộc): mã trạng thái kết quả
    - 0 => unknown
    - 1 => checking
    - 2 => live
    - 3 => die
    - 4 => unknown
    - 5 => live
  - Msg (string, tùy chọn): thông điệp lỗi/chẩn đoán.
  - From (number, tùy chọn): nguồn kiểm tra
    - 0 => unknown, 1 => google, 2 => wm, 3 => zenno, 4 => 777
  - State (number, tùy chọn): hiện lưu nhận nhưng chưa sử dụng.
  - Type (number, tùy chọn): 1 hoặc 2; hợp lệ sẽ lưu vào typeCheck.

Meta fields (không bắt buộc)
- Đọc từ body hoặc querystring. Một số khóa có thể không phân biệt hoa thường. Chỉ giá trị hợp lệ mới được lưu:
  - BIN: 6 chữ số → card.bin
  - Brand: visa|mastercard|amex|discover|jcb|diners|unknown → card.brand (viết thường)
  - Country: mã 2 ký tự A-Z → card.country (viết hoa)
  - Bank: chuỗi bất kỳ → card.bank
  - Level: classic|gold|platinum|black|unknown → card.level (viết thường)
  - Type: 1|2 → card.typeCheck

Phản hồi
- Thành công (cập nhật đã áp dụng):
  { "ErrorId": 1, "Title": "success", "Message": "", "Content": "" }
  Lưu ý: Với cập nhật, ErrorId=1 biểu thị thành công theo thiết kế lịch sử.
- Thất bại (Id không hợp lệ, không tìm thấy, hoặc lỗi khác):
  { "ErrorId": 0, "Title": "error", "Message": "<reason>", "Content": "" }

Ví dụ JSON đầy đủ
- Body:
  {
    "LoaiDV": 2,
    "Id": "66fb7e2a4b3f45f3a5d6a901",
    "Status": 2,
    "Msg": "approved",
    "From": 3,
    "BIN": "453226",
    "Brand": "visa",
    "Country": "US",
    "Bank": "CHASE",
    "Level": "platinum",
    "Type": 2
  }

Ghi chú
- Khi Status ánh xạ sang một trong live|die|unknown, máy chủ sẽ đặt checkedAt = hiện tại. Luôn đặt lastCheckAt = hiện tại.
- Khi có From (0..4), checkSource được lưu: unknown/google/wm/zenno/777.
- Tính phí theo thẻ hiện thực hiện ở thời điểm kết thúc phiên, không tính ở từng cập nhật; mã tính phí per-card trước đây đã tắt.


## Hành vi và giới hạn chung
- Giới hạn Amount: ràng buộc trong [min_cards_per_check, max_cards_per_check]. Mặc định lần lượt 1 và 1000, cấu hình qua SiteConfig (admin).
- Mặc định TypeCheck: nếu không truyền ở LoaiDV=1, máy chủ dùng 2 (charge test). Giá trị này sẽ được phản chiếu trong từng item trả về.
- Định dạng thẻ: FullThe là "cardNumber|MM|YY|CVV". Nếu có trường fullCard trên thẻ, ưu tiên dùng nguyên giá trị.
- Chuyển trạng thái: Khi lấy mẫu (LoaiDV=1) các thẻ được đánh dấu status="checking" và tăng checkAttempts; các lần LoaiDV=2 sau nên đặt trạng thái cuối là live/die (hoặc unknown để reset).
- Bắt buộc xác thực: Mọi gọi /api/checkcc phải có JWT hợp lệ. Tham số token cũ (không xác thực) thuộc route riêng /api/post/checkcc.


## Khác biệt so với POST API (/api/post/checkcc)
- /api/checkcc (tài liệu này) yêu cầu JWT và Authorization: Bearer <token>.
- /api/post/checkcc là tích hợp riêng dùng token cấu hình trong body (post_api_token hoặc post_api_tokens), không yêu cầu JWT. Nếu cần spec POST API dạng legacy, vui lòng yêu cầu thêm.


## Tóm tắt nhanh

## Lấy token để gọi API

1) Đăng nhập (frontend) và lấy token
- Gửi yêu cầu đăng nhập qua UI hoặc trực tiếp API:
  - POST https://checkcc.live/api/auth/login
  - Body JSON: { "login": "<username-or-email>", "password": "<password>" }
  - Phản hồi mẫu:
    {
      "success": true,
      "data": {
        "user": { "id": "...", "username": "...", "role": "user", ... },
        "token": "<JWT>",
        "refreshToken": "<JWT_REFRESH>"
      }
    }

2) Dùng token để gọi /api/checkcc
- Thêm header: Authorization: Bearer <JWT>
- Ví dụ curl (LoaiDV=1):
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"LoaiDV":1,"Amount":50,"TypeCheck":2}' \
    https://checkcc.live/api/checkcc

3) Gia hạn qua refresh token
- POST https://checkcc.live/api/auth/refresh
- Body: { "refreshToken": "<JWT_REFRESH>" }
- Nhận token mới để tiếp tục gọi API an toàn.

- Lấy thẻ: LoaiDV=1; tham số: Amount, TypeCheck; thành công => ErrorId=0 kèm mảng Content.
- Cập nhật kết quả: LoaiDV=2; tham số: Id, Status, Msg, From và meta tùy chọn (BIN, Brand, Country, Bank, Level, Type); thành công => ErrorId=1.
