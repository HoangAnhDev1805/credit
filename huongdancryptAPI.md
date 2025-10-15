# CryptAPI Node.js Integration Spec (Augment-Ready)

> **Purpose**: Hướng dẫn này mô tả đầy đủ cách tích hợp **CryptAPI** vào ứng dụng **Node.js/Express**. File này dành cho Augment Code để triển khai. Bao gồm cấu hình domain/ví, tạo địa chỉ thanh toán, webhook, xác minh chữ ký, xử lý coin BTC/LTC/USDT (BEP20), QR code, ước tính phí, quy đổi tiền, multi-address, retry, logs, test với ngrok và server mẫu.

---

## 0) Thông tin domain & ví của bạn
- **Domain UI**: `https://checkcc.live/dashboard/crypto-payment`
- **Webhook**: `https://checkcc.live/webhooks/cryptapi`
- **Ví nhận (address_out):**
  - BTC: `bc1qh470yfvl8m0udc5tyg4p9casvddtx9gndstrpj` (coin = `btc`)
  - LTC: `ltc1q6d8j7u6z3w27vshe9e74l8gxhtuar5n3n8fhml` (coin = `ltc`)
  - USDT BEP20: `0xE4c697Af28946E0a3fC5F1Ce1639635eBEC2D5fE` (coin = `bep20/usdt`)

---

## 1) Biến môi trường
```env
PORT=3000
BASE_URL=https://checkcc.live
WEBHOOK_PATH=/webhooks/cryptapi

# Ví đích
BTC_ADDRESS=bc1qh470yfvl8m0udc5tyg4p9casvddtx9gndstrpj
LTC_ADDRESS=ltc1q6d8j7u6z3w27vshe9e74l8gxhtuar5n3n8fhml
USDT_BEP20_ADDRESS=0xE4c697Af28946E0a3fC5F1Ce1639635eBEC2D5fE

DEFAULT_COIN=btc
```

---

## 2) Cài đặt
```bash
npm i express @cryptapi/api dotenv
```

---

## 3) Hàm chọn ví theo coin
```js
const ADDR = {
  btc: process.env.BTC_ADDRESS,
  ltc: process.env.LTC_ADDRESS,
  'bep20/usdt': process.env.USDT_BEP20_ADDRESS,
};

function getMerchantAddress(coin) {
  if (ADDR[coin]) return ADDR[coin];
  throw new Error(`No merchant address configured for coin: ${coin}`);
}
```

---

## 4) Tạo checkout
```js
app.post('/api/checkout', async (req, res) => {
  try {
    const { orderId, coin = DEFAULT_COIN, value } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    let merchantAddress;
    try { merchantAddress = getMerchantAddress(coin); }
    catch { return res.status(400).json({ error: `coin not supported: ${coin}` }); }

    const notifyUrl = `${BASE_URL}${WEBHOOK_PATH}?order_id=${encodeURIComponent(orderId)}`;

    const cryptapiParams = { json: 1, pending: 1, confirmations: 1 };
    const params = { order_id: orderId };

    const ca = new CryptAPI(coin, merchantAddress, notifyUrl, params, cryptapiParams);
    const addressResp = await ca.getAddress();
    const qr = await ca.getQrcode(value, 512);

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
```

---

## 5) Webhook
- Endpoint: `POST /webhooks/cryptapi`
- Trả về: `*ok*` (plain text) trong ≤ 30s
- Kiểm tra chữ ký: dùng header `x-ca-signature` với RSA-SHA256 (public key: https://api.cryptapi.io/pubkey/)
- Payload chứa: `uuid`, `pending`, `coin`, `address_in`, `address_out`, `txid_in`, `txid_out`, `value_coin`, `value_forwarded_coin`, `order_id`
- **Idempotency**: lưu `uuid` đã xử lý, bỏ qua callback trùng

---

## 6) Ví dụ webhook JSON
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

## 7) QR code
```js
const qr = await ca.getQrcode(0.001, 512);
<img src={`data:image/png;base64,${qr.qr_code}`} />
```

---

## 8) Estimate & Convert
```js
await CryptAPI.getEstimate('btc', 1, 'default');
await CryptAPI.getConvert('btc', 100, 'USD');
```

---

## 9) Multi-address
```text
0.7@addr1|0.3@addr2   # 70% về addr1, 30% về addr2
```

---

## 10) Checklist triển khai
- [x] Node >= 20
- [x] Tạo webhook HTTPS `/webhooks/cryptapi`
- [x] Verify chữ ký RSA-SHA256
- [x] Lưu `uuid` để idempotent
- [x] Hiển thị `minimum_transaction_coin`
- [x] Truyền đúng ví (`BTC_ADDRESS`, `LTC_ADDRESS`, `USDT_BEP20_ADDRESS`)
- [x] Test bằng ngrok

---

## 11) Lưu ý khi dùng ví Binance
- **Có thể dùng**, nhưng phải đảm bảo chọn đúng chain (TRC20 ≠ ERC20 ≠ BEP20)
- KHÔNG bật `multi_token` khi dùng ví sàn
- Coin có Memo/Tag (XRP, BNB, XLM, …) không nên dùng vì forward không gửi kèm Memo/Tag
- Nên test trước bằng số nhỏ