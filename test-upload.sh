#!/bin/bash

echo "=== Test Upload và Favicon ==="

# 1. Đăng nhập admin
echo "1. Đăng nhập admin..."
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin123"}' \
  http://localhost:5001/api/auth/login | jq -r '.data.token')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Lỗi đăng nhập admin"
  exit 1
fi
echo "✅ Đăng nhập thành công"

# 2. Upload ảnh logo
echo "2. Upload ảnh logo..."
UPLOAD_RESULT=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@frontend/public/logo.png" \
  http://localhost:5001/api/upload/image)

UPLOAD_URL=$(echo $UPLOAD_RESULT | jq -r '.url')
if [ "$UPLOAD_URL" = "null" ]; then
  echo "❌ Lỗi upload ảnh: $UPLOAD_RESULT"
  exit 1
fi
echo "✅ Upload thành công: $UPLOAD_URL"

# 3. Cập nhật favicon trong database
echo "3. Cập nhật favicon trong database..."
UPDATE_RESULT=$(curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"favicon\":\"$UPLOAD_URL\"}" \
  http://localhost:5001/api/admin/site-config)

if [ "$(echo $UPDATE_RESULT | jq -r '.success')" != "true" ]; then
  echo "❌ Lỗi cập nhật favicon: $UPDATE_RESULT"
  exit 1
fi
echo "✅ Cập nhật favicon thành công"

# 4. Kiểm tra API public
echo "4. Kiểm tra API public..."
PUBLIC_CONFIG=$(curl -s http://localhost:5001/api/config/public)
CURRENT_FAVICON=$(echo $PUBLIC_CONFIG | jq -r '.data.general.site_favicon')

if [ "$CURRENT_FAVICON" = "$UPLOAD_URL" ]; then
  echo "✅ Favicon đã được cập nhật trong API public: $CURRENT_FAVICON"
else
  echo "❌ Favicon chưa được cập nhật. Expected: $UPLOAD_URL, Got: $CURRENT_FAVICON"
fi

# 5. Test truy cập ảnh
echo "5. Test truy cập ảnh..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001$UPLOAD_URL)
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Ảnh có thể truy cập được: http://localhost:5001$UPLOAD_URL"
else
  echo "❌ Không thể truy cập ảnh: HTTP $HTTP_STATUS"
fi

echo ""
echo "=== Kết quả test ==="
echo "Upload URL: $UPLOAD_URL"
echo "Favicon trong DB: $CURRENT_FAVICON"
echo "HTTP Status: $HTTP_STATUS"
echo ""
echo "Để test trên frontend:"
echo "1. Vào http://localhost:3004/admin/settings"
echo "2. Upload ảnh favicon mới"
echo "3. Refresh trang để thấy favicon thay đổi"
