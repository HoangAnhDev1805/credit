# Admin API Tester - Thiết kế theo API mới (giữ tương thích legacy)

## Mục tiêu
- Cung cấp giao diện admin test đầy đủ các flow checker theo API mới.
- Mô phỏng gần như trang `dashboard/checker` để quan sát realtime, counters, billing.
- Hỗ trợ test cả route canonical mới và legacy `LoaiDV=1|2` (adapter) để tránh lỗi khi chuyển đổi.

## Tabs giao diện

### 1) Start (FE mimic)
- Form:
  - Textarea `Cards` (mỗi dòng `fullCard`: `CC|MM|YY|CVV`).
  - Select `Gate` (`typeCheck` = 1/2), hiển thị `creditCost`.
  - Input `Session Meta` (tùy chọn).
- Nút: `Start`, `Stop`, `Clear`.
- Hiển thị:
  - `sessionId`, `pricePerCard`, `billedAmount`.
  - Counters: `total/processed/pending/checking/live/die/unknown`.
  - List kết quả realtime (virtualized) + filter theo `status`.
- Socket:
  - Join `user:{adminUserId}`, `session:{sessionId}`.
  - Lắng nghe `checker:session:start|update`, `checker:card`, `checker:fetch`, `user:balance-changed`.
- API gọi:
  - `POST /api/checkcc/start` (canonical) → `checkerController.startOrStop()`.
  - `GET /api/checkcc/status?sessionId=...` (polling fallback/refresh).
  - `POST /api/checkcc/stop` khi ấn `Stop`.

### 2) Fetch (LoaiDV=1)
- Form:
  - `amount: number`, `typeCheck: number`, `token: string`, `device: string?`.
- Nút: `Fetch Once`, `Auto-Fetch Start`, `Auto-Fetch Stop`.
- Hiển thị:
  - Bảng các thẻ trả về (masked), thời gian thực thi, latency.
  - Trường hợp hết thẻ: hiển thị body chuẩn:
```json
{ "ErrorId": 1, "Title": "card store not found", "PauseZenno": true }
```
- API gọi (canonical):
  - `POST /api/checkcc/fetch`.
- Legacy (tùy chọn):
  - `POST /api/checkcc` với body `{ "LoaiDV": 1, ... }`.

### 3) Update (LoaiDV=2)
- Form (đơn và batch):
  - Đơn: `Id|FullThe`, `Status (1|2|3|4)`, `Msg`, `BIN`, `Brand`, `Country`, `Bank`, `Level`, `TypeCheck`.
  - Batch: bảng nhiều dòng cho các trường trên.
- Nút: `Send One`, `Send Batch`, `Send Legacy Batch`.
- Hiển thị:
  - Kết quả từng item `{ Id, ok }`, status code, latency.
- API gọi (canonical):
  - `POST /api/checkcc/update`.
  - Batch payload mẫu:
```json
{
  "items": [
    { "Id": "6718...", "Status": 1, "Msg": "Approved", "TypeCheck": 1 },
    { "Id": "6719...", "Status": 2, "Msg": "Declined", "TypeCheck": 1 }
  ]
}
```
- Legacy (tùy chọn):
  - `POST /api/checkcc` với body `{ "LoaiDV": 2, "Content": [ ...items ] }`.

### 4) Debug
- Console hiển thị Request/Response JSON, headers, status code, payload size, thời gian thực thi.
- Tùy chọn `mockDelayMs` khi gọi API.
- Đếm `socket events/sec` để phát hiện flood.

### 5) Hướng dẫn ZennoPoster
- Nội dung ngắn gọn, link tới `docs/checker-architecture.md` (mục Hướng dẫn tích hợp ZennoPoster) + nút `Copy cURL`, `Copy JSON` cho:
  - `POST /api/checkcc/fetch`
  - `POST /api/checkcc/update` (đơn & batch)
  - `POST /api/checkcc/evict`
- Ghi chú: mapping Status (`1=live`, `2=die`, `3=checking`, `4=unknown`), `PauseZenno` khi hết thẻ, timeout/retry, batch size.

## Chuẩn API áp dụng (tránh lỗi)
- Canonical dùng routes mới:
  - `POST /api/checkcc/start|status|stop` cho FE mimic.
  - `POST /api/checkcc/fetch|update|evict` cho worker.
- **Giữ tương thích legacy** chỉ như adapter:
  - `POST /api/checkcc` với `LoaiDV=1|2` sẽ đi vào chung code-path mới → tránh tái hiện lỗi cũ.
- HTTP status:
  - Trường hợp hết thẻ/fetch: HTTP 200 + `{ ErrorId: 1, Title: 'card store not found', PauseZenno: true }`.

## Bảo mật & Masking trong Admin Tester
- Không log `fullCard` nguyên bản; hiển thị masked.
- Giới hạn tốc độ gọi API trong chế độ Auto-Fetch/Auto-Update (rate limit client-side).
- Ẩn `POST_API_TOKEN` sau nhập; cho phép toggle show/hide.

## Implementation Plan (rút gọn)
- Route trang: `frontend/src/app/admin/api-tester/page.tsx` (hoặc `app/admin/api-tester/` với client components theo tabs).
- State chung sử dụng `Zustand`/`useReducer` để điều phối tabs và logs.
- Socket: dùng hook socket hiện có, join theo room khi cần (Start tab).
- Components chính:
  - `StartPanel`, `FetchPanel`, `UpdatePanel`, `DebugPanel`, `GuidePanel`.
- Reuse utilities từ `dashboard/checker` (masking, format thời gian, virtualization list).

## Checklist QA
- **[Fetch]**: batch size, khi hết thẻ trả đúng `{ ErrorId:1, PauseZenno:true }`.
- **[Update]**: đơn & batch chạy ok, trả `{ ok:true }` theo item.
- **[Billing]**: quan sát `billedAmount` tăng theo `live|die`, không tăng ở `unknown|checking`.
- **[Start/Stop]**: Stop → Evict ok; Start lại session mới ok.
- **[Realtime]**: session counters mượt, không flood events, filter hiển thị đúng.
- **[Security]**: masked PAN, token không bị lộ trong logs UI.
