# Admin Checker Console – UI & Realtime

## Mục tiêu
- Giao diện đẹp, trực quan, full tiếng Việt, realtime Socket.IO.
- Gom các tính năng quản trị Checker vào một nơi, phân tab rõ ràng.

## Đường dẫn & Kiến trúc Frontend
- Trang: `frontend/src/app/admin/checker/page.tsx`
- Component gốc: `AdminCheckerConsole`
- Component con:
  - `ApiConfigPanel.tsx` – Cấu hình API (SiteConfig + Feature Flags)
  - `MetricsPanel.tsx` – Giám sát & Thống kê (queues, TPS, error rate, emit rate)
  - `StartTesterPanel.tsx` – Kiểm thử API (Start/Stop/Status)
  - `FetchTesterPanel.tsx` – Kiểm thử Fetch (LoaiDV=1)
  - `UpdateTesterPanel.tsx` – Kiểm thử Update (LoaiDV=2, đơn & batch)
  - `DebugPanel.tsx` – Nhật ký Request/Response, socket events
  - `ZennoGuidePanel.tsx` – Hướng dẫn tích hợp ZennoPoster (mẫu cURL/JSON)

## Tabs & Nội dung

### 1) Cấu hình API (ApiConfigPanel)
- Trường cấu hình (đọc/ghi `SiteConfig`):
  - `checker_card_timeout_sec`, `checker_default_fetch_batch`, `checker_max_concurrent_checking`
  - `min_cards_per_check`, `max_cards_per_check`, `default_price_per_card`
- Feature flags (đọc/ghi `SiteConfig.features`):
  - `feature_enable_legacy_adapter`, `feature_enable_batch_update`, `feature_checker_emit_debounce_ms`
- Nút: Lưu, Khôi phục mặc định (Confirm), Tải lại.
- Gợi ý/Tooltips: giải thích từng tham số.

### 2) Giám sát & Thống kê (MetricsPanel)
- Chỉ số chính:
  - Hàng đợi: `pending/checking/unknown` (theo `typeCheck`)
  - TPS: `checkcc_fetch_tps`, `checkcc_update_tps`, Error Rate
  - Socket: `checker_socket_emit_rate`
- Biểu đồ nhỏ (sparkline) + số lớn (KPI cards).
- Socket subscribe `admin:device-stats:update`.
- Hành động: Evict theo `sessionId` (Confirm).

### 3) Kiểm thử API (StartTesterPanel)
- Form: textarea `Cards`, select `Gate (typeCheck)`, nút `Start`, `Stop`, `Clear`.
- Hiển thị: `sessionId`, `pricePerCard`, `billedAmount`, counters.
- Danh sách kết quả realtime (virtualized, filter theo `status`).
- Sockets: `checker:session:start|update`, `checker:card`, `checker:fetch`, `user:balance-changed`.
- API: `POST /api/checkcc/start`, `GET /api/checkcc/status?sessionId=...`, `POST /api/checkcc/stop`.

### 4) Kiểm thử Fetch (FetchTesterPanel)
- Form: `amount`, `typeCheck`, `token`, `device?`.
- Nút: `Fetch`, `Auto-Fetch Start/Stop`.
- Hiển thị kết quả + case hết thẻ `{ ErrorId:1, Title:'card store not found', PauseZenno:true }`.
- API: `POST /api/checkcc/fetch` (canonical), legacy `{ LoaiDV:1 }` tùy chọn.

### 5) Kiểm thử Update (UpdateTesterPanel)
- Đơn & Batch:
  - `Id|FullThe`, `Status (1|2|3|4)`, `Msg`, `BIN`, `Brand`, `Country`, `Bank`, `Level`, `TypeCheck`.
- Nút: `Send One`, `Send Batch`, `Send Legacy Batch`.
- API: `POST /api/checkcc/update` (canonical), legacy `{ LoaiDV:2, Content:[...] }` tùy chọn.

### 6) Debug (DebugPanel)
- Log Request/Response JSON, headers, status code, latency, payload size.
- Đếm `socket events/sec`, tùy chọn `mockDelayMs`.

### 7) Hướng dẫn ZennoPoster (ZennoGuidePanel)
- Mẫu cURL/JSON cho `/fetch`, `/update` (đơn & batch), `/evict`.
- Giải thích `PauseZenno`, mapping `Status`, retry/backpressure, batch size.
- Link `docs/checker-architecture.md`.

## Realtime Socket.IO
- Join rooms: `user:{adminUserId}`, `session:{sessionId}` khi Start.
- Debounce `checker:session:update` (100–300ms), batch emit `checker:card`.
- Hiển thị warnings khi tốc độ events vượt ngưỡng (flood).

## UI/UX tiêu chuẩn
- Ngôn ngữ: hoàn toàn tiếng Việt.
- Mask PAN mặc định; cho phép bật/tắt xem raw (admin-only, default OFF).
- Virtualized list cho kết quả lớn.
- Form có validation rõ ràng; lỗi hiển thị thân thiện.
- Các thao tác nguy hiểm có Confirm (evict, reset config).

## Rà soát tái phân chia tabs admin khác
- **Gợi ý chuyển**:
  - Nếu hiện có tab cấu hình Checker rời rạc, dồn vào `Cấu hình API`.
  - Các thống kê Checker rải rác → gom về `Giám sát & Thống kê`.
  - Công cụ test API trước đây (`admin/api-tester`) → nhập vào `Admin Checker Console` (tab Kiểm thử) để thống nhất.

## Backend endpoints phục vụ Console
- `GET/POST /admin/checker/config` (SiteConfig)
- `GET/POST /admin/checker/flags` (Feature Flags)
- `GET /admin/checker/metrics` (Queue/TPS/Error/Emit)
- `POST /admin/checker/evict-session` (evict theo sessionId)

## Implementation notes
- Tech: Next.js (client components), Zustand/useReducer cho state, TailwindCSS, shadcn/ui cho components, react-virtual.
- Bảo mật: middleware admin, ẩn token, rate-limit client trên Auto-Fetch/Update.

## Checklist
- **[UI]**: tiếng Việt, đẹp, trực quan, tooltips đầy đủ.
- **[Realtime]**: rooms/subscribe chính xác, debounce hoạt động, cảnh báo flood.
- **[Test]**: FE mimic start/status/stop, fetch/update đơn & batch, legacy adapter.
- **[Config]**: đọc/ghi đúng SiteConfig & Flags, confirm thao tác nguy hiểm.
- **[Masking]**: không lộ PAN/CVV, chỉ masked by default.
