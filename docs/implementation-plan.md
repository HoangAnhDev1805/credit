# Checker Refactor – Implementation Plan

## Scope
- Áp dụng kiến trúc trong `docs/checker-architecture.md`.
- Không phá vỡ FE cũ; giữ adapter legacy.
- Ưu tiên sửa lỗi billing/idempotent/realtime; sau đó hiệu năng & ops.

## Phases & Tasks

### Phase 1 – Schema & Controllers (Backend)
- **Card schema**
  - Thêm `status: 'pending'` vào enum.
  - Thêm `checkDeadlineAt: Date`, `sessionCounted: Boolean`, `billedInSession: Boolean`, `billAmount: Number`.
  - Unique index `{ fullCard: 1, userId: 1 }`.
- **checkerController.startOrStop()**
  - Chuẩn hóa `typeCheck: Number`.
  - Set `CheckSession.pricePerCard` theo Gate → fallback SiteConfig.
- **checkccController.handleUpdateStatus.processOne()**
  - Map status, `zennoposter=1`, set `checkedAt` khi `live|die`.
  - Billing theo `originUserId`, idempotent qua `billedInSession` + `billAmount`.
  - Catch `ErrorId=1`; `unknown` cập nhật `lastCheckAt`.
- **/api/checkcc/evict**
  - Stop semantics với `pausezenno=true`; evict `pending|unknown|checking`.
- **getStatus()**
  - `billedAmount` từ `billedInSession`.

### Phase 2 – Realtime & Ops
- Socket rooms: `user:{originUserId}`, `session:{sessionId}`.
- Debounce `checker:session:update` 100–300ms; batch `checker:card`.
- Config backpressure: `checker_default_fetch_batch`, `checker_max_concurrent_checking`.
- Cron reset thẻ `checking` quá hạn (`checkDeadlineAt < now`), dọn dữ liệu `pausezenno=true`.

### Phase 3 – Frontend & Tooling
- `dashboard/checker/page.tsx`: sửa filter theo `status/sessionId/originUserId`, pagination/virtualization.
- `admin/api-tester` theo `docs/admin-api-tester.md` (tabs Start/Fetch/Update/Debug/Guide).
- Guide ZennoPoster: copy từ `checker-architecture.md` (fetch/update/evict, batch, PauseZenno).

### Phase 4 – Index & Policy
- Migrate unique index sang `{ fullCard, userId }` an toàn (xem `migration-deprecation.md`).
- Kiểm thử explain plan với dataset lớn.

## Acceptance Criteria
- Billing đúng theo Gate (price hierarchy) và `originUserId`.
- Mỗi card chỉ bill tối đa 1 lần; `Transaction` `balanceBefore/After` chính xác.
- Stop/Evict không bill kết quả muộn; Fetch hết thẻ trả `{ ErrorId:1, PauseZenno:true }`.
- Realtime mượt khi >10k thẻ; không broadcast tràn; counters khớp DB.
- Legacy routes hoạt động qua adapter, không tái lỗi cũ.

## Risks & Mitigations
- Sai sót migration index → chạy ở maintenance window; backup trước; script idempotent.
- Socket flood → debounce + batch; giám sát emit rate.
- Zenno cấu hình trễ → giữ adapter; công bố timeline deprecation.

## Rollout
- Canary 10% traffic worker và 1-2 user nội bộ.
- Theo dõi metrics/alerts 24–48h; nếu ổn nâng dần.
- Đóng legacy sau khi Zenno chuyển cấu hình.
