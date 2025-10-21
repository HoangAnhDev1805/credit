API Check Charge

Hàm Lấy Random Thẻ Về để Check

URL POST API: https://checkcc.live/api/checkcc

Tham số URL:
Token: Token được cấp sau khi login xong
LoaiDV: 1
Device: Mã máy
Amount: Số lượng thẻ cần lấy
TypeCheck: 1  (CheckLive),  2: CheckCharge ( Mặc định sẽ lấy check charge )

ErrorId: 
0: Success
!= 0: Error
TypeCheck:
	1: Check Live
	2: Check Charge
Price: Nếu khác không thì là check charge và mệnh giá check


Result Success:
{
  "ErrorId": 0,
  "Title": "",
  "Message": "",
  "Content": [
    {
      "Id": 2,
      "FullThe": "4020870019137144|07|25|423",
      "TypeCheck": 1,
      "Price": 0
    },
    {
      "Id": 11,
      "FullThe": "4060680532478862|10|26|637",
      "TypeCheck": 1,
      "Price": 0
    }
  ]
}




Result Error:
{
  "ErrorId": 1,
  "Title": "error",
  "Message": "Out of stock",
  "Content": ""
}





Hàm Update Status Thẻ

URL POST API: https://checkcc.live/api/checkcc

Tham số URL:
Token: Token được cấp sau khi login xong
LoaiDV: 2
Device: Mã máy
Id: Lấy trên API 1
Status:
	0: Update về chưa chạy ( Auto sẽ lấy lại để check ở máy khác )
	1: Dang chay
2: Live
	3: Die
	4: Unknow
	5: Charge Success
State (Mã lỗi trên web nếu có. Nếu không có mã lỗi có thể để trống hoặc để 0 )
	

From: (Kết quả check từ đâu)
	1: Google
	2: WM
	3: Zenno
	4: 777

ErrorId: 
1: Update Succcess
0: Update Error
