# Operations, Cron & Monitoring

## Mục tiêu
- Vận hành ổn định checker với cron reset thẻ kẹt.
- Giám sát realtime qua metrics/alerts.
- Quản lý vòng đời log và data retention.

## Cron jobs

### 1. Reset thẻ kẹt (Sweeper)

**Mục đích**: Reset thẻ `checking` quá hạn về `unknown` để requeue.

**Hiện trạng**: Đã có trong `backend/src/server.js` chạy mỗi 15 giây.

**Logic**:
```javascript
const now = new Date();
const res = await Card.updateMany(
  {
    zennoposter: { $in: [0, null] },
    status: 'checking',
    checkDeadlineAt: { $exists: true, $lte: now }
  },
  {
    $set: {
      status: 'unknown',
      errorMessage: 'Timeout by system',
      updatedAt: new Date(),
      checkDeadlineAt: null
    }
  }
);
```

**Không làm**:
- ❌ Không set `zennoposter=1` (vì không phải kết quả từ ZennoPoster).
- ❌ Không emit `checker:card` (vì không phải kết quả thực, chỉ là timeout).
- ❌ Không billing (vì chưa có kết quả).

**Làm**:
- ✅ Set `status='unknown'`.
- ✅ Set `zennoposter=0` (giữ nguyên).
- ✅ Clear `checkDeadlineAt` để có thể requeue.
- ✅ Log count để theo dõi: `console.log(\`[Sweeper] Reset ${count} timed-out cards to unknown for requeue\`)`.

### 2. Dọn thẻ có `pausezenno=true` (Tuỳ chọn)

**Mục đích**: Dọn các thẻ/record tạm có flag `pausezenno=true` lâu ngày (nếu có field này).

**Logic** (nếu triển khai):
```javascript
// Chạy mỗi 1h
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
await Card.deleteMany({
  pausezenno: true,
  updatedAt: { $lte: oneDayAgo }
});
```

**Lưu ý**: Hiện tại backend chưa có field `pausezenno` trong `Card` schema; chỉ có trong response `PauseZenno`. Nếu cần persist thì thêm field.

### 3. Aggregate metrics snapshot (Tuỳ chọn)

**Mục đích**: Lưu snapshot metrics mỗi 5 phút vào collection `MetricsSnapshot` để vẽ chart lịch sử.

**Logic**:
```javascript
// Chạy mỗi 5 phút
const snapshot = {
  ts: new Date(),
  queue: {
    pending: await Card.countDocuments({ status: 'pending' }),
    checking: await Card.countDocuments({ status: 'checking' }),
    unknown: await Card.countDocuments({ status: 'unknown' }),
    live: await Card.countDocuments({ status: 'live' }),
    die: await Card.countDocuments({ status: 'die' })
  },
  tps: {
    fetchPerMin: await Card.countDocuments({ status: 'checking', lastCheckAt: { $gte: oneMinuteAgo } }),
    updatePerMin: await Card.countDocuments({ zennoposter: 1, updatedAt: { $gte: oneMinuteAgo } })
  }
};
await MetricsSnapshot.create(snapshot);
```

## Metrics (Prometheus format)

### Tên metrics gợi ý

**Queue sizes** (gauge):
- `checkcc_queue_pending`: số thẻ `status='pending'`.
- `checkcc_queue_checking`: số thẻ `status='checking'`.
- `checkcc_queue_unknown`: số thẻ `status='unknown'`.
- `checkcc_queue_live`: số thẻ `status='live'`.
- `checkcc_queue_die`: số thẻ `status='die'`.

**Throughput** (counter):
- `checkcc_fetch_total`: tổng số lần fetch (increment mỗi `handleFetchCards()`).
- `checkcc_update_total`: tổng số lần update (increment mỗi `handleUpdateStatus.processOne()`).
- `checkcc_fetch_tps`: TPS fetch (cards moved to `checking` per second).
- `checkcc_update_tps`: TPS update (cards updated `zennoposter=1` per second).

**Errors** (counter):
- `checkcc_error_rate`: % request có `ErrorId != 0`.
- `checkcc_error_total`: tổng số error.

**Realtime** (gauge):
- `checker_socket_emit_rate`: số `checker:session:update` emit per second.
- `checker_session_update_debounce_drops`: số lần debounce drop (nếu track).

**Billing** (counter):
- `billing_events_count`: tổng số lần billing thành công.
- `billing_mismatch_count`: số lần `billedInSession` conflict (nếu có).

### Endpoint

Đã có: `GET /api/admin/checker/metrics` trả JSON.

**Mở rộng**: Thêm `/metrics` endpoint trả Prometheus format (dùng `prom-client`):
```javascript
const client = require('prom-client');
const register = new client.Registry();

const queuePending = new client.Gauge({ name: 'checkcc_queue_pending', help: 'Pending cards', registers: [register] });
// ... tương tự cho các metric khác

app.get('/metrics', async (req, res) => {
  queuePending.set(await Card.countDocuments({ status: 'pending' }));
  // ... update các metric khác
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Alert rules (Prometheus Alertmanager)

### Fetch/Update Error Rate cao
```yaml
- alert: CheckccHighErrorRate
  expr: checkcc_error_rate > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Checkcc error rate > 5% trong 5 phút"
    description: "Kiểm tra logs backend và ZennoPoster"
```

### Billing mismatch
```yaml
- alert: BillingMismatch
  expr: increase(billing_mismatch_count[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Phát hiện billing mismatch"
    description: "Có thẻ bị bill trùng hoặc sai. Kiểm tra logs ngay"
```

### Socket emit rate quá cao
```yaml
- alert: SocketEmitFlood
  expr: checker_socket_emit_rate > 100
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Socket emit rate > 100/s trong 2 phút"
    description: "Có thể bị flood hoặc debounce không hoạt động"
```

### Queue pending không giảm (kẹt)
```yaml
- alert: QueueStuck
  expr: checkcc_queue_pending > 1000 AND delta(checkcc_queue_pending[10m]) < -10
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Queue pending không giảm trong 10 phút"
    description: "Có nguy cơ ZennoPoster không fetch hoặc backpressure quá cao"
```

## Data retention & Purge

### Log retention

**`CheckReceiverLog`** (nếu triển khai):
- Mục đích: Lưu raw payload ZennoPoster POST để debug.
- Retention: 7–30 ngày (tùy nhu cầu).
- Purge: TTL index hoặc cron job hàng ngày.
```javascript
// TTL index (tự động xóa sau 7 ngày)
CheckReceiverLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
```

**Socket/Audit logs**:
- Retention: 7–14 ngày.
- Mask PAN vĩnh viễn khi lưu.

### Card history

**`Card` collection**:
- Không lưu `cvv` đầy đủ lâu dài (bảo mật).
- Cân nhắc mã hóa `fullCard` ứng dụng-level nếu cần giữ lâu.
- Chỉ để `maskedCardNumber` trong báo cáo/UI.

**Chính sách**:
- Thẻ `unknown` lâu quá (>30 ngày) không được check lại → cân nhắc archive hoặc xóa.
- Thẻ `live|die` giữ để cache → xóa sau 7–90 ngày tùy policy.

### Backup & Restore

**Backup hàng ngày**:
```bash
# Cron: 2:00 AM mỗi ngày
0 2 * * * mongodump --uri="mongodb://admin:password123@localhost:27017/credit_card_checker?authSource=admin" --out=/opt/apps/creditv2/db_backups/daily-$(date +\%Y\%m\%d) && find /opt/apps/creditv2/db_backups -name "daily-*" -mtime +7 -exec rm -rf {} \;
```

**Restore**:
```bash
mongorestore --uri="mongodb://admin:password123@localhost:27017/credit_card_checker?authSource=admin" --drop /opt/apps/creditv2/db_backups/daily-20251023/credit_card_checker
```

## Runbook

### Khi ZennoPoster không update

**Triệu chứng**: Queue `checking` tăng cao, không có `checker:card` emit.

**Check**:
1. ZennoPoster có chạy không? Có lỗi network/token không?
2. Backend có nhận request `POST /api/checkcc (LoaiDV=2)` không? Check logs.
3. `handleUpdateStatus.processOne()` có throw error không? Check logs `ErrorId=1`.

**Hành động**:
- Restart ZennoPoster.
- Check token, IP allowlist (nếu có).
- Sweeper sẽ tự reset thẻ kẹt sau timeout.

### Khi DB quá tải

**Triệu chứng**: Response time chậm, CPU/Memory cao.

**Check**:
1. Index có được dùng không? Chạy `explain()` trên các query lớn.
2. Có query full-scan không? Thêm index nếu cần.
3. Connection pool đầy không? Tăng `maxPoolSize`.

**Hành động**:
- Scale MongoDB (replica set, sharding).
- Optimize query (projection, limit).
- Cache kết quả thường dùng (Redis).

### Khi Socket bị flood

**Triệu chứng**: `checker_socket_emit_rate` > 100/s, client lag.

**Check**:
1. Debounce có hoạt động không? Check code `emitSessionUpdateDebounced()`.
2. Có session nào emit quá nhiều không? Check `sessionDebounceTimers` size.
3. Có loop emit không? Check code logic.

**Hành động**:
- Tăng `delayMs` debounce (từ 200ms → 500ms).
- Batch emit nhiều card cùng lúc thay vì từng card.
- Giới hạn số socket connections per user (rate limit).

## Checklist Ops

- [ ] Sweeper chạy mỗi 15s, reset thẻ kẹt về `unknown`.
- [ ] Metrics endpoint `/api/admin/checker/metrics` hoạt động.
- [ ] Alert rules cho error rate, billing mismatch, socket flood, queue stuck.
- [ ] Backup DB hàng ngày, giữ 7 ngày.
- [ ] TTL index hoặc cron purge logs cũ (7–30 ngày).
- [ ] Mask PAN trong logs và audit trail.
- [ ] Runbook cho các sự cố thường gặp.
- [ ] Monitor dashboard (Grafana) hiển thị metrics realtime.
