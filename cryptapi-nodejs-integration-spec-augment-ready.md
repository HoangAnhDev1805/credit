# CryptAPI Node.js Integration Spec (Augment‑Ready)

> **Purpose**: Tài liệu .md này mô tả chuẩn tích hợp **CryptAPI** vào ứng dụng **Node.js/Express** theo đúng docs để gửi cho Augment Code. Bao gồm: cấu hình, tạo địa chỉ thanh toán, webhook, xác minh chữ ký, QR code, ước tính phí, quy đổi tiền, multi‑address, retry, logs, test với ngrok và mẫu server chạy được ngay.

---

## 0) Quick Summary
- **SDK**: `@cryptapi/api` (Node >= 20)
- **Create address**: dùng SDK `new CryptAPI(coin, address_out, callback_url, params, cryptapiParams).getAddress()` **hoặc** REST `GET /{ticker}/create/`
- **Webhook**: Public HTTPS **POST** (khuyến nghị `json=1`) → **phải trả `*ok*` (plain text)** trong ≤ 30s
- **Signature**: BẮT BUỘC verify RSA‑SHA256 (header `x-ca-signature`); **POST ký raw body**; **GET ký full URL**
- **Forwarding**: Sau khi confirmed, CryptAPI **tự chuyển** coin từ `address_in` → `address_out` (ví của bạn)
- **Idempotency**: Dùng `uuid` trong webhook để tránh xử lý trùng

---

## 1) Kiến trúc & Luồng
1. App gọi **create** (truyền `callback`/`callback_url` và `address`/`address_out`)
2. CryptAPI trả **`address_in`** để hiển thị cho khách (có thể tạo **QR**) 
3. Khách chuyển coin → CryptAPI phát hiện giao dịch
4. CryptAPI gọi **webhook**: `pending` (tuỳ chọn) và `confirmed` khi đủ confirmations
5. App **trả `*ok*`** và cập nhật đơn (đã thanh toán)

---

## 2) Yêu cầu hệ thống
- Node.js **>= 20**
- Domain HTTPS public để nhận webhook
- Whitelist IP (nếu firewall): `51.77.105.132`, `135.125.112.47`

---

## 3) Biến môi trường (gợi ý)
```env
PORT=3000
BASE_URL=https://your-domain.com
MERCHANT_ADDRESS=YOUR_WALLET_ADDRESS        # address_out
DEFAULT_COIN=btc                            # vd: btc, eth, sol_sol, polygon_pol, trc20/usdt
```

---

## 4) Cài đặt phụ thuộc
```bash
npm i express @cryptapi/api dotenv
```

---

## 5) Tạo địa chỉ nhận thanh toán
### 5.1 SDK (khuyến nghị)
```js
const CryptAPI = require('@cryptapi/api');

const coin = 'btc';
const addressOut = process.env.MERCHANT_ADDRESS; // ví đích của bạn
const callbackUrl = `${process.env.BASE_URL}/webhooks/cryptapi?order_id=123`;

// CHỈ chọn MỘT trong 2: json=1 HOẶC post=1 (KHÔNG đồng thời)
const cryptapiParams = {
  json: 1,             // gửi webhook dạng POST + JSON
  pending: 1,          // nhận thông báo pending
  confirmations: 1,    // số confirmations để coi là confirmed
  // priority: 'default',   // nếu chain hỗ trợ
  // multi_token: 1,        // chỉ bật nếu tự xử lý được token khác
  // convert: 1             // trả kèm giá trị quy đổi FIAT trong webhook
};

const params = { order_id: 123 };

const ca = new CryptAPI(coin, addressOut, callbackUrl, params, cryptapiParams);
const addr = await ca.getAddress();          // => { address_in, minimum_transaction_coin, ... }
const qr   = await ca.getQrcode( /* value? */  , 512); // cần gọi getAddress() trước
```

**Ghi chú**
- `address_out` = ví của bạn (**tiền forward** về đây sau khi confirmed)
- `address_in` = địa chỉ đưa cho khách thanh toán
- **Giới hạn URL**: request `create` ≤ **8192 ký tự**
- **Callback URL là “định danh”**: cùng URL sẽ trả lại cùng `address_in`. Muốn địa chỉ mới ⇒ đổi URL (thường thêm tham số như `?order_id=...`)

### 5.2 REST (không dùng SDK)
```
GET https://api.cryptapi.io/{ticker}/create/
  ?callback=https%3A%2F%2Fyour.site%2Fwebhooks%2Fcryptapi%3Forder_id%3D123
  &address=1H6ZZpRmMnrw8ytepV3BYwMjYYnEkWDqVP
  &json=1
  &pending=1
  &confirmations=1
  &priority=default
```
- `{ticker}`: ví dụ `btc`, `trc20/usdt`, `erc20/usdt`, `sol/sol`, `polygon/pol` ...
- `callback` phải **URL‑encode**
- `address` có thể là **nhiều ví** (xem mục 10)

**Response (rút gọn)**
```json
{
  "address_in": "...",
  "address_out": "...",
  "callback_url": "...",
  "priority": "default",
  "minimum_transaction_coin": 0.00008,
  "status": "success"
}
```

---

## 6) Webhook Endpoint
### 6.1 Yêu cầu
- Public **HTTPS**
- Hỗ trợ **POST** (khuyến nghị `json=1`)
- **Phản hồi** trong ≤ **30s**: HTTP 200 + body **`*ok*`** (plain text)

### 6.2 Retry schedule (exponential backoff)
- 6′ → 12′ → 24′ → … cho đến khi giao dịch **3 ngày tuổi**

### 6.3 Idempotency
- Mỗi webhook có `uuid` → lưu `uuid` đã xử lý; nếu nhận lại, **bỏ qua**

### 6.4 Xác minh chữ ký (bắt buộc)
- Header: `x-ca-signature` (base64). Thuật toán: **RSA‑SHA256**
- Public key lấy từ: `https://api.cryptapi.io/pubkey/`
- Dữ liệu để verify:
  - Webhook **GET** → ký **full URL**
  - Webhook **POST + JSON** → ký **raw body** (string gốc, chưa parse)

**Snippet Node.js (Express)**
```js
const crypto = require('crypto');

function captureRawBody(req, res, next) {
  if (req.originalUrl.startsWith('/webhooks/cryptapi')) {
    req.rawBody = '';
    req.setEncoding('utf8');
    req.on('data', c => req.rawBody += c);
    req.on('end', next);
  } else { next(); }
}

// ... app.use(captureRawBody)

function verifyCryptAPISignature(req, publicKeyPEM) {
  const sigB64 = req.headers['x-ca-signature'];
  if (!sigB64) return false;
  const verifier = crypto.createVerify('RSA-SHA256');
  const data = req.rawBody || '';
  verifier.update(data);
  return verifier.verify(publicKeyPEM, Buffer.from(sigB64, 'base64'));
}
```

### 6.5 Payload (trường thường gặp, có thể khác nhau tuỳ dịch vụ)
- `uuid`: ID duy nhất của webhook
- `pending`: `1` (pending) / `0` (confirmed)
- `coin`
- `address_in`, `address_out`
- `txid_in`, `txid_out`
- `confirmations`
- `value_coin`, `value_forwarded_coin`
- `price` (nếu bật convert)
- `order_id` (tham số bạn đính kèm trong `callback`/`params`)

**Ví dụ (POST + JSON)**
```json
{
  "uuid": "6a5c...",
  "pending": 0,
  "coin": "btc",
  "address_in": "...",
  "address_out": "...",
  "txid_in": "...",
  "txid_out": "...",
  "confirmations": 1,
  "value_coin": "0.00100000",
  "value_forwarded_coin": "0.00098000",
  "order_id": "123"
}
```

---

## 7) QR Code
- **Phải gọi `getAddress()` trước** khi gọi `getQrcode()`
- `getQrcode(value?, size?)` → trả `{ qr_code: <base64>, payment_uri }`
- Hiển thị: `<img src="data:image/png;base64,${qr_code}" />`

---

## 8) Ước tính phí / Quy đổi / Coins hỗ trợ
- **Ước tính phí**: `CryptAPI.getEstimate(coin, addresses=1, priority='default')`
- **Quy đổi**: `CryptAPI.getConvert(coin, value, from)`  
  - `coin`: đích quy đổi (vd: `btc`), `value`: số tiền gốc, `from`: `USD` hoặc crypto
- **Danh sách coin**: `CryptAPI.getSupportedCoins()`

---

## 9) Logs (Debug)
- SDK: `ca.checkLogs()` (sau khi đã tạo `ca` tương ứng)
- Trả danh sách callbacks, thông tin địa chỉ, trạng thái…

---

## 10) Chia tiền nhiều ví (multi‑address)
- Tham số `address=` dạng: `p1@addr1|p2@addr2|...` (tối đa 20 địa chỉ)
- `p` trong `(0.0001 .. 1.0)` và **tổng = 1.0**
- **Minimum** khi chia nhiều ví: nhân với công thức `1 + (N - 1)/3` (N = số địa chỉ)

---

## 11) Minimum Transaction (RẤT QUAN TRỌNG)
- Với mỗi coin/token có **giới hạn tối thiểu**. Giao dịch < min sẽ **bị bỏ qua** (mất tiền)
- Khi tạo address, response có `minimum_transaction_coin` → hiển thị cho khách

---

## 12) Testing với ngrok
- Chạy local server (port 3000)
- `ngrok http 3000` → dùng URL công khai làm `callback`
- Gỡ lỗi: kiểm tra log webhook + `checkLogs()`

---

## 13) Mẫu server Express hoàn chỉnh (Augment dùng trực tiếp)
```js
// server.js
const express = require('express');
const crypto = require('crypto');
const dotenv = require('dotenv');
const CryptAPI = require('@cryptapi/api');
dotenv.config();

const app = express();

// Bắt raw body cho webhook (POST + JSON)
function captureRawBody(req, res, next) {
  if (req.originalUrl.startsWith('/webhooks/cryptapi')) {
    req.rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { req.rawBody += chunk; });
    req.on('end', () => next());
  } else {
    next();
  }
}
app.use(captureRawBody);
app.use(express.json()); // cho các route API khác

const BASE_URL = process.env.BASE_URL;
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS;
const DEFAULT_COIN = process.env.DEFAULT_COIN || 'btc';

// Nên fetch public key động từ https://api.cryptapi.io/pubkey/ lúc start
const CRYPTAPI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
...your fetched key...
-----END PUBLIC KEY-----`;

const db = { orders: new Map(), webhooks: new Set() };

function verifyCryptAPISignature(req) {
  try {
    const sigB64 = req.headers['x-ca-signature'];
    if (!sigB64) return false;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(req.rawBody || '');
    return verifier.verify(CRYPTAPI_PUBLIC_KEY, Buffer.from(sigB64, 'base64'));
  } catch {
    return false;
  }
}

// 1) Tạo checkout: địa chỉ + QR
app.post('/api/checkout', async (req, res) => {
  try {
    const { orderId, coin = DEFAULT_COIN, value } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const notifyUrl = `${BASE_URL}/webhooks/cryptapi?order_id=${encodeURIComponent(orderId)}`;

    const cryptapiParams = { json: 1, pending: 1, confirmations: 1 };
    const params = { order_id: orderId };

    const ca = new CryptAPI(coin, MERCHANT_ADDRESS, notifyUrl, params, cryptapiParams);

    const addressResp = await ca.getAddress();
    const qr = await ca.getQrcode(value, 512); // cần getAddress trước

    db.orders.set(orderId, {
      coin,
      address_in: addressResp.address_in,
      address_out: addressResp.address_out,
      minimum_transaction_coin: addressResp.minimum_transaction_coin,
      payment_uri: qr.payment_uri,
      qr_base64: qr.qr_code,
    });

    res.json({
      status: 'ok', orderId, coin,
      address_in: addressResp.address_in,
      minimum_transaction_coin: addressResp.minimum_transaction_coin,
      payment_uri: qr.payment_uri,
      qr_code_base64: qr.qr_code,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'create checkout failed' });
  }
});

// 2) Webhook
app.post('/webhooks/cryptapi', (req, res) => {
  if (!verifyCryptAPISignature(req)) return res.status(401).send('invalid');

  const p = JSON.parse(req.rawBody || '{}');
  if (!p.uuid || db.webhooks.has(p.uuid)) return res.send('*ok*');

  db.webhooks.add(p.uuid);

  if (p.pending === 1) {
    console.log(`[PENDING] order=${p.order_id} coin=${p.coin} tx=${p.txid_in}`);
  } else {
    console.log(`[CONFIRMED] order=${p.order_id} coin=${p.coin} value=${p.value_coin} fwd=${p.value_forwarded_coin}`);
    // TODO: cập nhật đơn -> paid, kích hoạt dịch vụ, gửi mail, v.v.
  }

  return res.send('*ok*'); // BẮT BUỘC
});

// 3) Ước tính phí
app.get('/api/estimate', async (req, res) => {
  try {
    const coin = req.query.coin || DEFAULT_COIN;
    const addresses = Number(req.query.addresses || 1);
    const priority = req.query.priority || 'default';
    const fees = await CryptAPI.getEstimate(coin, addresses, priority);
    res.json(fees);
  } catch (e) { res.status(500).json({ error: 'estimate failed' }); }
});

// 4) Quy đổi
app.get('/api/convert', async (req, res) => {
  try {
    const coin = req.query.coin || DEFAULT_COIN;
    const value = parseFloat(req.query.value || '0');
    const from = req.query.from || 'USD';
    const conv = await CryptAPI.getConvert(coin, value, from);
    res.json(conv);
  } catch (e) { res.status(500).json({ error: 'convert failed' }); }
});

// 5) Logs
app.get('/api/logs/:coin/:orderId', async (req, res) => {
  try {
    const { coin, orderId } = req.params;
    const order = db.orders.get(orderId);
    if (!order) return res.status(404).json({ error: 'order not found' });

    const notifyUrl = `${BASE_URL}/webhooks/cryptapi?order_id=${encodeURIComponent(orderId)}`;
    const ca = new CryptAPI(coin, MERCHANT_ADDRESS, notifyUrl, { order_id: orderId }, { json: 1 });
    const data = await ca.checkLogs();
    res.json(data);
  } catch (e) { res.status(500).json({ error: 'check logs failed' }); }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`CryptAPI demo listening on :${process.env.PORT || 3000}`);
});
```

---

## 14) REST create (cURL mẫu)
```bash
curl -G "https://api.cryptapi.io/btc/create/"   --data-urlencode "callback=https://your.site/webhooks/cryptapi?order_id=123"   --data-urlencode "address=1H6ZZpRmMnrw8ytepV3BYwMjYYnEkWDqVP"   --data-urlencode "json=1"   --data-urlencode "pending=1"   --data-urlencode "confirmations=1"   --data-urlencode "priority=default"
```

---

## 15) Checklist triển khai
- [ ] Node >= 20, cài `@cryptapi/api`
- [ ] Tạo endpoint webhook HTTPS, trả **`*ok*`** ≤ 30s
- [ ] Bắt raw body & verify chữ ký RSA‑SHA256 (POST ký raw body; GET ký full URL)
- [ ] Lưu `uuid` đã xử lý (idempotent)
- [ ] Luôn hiển thị `minimum_transaction_coin` cho khách
- [ ] Truyền đúng `address`/`address_out` (ví đích)
- [ ] (Tuỳ chọn) Bật `pending`, `confirmations`, `priority`
- [ ] (Nếu dùng multi‑address) tổng tỷ lệ = 1.0, để ý min nâng theo công thức
- [ ] Test qua ngrok, kiểm tra logs & callback

---

## 16) Ghi chú & Cạm bẫy phổ biến
- **`post` vs `json`**: **KHÔNG** dùng đồng thời. Chọn **một**. Khuyến nghị `json=1` (POST + JSON)
- **Ticker/Chain** phải khớp ví: TRC20‑USDT ≠ ERC20‑USDT
- Nếu dùng **địa chỉ nạp của sàn**, cân nhắc **không bật** `multi_token` (địa chỉ token khác chain có thể khác nhau)
- Request `create` dài quá **8192** ký tự sẽ bị từ chối
- Callback URL **giữ địa chỉ** → muốn địa chỉ mới phải thay URL (hoặc thêm tham số khác)

---

> **Hết.** Bạn có thể giao file này cho Augment Code để scaffold server & routes. Nếu muốn biến thành **Next.js Route Handlers** hoặc **TypeScript** (types cho payload, Redis lock idempotency), hãy nói rõ stack mình sẽ xuất thêm phiên bản phù hợp.
