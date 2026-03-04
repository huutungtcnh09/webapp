# Orders API

Tài liệu nhanh cho nhóm endpoint quản lý đơn hàng.

Base URL: `/api`

Yêu cầu chung:
- Header `Authorization: Bearer <token>`
- Quyền:
  - `admin`, `manager`, `sales`: tạo/xem/cập nhật/hủy đơn
  - `admin`, `manager`: xóa đơn

## 1) Tạo đơn hàng

**POST** `/orders`

Body mẫu:

```json
{
  "customerName": "Nguyen Van A",
  "customerPhone": "0909123456",
  "customerAddress": "123 Le Loi, Q1",
  "discountAmount": 10000,
  "taxAmount": 5000,
  "status": "confirmed",
  "note": "Giao trong giờ hành chính",
  "items": [
    {
      "productId": "1",
      "quantity": 2,
      "unitPrice": 150000,
      "note": "Màu đỏ"
    },
    {
      "productName": "Sản phẩm tùy chỉnh",
      "unit": "cái",
      "quantity": 1,
      "unitPrice": 50000
    }
  ]
}
```

Response `201`:
- Trả về thông tin đơn vừa tạo và danh sách `items`.
- Backend tự tính `lineTotal`, `subtotal`, `totalAmount`.

## 2) Danh sách đơn hàng

**GET** `/orders`

Query hỗ trợ:
- `status`: `draft|confirmed|completed|cancelled`
- `q`: tìm theo `orderCode`, tên/điện thoại khách hàng
- `limit`: mặc định `50`, tối đa `200`

Ví dụ:

`GET /api/orders?status=confirmed&q=0909&limit=20`

Response `200`:
- Trả mảng đơn hàng, có `itemCount` cho mỗi đơn.

## 3) Chi tiết đơn hàng

**GET** `/orders/:id`

Response `200`:
- Trả chi tiết đơn và mảng `items` của đơn đó.

## 4) Cập nhật đơn hàng

**PUT** `/orders/:id`

Ghi chú:
- Có thể cập nhật một phần field (`customerName`, `customerPhone`, `customerAddress`, `status`, `discountAmount`, `taxAmount`, `note`).
- Nếu gửi `items`, backend sẽ **thay toàn bộ** chi tiết đơn cũ bằng danh sách mới.
- Backend tự tính lại `subtotal` và `totalAmount`.

Body mẫu cập nhật toàn bộ:

```json
{
  "customerName": "Nguyen Van B",
  "status": "completed",
  "discountAmount": 0,
  "taxAmount": 10000,
  "items": [
    {
      "productId": "2",
      "quantity": 3,
      "unitPrice": 200000
    }
  ]
}
```

## 5) Cập nhật trạng thái đơn

**PATCH** `/orders/:id/status`

Body mẫu:

```json
{
  "status": "completed"
}
```

## 6) Hủy đơn hàng

**POST** `/orders/:id/cancel`

Body mẫu:

```json
{
  "note": "Khách không nhận hàng"
}
```

Kết quả:
- Đơn được chuyển sang trạng thái `cancelled`.
- Nếu có `note`, backend sẽ nối vào ghi chú hiện tại của đơn.

## 7) Xóa đơn hàng

**DELETE** `/orders/:id`

Quyền: `admin`, `manager`.

Kết quả:
- Xóa đơn và toàn bộ `order_items` liên quan (cascade).

## Mã lỗi thường gặp

- `400`: dữ liệu không hợp lệ (`id`, `status`, `items`, số lượng/đơn giá...)
- `401`: thiếu/invalid token
- `403`: không đủ quyền
- `404`: không tìm thấy đơn hàng hoặc sản phẩm
- `409`: trùng `orderCode`
- `500`: lỗi server/database
