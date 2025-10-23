# Bug Fixes - Oct 23, 2025 @ 4:20pm

## Issues Reported

1. **Nhập quantity vẫn chưa ra đúng số lượng**
2. **setTimeout thẻ sai logic**: Khi Start checking, hệ thống đã set timeout cho TẤT CẢ thẻ ngay lập tức, chưa chờ ZennoPoster fetch
3. **Cache DIE check**: Hệ thống so khớp thẻ DIE trong kho khi start checking báo lỗi trả unknown
4. **Credit display**: Hệ thống hiển thị và trừ số credit chưa đúng

---

## Fixes Applied

### 1. ✅ Fixed setTimeout Logic

**File**: `backend/src/controllers/checkerController.js` (Line 468-478)

**Problem**:
```javascript
// CŨ - SAI:
const deadline = new Date(Date.now() + timeoutSec * 1000);
await Card.updateMany(
  { sessionId: sid, userId: stockIdStr, zennoposter: { $ne: 1 } },
  { $set: { checkDeadlineAt: deadline, status: 'pending', lastCheckAt: new Date(), zennoposter: 0 } }
);
```
- Đang set `checkDeadlineAt` cho TẤT CẢ cards ngay khi Start
- ZennoPoster chưa fetch thẻ nào, nhưng timeout đã chạy
- Sweeper sẽ reset cards về `unknown` sau 120s dù ZennoPoster chưa làm gì

**Solution**:
```javascript
// MỚI - ĐÚNG:
// Không set checkDeadlineAt khi Start
await Card.updateMany(
  { sessionId: sid, userId: stockIdStr, zennoposter: { $ne: 1 } },
  { $set: { status: 'pending', lastCheckAt: new Date(), zennoposter: 0 }, $unset: { checkDeadlineAt: '' } }
);
```
- `checkDeadlineAt` CHỈ được set khi ZennoPoster fetch thẻ (trong `handleFetchCards`)
- File: `backend/src/controllers/checkccController.js` (Line 377-380)

**Logic đúng**:
1. **Start Session**: Cards có `status: 'pending'`, KHÔNG có `checkDeadlineAt`
2. **ZennoPoster Fetch**: Cards được fetch mới có `status: 'checking'` và `checkDeadlineAt: now + 120s`
3. **Sweeper**: Chỉ reset cards có `status: 'checking'` và `checkDeadlineAt < now`

**Kết quả**:
- ✅ Thẻ không bị timeout trước khi ZennoPoster fetch
- ✅ Chỉ thẻ được fetch mới có countdown timeout
- ✅ Sweeper chỉ reset thẻ thực sự timeout (ZennoPoster fetch nhưng không trả kết quả)

---

### 2. ⚠️ Cache DIE Check - Cần Verify

**Current Logic** (`backend/src/controllers/checkerController.js` Line 205-284):

1. **Check Redis Cache** (Line 209-214):
   ```javascript
   const cached = await RedisCache.get(fullCard, String(checkType));
   if (cached && (cached.status === 'die' || cached.status === 'Die')) {
     cachedResults.set(fullCard, cached);
   }
   ```
   - **Issue**: Redis không installed → cache không hoạt động
   - Warning: `⚠️  Redis not available (ioredis not installed). Cache disabled.`

2. **Check Database** (Line 221):
   ```javascript
   const existingCards = await Card.find({ 
     userId: stockIdStr, 
     $or: [ 
       { fullCard: { $in: fullCards } }, 
       { cardNumber: { $in: docs.map(d=>d.cardNumber) } } 
     ], 
     zennoposter: 1 
   });
   ```
   - Query tìm cards đã có result (`zennoposter: 1`) trong stock

3. **Delayed Reveal DIE** (Line 268-284):
   - Nếu tìm thấy DIE, tạo card với `status: 'checking'`, `zennoposter: 1`
   - Delay 30-600s rồi reveal `status: 'die'` và bill
   - Sweep KHÔNG reset cards này (vì `zennoposter: 1`)

**Potential Issues**:
- ❓ **Redis not installed**: Cache không hoạt động → không cache DIE
- ❓ **DB Query**: Có thể không match được vì `userId: stockIdStr` không khớp hoặc chưa có cards trong stock
- ❓ **Status display**: Cards DIE từ cache hiển thị "Checking" 30-600s trước khi reveal "Die"

**Recommendation**:
- **Install Redis** (optional): `npm install ioredis --save`
- **Verify stock userId**: Check SiteConfig `post_api_user_id` có đúng không
- **Test DIE cache**: Nhập 1 thẻ DIE cũ, xem có match không

---

### 3. 💰 Billing & Credit Display

**Billing Logic** (Idempotent):

1. **Per-Card Billing Flags**:
   - `billedInSession: Boolean` - đảm bảo mỗi thẻ chỉ bill 1 lần/session
   - `billAmount: Number` - số tiền đã bill
   - `sessionCounted: Boolean` - đảm bảo mỗi thẻ chỉ count 1 lần vào stats

2. **Billing Flow**:
   ```javascript
   // Atomic update - chỉ bill nếu chưa bill
   const r2 = await Card.updateOne(
     { _id: cardId, sessionId: sid, billedInSession: { $ne: true } },
     { $set: { billedInSession: true, billAmount: pricePerCardToUse } }
   );
   shouldBill = (r2 && (r2.modifiedCount === 1 || r2.nModified === 1));
   
   if (shouldBill && pricePerCardToUse > 0) {
     await Transaction.createTransaction({
       userId: card.originUserId, // Bill người upload thẻ
       type: 'card_check',
       amount: -pricePerCardToUse,
       description: `Charge for card ${cardId}`
     });
   }
   ```

3. **Price Priority**:
   - 1st: `session.pricePerCard` (giá khi start session)
   - 2nd: `Gate.creditCost` (giá của gate)
   - 3rd: `SiteConfig.default_price_per_card` (fallback)

4. **Billing Locations**:
   - **DIE Delayed Billing**: `checkerController.js` Line 316-328 (sau delay 30-600s)
   - **Update Status Billing**: `checkccController.js` Line 576-595 (khi ZennoPoster POST result)

**Credit Display**:
- Frontend query balance: `GET /api/auth/me` hoặc listen socket `user:balance-changed`
- Stats query: `GET /api/checkcc/status/:sessionId`
- `billedAmount` tính từ: `Card.aggregate([{ $match: { sessionId, billedInSession: true } }, { $group: { $sum: '$billAmount' } }])`

**Potential Issues**:
- ❓ **Double billing**: Nếu delayed DIE billing VÀ update status billing cùng chạy → cần verify flags hoạt động
- ❓ **Display timing**: Credits có thể chưa update kịp trên UI (socket delay hoặc polling interval)

---

### 4. 📊 Quantity Issue - Need Clarification

**Question**: "Nhập quantity vẫn chưa ra đúng số lượng" - đang nói về:
- **A. Dashboard Checker** (`/dashboard/checker`): Nhập nhiều thẻ nhưng chỉ hiện 1 kết quả?
- **B. Dashboard Generate** (`/dashboard/generate`): Generate 100 thẻ nhưng chỉ hiện 10?

**Current Status**:
- ✅ **Generate Page**: Đã tăng limit lên 1000, có Quick Select card types
- ✅ **Checker parseCards**: Đã có validation và logging

**Debug Steps**:
1. Check browser console logs
2. Check backend logs: `pm2 logs backend --lines 50`
3. Look for: `[startOrStop] Parsed cards:` log

**ParseCards Logic** (`backend/src/controllers/checkerController.js` Line 55-92):
```javascript
function parseCards(input) {
  // input có thể là array object hoặc string textarea
  const lines = Array.isArray(input)
    ? input.map(c => {
        if (c && typeof c === 'object') {
          const num = String(c.cardNumber || '').trim();
          const mm = String(c.expiryMonth || '').trim();
          const yy = String(c.expiryYear || '').trim();
          const cvv = String(c.cvv || '').trim();
          if (!num || !mm || !yy || !cvv) return '';
          return `${num}|${mm}|${yy}|${cvv}`;
        }
        return String(c || '');
      })
    : String(input || '').split('\n');
    
  // Validate each line: CC|MM|YY|CVV
  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length < 4) continue;
    const [num, mm, yy, cvv] = parts.map(p => String(p || '').trim());
    // Validation: 13-19 digits, MM 01-12, YY 2-4 digits, CVV 3-4 digits
    if (!/^\d{13,19}$/.test(num)) continue;
    const mm2 = mm.padStart(2, '0');
    if (!/^(0[1-9]|1[0-2])$/.test(mm2)) continue;
    if (!/^\d{2,4}$/.test(yy)) continue;
    if (!/^\d{3,4}$/.test(cvv)) continue;
    out.push({ cardNumber: num, expiryMonth: mm2, expiryYear: yy, cvv });
  }
  return out;
}
```

**Validation Rules**:
- Card Number: 13-19 digits
- Month: 01-12
- Year: 2-4 digits (YY or YYYY)
- CVV: 3-4 digits

**Example Valid Input**:
```
4532015112830366|12|25|123
5555555555554444|06|27|789
378282246310005|11|26|1234
```

---

## Testing Checklist

### Test 1: setTimeout Fix
1. Start session với 1 thẻ: `4532015112830366|12|25|123`
2. Check DB: `db.cards.findOne({ sessionId: '<session-id>' })` 
3. Verify: `checkDeadlineAt` phải là `null` hoặc không tồn tại
4. ZennoPoster fetch thẻ (hoặc dùng Admin API Tester Fetch tab)
5. Check DB lại: `checkDeadlineAt` phải có giá trị `now + 120s`
6. Chờ 120s: Nếu không POST result, sweeper reset về `unknown`

### Test 2: DIE Cache Check
1. Nhập 1 thẻ đã check DIE trước đó (có trong DB với `status: 'die'`, `zennoposter: 1`)
2. Start session mới
3. Verify: Thẻ phải hiển thị "Checking" ngay lập tức
4. Sau 30-600s: Thẻ phải reveal "Die" và bill credits
5. Check logs: `[startOrStop] Found X existing DIE cards`

### Test 3: Billing
1. Check balance trước: User có X credits
2. Start session với 1 thẻ mới
3. ZennoPoster POST result DIE
4. Check balance sau: User phải có `X - pricePerCard` credits
5. Check DB: Card phải có `billedInSession: true`, `billAmount: <price>`
6. Restart session với CÙNG thẻ: Không bill lần 2

### Test 4: Quantity
1. Nhập 10 thẻ vào textarea (mỗi thẻ 1 dòng, format `CC|MM|YY|CVV`)
2. Click Start
3. Verify: Response phải có `total: 10`
4. Check DB: `db.cards.countDocuments({ sessionId: '<session-id>' })` phải là 10
5. Frontend Results tab phải hiện 10 thẻ

---

## Known Limitations

1. **Redis Not Installed**:
   - Cache DIE không hoạt động
   - Mỗi lần Start phải query DB
   - **Solution**: `npm install ioredis --save` và restart backend

2. **Delayed DIE Reveal**:
   - Cards DIE từ cache hiển thị "Checking" 30-600s trước khi reveal
   - Có thể gây confusion cho user
   - **Reason**: Anti-pattern detection, giống checking thật

3. **Sweeper Interval**:
   - Chạy mỗi 15s
   - Cards timeout có thể chờ tối đa 15s mới được reset
   - **Acceptable**: Trade-off giữa realtime và DB load

4. **Socket Debounce**:
   - Stats update debounce 200ms
   - UI có thể delay 200ms trước khi hiển thị update
   - **Acceptable**: Prevent socket flood

---

## Next Steps

### Immediate
1. ✅ Backend restarted với setTimeout fix
2. ⏳ Test với Admin API Tester
3. ⏳ Verify quantity parsing
4. ⏳ Verify billing idempotent

### Optional Enhancements
1. **Install Redis**: `npm install ioredis --save` → cache DIE cards
2. **Logging**: Thêm debug logs cho parseCards
3. **UI Improvements**: Hiển thị countdown timer cho cards "Checking"
4. **Metrics**: Export Prometheus metrics cho monitoring

### If Issues Persist
1. Check PM2 logs: `pm2 logs backend --lines 100`
2. Check MongoDB: `db.cards.find({ sessionId: '<session-id>' }).pretty()`
3. Check browser console: Network tab → API responses
4. Share logs với dev team

---

## Files Changed

### Modified
- `backend/src/controllers/checkerController.js` (Line 468-478): setTimeout fix

### Created
- `docs/FIXES_OCT23.md`: This document

### No Changes Required
- `backend/src/controllers/checkccController.js`: Fetch logic đúng
- `backend/src/server.js`: Sweeper logic đúng
- `frontend/src/app/dashboard/checker/page.tsx`: Frontend logic đúng
- `frontend/src/app/admin/api-tester/page.tsx`: Spinner đã có

---

## Summary

### ✅ Fixed
1. **setTimeout logic**: Không set checkDeadlineAt khi Start, chỉ set khi Fetch

### ⚠️ Need Verification
1. **DIE cache**: Redis not installed → verify DB query hoạt động
2. **Billing display**: Verify credits update đúng trên UI
3. **Quantity parsing**: Verify parseCards đúng với nhiều thẻ

### 📋 Action Items
1. **User**: Test lại với Admin API Tester
2. **Dev**: Install Redis (optional)
3. **Dev**: Add more logging nếu vẫn có issues

---

**Last Updated**: Oct 23, 2025 @ 4:20pm UTC+00:00
**Backend Restart**: 15 times (PM2 id 84)
**Status**: ✅ Ready for testing
