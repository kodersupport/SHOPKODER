# KODER SHOP ADMIN

Admin panel quản lý:
- **Kho hàng** (stock / hết hàng)
- **Mã giảm giá** (coupon % hoặc số tiền)
- **Thông báo** (notice)

Chạy trên **Render** + code lưu trên **GitHub**.

---

## BƯỚC 1 — Tạo repo GitHub

1. Vào https://github.com/new
2. Tên repo: `koder-shop-admin` (hoặc tên bất kỳ)
3. Chọn **Public**
4. **Không** tick README
5. Bấm **Create repository**

---

## BƯỚC 2 — Upload code lên GitHub

### Cách A (dễ nhất — kéo thả):

1. Tải toàn bộ thư mục project này về máy (zip)
2. Giải nén
3. Vào repo vừa tạo trên GitHub
4. Bấm **uploading an existing file**
5. Kéo **tất cả file và thư mục** vào (package.json, server.js, data/, public/, ...)
6. Bấm **Commit changes**

### Cách B (nếu biết dùng Git):

```bash
git init
git add .
git commit -m "Koder shop admin"
git branch -M main
git remote add origin https://github.com/TEN-BAN/koder-shop-admin.git
git push -u origin main
```

---

## BƯỚC 3 — Deploy lên Render

1. Vào https://render.com → **Sign up** (dùng GitHub)
2. Bấm **New +** → **Web Service**
3. Connect repo `koder-shop-admin`
4. Điền:
   | Field | Giá trị |
   |-------|---------|
   | Name | `koder-shop-admin` |
   | Runtime | **Node** |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

5. Bấm **Advanced** → **Add Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `ADMIN_PASSWORD` | `mat_khau_cua_ban` (đặt mật khẩu mạnh) |
   | `SESSION_SECRET` | `chuoi_ngau_nhien_bat_ky_123abc` |

6. Bấm **Create Web Service**
7. Đợi ~2–5 phút đến khi status **Live**
8. Copy URL (ví dụ: `https://koder-shop-admin.onrender.com`)

---

## BƯỚC 4 — Vào Admin

Mở trình duyệt:

```
https://TEN-APP-CUA-BAN.onrender.com/admin
```

Nhập mật khẩu đã đặt ở `ADMIN_PASSWORD`.

---

## API công khai (shop có thể gọi)

| Method | URL | Mô tả |
|--------|-----|-------|
| GET | `/api/products` | Danh sách sản phẩm + stock |
| GET | `/api/coupons` | Mã giảm giá đang active |
| GET | `/api/notices` | Thông báo đang hiện |
| POST | `/api/coupons/validate` | Body: `{ "code": "KODER10" }` |

---

## Lưu ý quan trọng (Render Free)

- Free tier **sleep** sau ~15 phút không dùng → lần mở sau sẽ chậm 30–60s (normal).
- Disk free **không bền**: khi Render restart, file JSON có thể về bản gốc trong repo.
- **Cách giữ dữ liệu lâu dài** (khuyên dùng):
  1. Sau khi chỉnh kho/mã trên Admin, tải file `data/*.json` về (hoặc copy nội dung từ Admin).
  2. Commit lại lên GitHub.
  3. Hoặc upgrade Render (paid) có persistent disk.

---

## Chạy thử trên máy (tùy chọn)

```bash
cd koder-shop-admin
npm install
npm start
```

Mở: http://localhost:3000/admin  
Mật khẩu mặc định: `koder_admin_2026`

---

## Kết nối với trang shop hiện tại

Shop HTML của bạn vẫn dùng được. Khi muốn đồng bộ kho/coupon:

1. Trong shop, gọi API:
   ```js
   const API = 'https://TEN-APP-CUA-BAN.onrender.com';
   const products = await fetch(API + '/api/products').then(r => r.json());
   const coupons  = await fetch(API + '/api/coupons').then(r => r.json());
   const notices  = await fetch(API + '/api/notices').then(r => r.json());
   ```
2. Dùng `products[].durations[].stock` để hiện "Hết hàng" khi stock = 0.
3. Dùng `/api/coupons/validate` khi khách nhập mã giảm giá.

---

© Koder Shop Admin
