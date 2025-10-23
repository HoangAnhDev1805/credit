# Migration & Deprecation Plan

## Mục tiêu
- Chuyển đổi an toàn từ unique index `{ cardNumber, userId }` sang `{ fullCard, userId }`.
- Loại bỏ dần legacy routes để giảm bảo trì và tái lỗi cũ.

## Migration unique index

### Hiện trạng
- Index hiện tại: `{ cardNumber: 1, userId: 1 }` unique.
- Vấn đề: Nhiều thẻ cùng `cardNumber` nhưng khác `cvv`/`expiryMonth`/`expiryYear` → duplicate error.

### Mục tiêu
- Index mới: `{ fullCard: 1, userId: 1 }` unique.
- Lợi ích: phân biệt chính xác thẻ theo toàn bộ thông tin `cardNumber|expiryMonth|expiryYear|cvv`.

### Kế hoạch migration

**Bước 1: Backup DB**
```bash
# Backup toàn bộ collection cards
mongodump --uri="mongodb://admin:password123@localhost:27017/credit_card_checker?authSource=admin" --collection=cards --out=/opt/apps/creditv2/db_backups/pre-migration-$(date +%Y%m%d)
```

**Bước 2: Thêm index mới (không xóa cũ)**
```javascript
// Script: backend/scripts/migrate-index.js
db.cards.createIndex({ fullCard: 1, userId: 1 }, { unique: true, background: true });
```

**Bước 3: Deploy code mới**
- Code đã dùng `{ fullCard, userId }` ở `backend/src/models/Card.js`.
- Mongoose sẽ tự tạo index khi restart, nhưng đã tạo trước bằng tay → tránh downtime.

**Bước 4: Xóa index cũ (sau khi xác nhận ổn định 24-48h)**
```javascript
db.cards.dropIndex("cardNumber_1_userId_1");
```

**Bước 5: Rollback plan**
- Nếu có vấn đề: restore từ backup, rollback code, xóa index mới, giữ lại index cũ.

## Deprecation legacy routes

### Phạm vi
- Legacy adapter:
  - `POST /api/checkcc` với `LoaiDV=1|2` (ZennoPoster cũ).
  - `POST /api/checker/start|check-existing` (FE cũ).

### Timeline

**T0: Deploy code mới** (đã hoàn tất)
- Adapter chạy qua code-path mới → không tái lỗi cũ.
- Canonical routes hoạt động song song.

**T0 + 7 ngày: Thêm deprecation warning**
- Response header: `X-Deprecated-API: true`.
- Body kèm `_deprecationWarning: "This endpoint will be removed on [date]. Please migrate to /api/checkcc/fetch or /api/checkcc/update."`.
- Chỉ admin/dev thấy (không gây hoảng loạn user).

**T0 + 14 ngày: Yêu cầu migration**
- Thông báo Slack/Telegram nội bộ: "Vui lòng chuyển cấu hình ZennoPoster sang API mới".
- Bật logging warn khi có request legacy (ghi `userId`, `device`, `timestamp`).

**T0 + 21–30 ngày: Tắt legacy**
- Feature flag `ENABLE_LEGACY_ADAPTER=false` trong `SiteConfig`.
- Legacy routes trả `410 Gone` hoặc `301 Permanent Redirect` tới canonical.
- Chỉ tắt khi 0 call legacy trong 48–72h liên tiếp.

**Rollback plan**
- Bật lại feature flag `ENABLE_LEGACY_ADAPTER=true` nếu cần thêm thời gian.

### Kênh thông báo
- README admin.
- Slack/Telegram nội bộ.
- Email notice (nếu có danh sách user sử dụng Zenno).

### Tiêu chí tắt
- **Metrics**: 0 request tới legacy routes trong 48–72h liên tiếp.
- **Logs**: Không có error liên quan đến canonical routes.
- **User feedback**: Không có khiếu nại hoặc yêu cầu hỗ trợ.

## Checklist migration

- [ ] Backup DB trước khi migrate index.
- [ ] Tạo index mới `{ fullCard, userId }` background.
- [ ] Deploy code, kiểm tra không có duplicate key error.
- [ ] Xác nhận 24–48h ổn định → xóa index cũ `{ cardNumber, userId }`.
- [ ] Thêm deprecation warning vào legacy routes (T0 + 7 ngày).
- [ ] Thông báo nội bộ yêu cầu migration (T0 + 14 ngày).
- [ ] Monitor metrics legacy routes (T0 + 21 ngày).
- [ ] Tắt legacy adapter khi 0 call trong 48–72h (T0 + 21–30 ngày).
- [ ] Document rollback procedure.
