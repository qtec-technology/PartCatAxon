# QTEC Part Catalog

ระบบ Part Catalog แบบ Web Application สำหรับใช้งานภายในเครือข่ายองค์กร แทนระบบเดิมที่ทำงานบน Microsoft Access โดยยังคง business flow หลักของ `Item`, `Term`, `Search`, `Attachment`, และ `Calculation` ไว้

## ภาพรวมระบบ

- `client/` = Frontend (React + Vite)
- `server/` = Backend API (Node.js + Express + TypeScript)
- `SQL Server` = ฐานข้อมูลหลัก
- `File Server` = เก็บรูป `Item` และ `Attachment`

ระบบนี้ออกแบบให้:
- ฝั่งเว็บเรียก API ผ่าน `/api/*`
- Frontend dev server ทำงานที่ `http://localhost:5173/#/`
- Backend API ทำงานที่ `http://localhost:3001`
- Production ใช้ Windows Authentication เป็นหลัก

## สิ่งที่ต้องมีในเครื่อง

- Windows environment
- Node.js 22+ และ npm
- สิทธิ์เข้าถึง SQL Server
- สิทธิ์เข้าถึง network share สำหรับ:
  - `ITEM_IMAGE_DIR`
  - `ATTACHMENT_DIR`
  - `USER_PICTURE_DIR` (ถ้าใช้งานรูป profile)

## โครงสร้างโปรเจค

```text
PartCatalogApp/
  client/   # React + Vite frontend
  server/   # Express + TypeScript API
```

## ดึงโปรเจคครั้งแรก

```powershell
git clone https://github.com/qtec-technology/PartCatalog.git PartCatalogApp
cd PartCatalogApp
```

ติดตั้ง dependencies แยก 2 ส่วน

```powershell
npm --prefix .\client ci
npm --prefix .\server ci
```

## กรณีมีโปรเจคอยู่แล้วและต้องการดึงโค้ดล่าสุด

```powershell
cd PartCatalogApp
git pull origin main
npm --prefix .\client ci
npm --prefix .\server ci
```

หมายเหตุ:
- ถ้า `package-lock.json` ไม่เปลี่ยน อาจใช้แค่ `git pull` ก็พอ
- ถ้าหลัง pull แล้ว dependency เปลี่ยน ให้รัน `npm ci` ใหม่ทั้ง `client` และ `server`

## ตั้งค่า Environment

### 1. Frontend

คัดลอกไฟล์ตัวอย่าง

```powershell
Copy-Item .\client\.env.example .\client\.env
```

ค่าหลักที่ต้องตรวจ:

```env
VITE_APP_BASE_PATH=/
VITE_API_PROXY_TARGET=http://localhost:3001
```

คำอธิบาย:
- `VITE_APP_BASE_PATH` ใช้กำหนด base path ของเว็บ
- `VITE_API_PROXY_TARGET` ใช้ให้ Vite proxy `/api/*` ไป backend ตอนรัน dev

### 2. Backend

คัดลอกไฟล์ตัวอย่าง

```powershell
Copy-Item .\server\.env.example .\server\.env
```

ค่าหลักที่ต้องตั้งใน `server/.env`

```env
NODE_ENV=development
PORT=3001

DB_HOST=<SQL_SERVER_HOST>
DB_PORT=1433
DB_NAME_QTEC=<QTEC_DATABASE_NAME>
DB_NAME_SAP=<SAP_DATABASE_NAME>
DB_USER=<SQL_USERNAME>
DB_PASSWORD=<ASK_ADMIN_FOR_PASSWORD>

ITEM_IMAGE_DIR=\\<FILE_SERVER>\AttachmentItemImage
ATTACHMENT_DIR=\\<FILE_SERVER>\Attachment
USER_PICTURE_DIR=\\<FILE_SERVER>\_PartCat_Resource\user_picture

CORS_ALLOWED_ORIGINS=http://localhost:5173

ROLE_MANAGERS=
ROLE_SUPERVISORS=

DEV_DISPLAY_NAME=
DEV_EMAIL=
```

คำอธิบายสำคัญ:
- `ITEM_IMAGE_DIR` และ `ATTACHMENT_DIR` เป็น required env
- ไม่มี local fallback path แล้ว ถ้าไม่ตั้ง server จะ start ไม่ขึ้น
- `ROLE_MANAGERS` และ `ROLE_SUPERVISORS` ใช้เฉพาะ non-production
- `DEV_DISPLAY_NAME` และ `DEV_EMAIL` ใช้เฉพาะ non-production
- Production ใช้ Windows Auth headers / Windows permissions เท่านั้น

## วิธีรันระบบในโหมดพัฒนา

ต้องเปิด 2 terminal

### Terminal 1: Backend

```powershell
cd PartCatalogApp
npm --prefix .\server run dev
```

### Terminal 2: Frontend

```powershell
cd PartCatalogApp
npm --prefix .\client run dev
```

จากนั้นเปิด:

```text
http://localhost:5173/#/
```

## วิธี build

### Build backend

```powershell
npm --prefix .\server run build
```

### Build frontend

```powershell
npm --prefix .\client run build
```

## วิธีรัน backend จาก build output

```powershell
npm --prefix .\server run start
```

หมายเหตุ:
- `server` จะรันจาก `dist/index.js`
- `client` หลัง build จะได้ไฟล์ใน `client/dist/`

## คำสั่งที่ใช้บ่อย

### Frontend

```powershell
npm --prefix .\client run dev
npm --prefix .\client run build
```

### Backend

```powershell
npm --prefix .\server run dev
npm --prefix .\server run build
npm --prefix .\server run start
npm --prefix .\server test
```

## ตรวจสอบว่า backend พร้อมใช้งานหรือไม่

เปิด:

```text
http://localhost:3001/api/health
```

ถ้าปกติควรได้ response แนว `ok`

## พฤติกรรมสำคัญที่ควรรู้

- Frontend ใช้ `HashRouter`
  - URL จะเป็นรูปแบบ `/#/item/123`
  - เหตุผลคือช่วยให้ deploy ง่ายใน environment ที่ยังไม่ได้ตั้ง rewrite rule

- Attachment และ Item image เขียนไฟล์ไปที่ network share โดยตรง
  - `POST /api/items/:id/image`
  - `POST /api/attachments`

- การลบข้อมูลใช้สิทธิ์ตาม role / ownership
  - `Item` และ `Term`: `owner / supervisor / manager`
  - `Attachment`: `owner / supervisor / manager`

- `Item` ยังห้ามลบถ้ายังมี `Term` อยู่

- Production authentication:
  - ใช้ Windows Authentication only
  - ไม่ fallback ไป `ROLE_*` env แล้ว

## Troubleshooting

### 1. Server start ไม่ขึ้น

ตรวจสอบ:
- `server/.env` ตั้งค่าครบหรือยัง
- SQL Server เข้าถึงได้หรือไม่
- path ของ `ITEM_IMAGE_DIR` / `ATTACHMENT_DIR` ใช้งานได้หรือไม่

### 2. แนบไฟล์ได้แต่ไฟล์ไม่ไป network share

ตรวจสอบ:
- ค่า `ATTACHMENT_DIR`
- สิทธิ์ของ process ที่รัน Node.js
- สิทธิ์เขียนไปยัง UNC path

### 3. อัปโหลดรูป item ไม่สำเร็จ

ตรวจสอบ:
- ค่า `ITEM_IMAGE_DIR`
- ประเภทไฟล์ต้องเป็น `JPG`, `PNG`, `GIF`

### 4. Frontend เรียก API ไม่ได้ตอน dev

ตรวจสอบ:
- backend รันอยู่หรือไม่ที่ `http://localhost:3001`
- `client/.env` มี `VITE_API_PROXY_TARGET=http://localhost:3001`

### 5. Login/role ไม่ตรงในเครื่อง dev

ตรวจสอบ:
- `NODE_ENV=development`
- `ROLE_MANAGERS`
- `ROLE_SUPERVISORS`
- `DEV_DISPLAY_NAME`
- `DEV_EMAIL`

## ลำดับการเริ่มงานสำหรับเครื่องใหม่

ถ้าต้อง setup ตั้งแต่ศูนย์ ให้ทำตามนี้

```powershell
git clone https://github.com/qtec-technology/PartCatalog.git PartCatalogApp
cd PartCatalogApp
npm --prefix .\client ci
npm --prefix .\server ci
Copy-Item .\client\.env.example .\client\.env
Copy-Item .\server\.env.example .\server\.env
```

จากนั้นแก้ค่าใน `.env` ทั้ง 2 ฝั่ง แล้วรัน

```powershell
npm --prefix .\server run dev
npm --prefix .\client run dev
```

## ลำดับการอัปเดตโค้ดสำหรับเครื่องที่มีโปรเจคอยู่แล้ว

```powershell
cd PartCatalogApp
git pull origin main
npm --prefix .\client ci
npm --prefix .\server ci
npm --prefix .\server run dev
npm --prefix .\client run dev
```

## หมายเหตุสำหรับทีม

- เอกสารวิเคราะห์เชิงลึกบางส่วนอยู่นอก repo หลักและไม่ได้ถูก push ขึ้น git
- ถ้าจะ deploy production ต้องเตรียม:
  - Windows Auth / IIS integration
  - SQL Server access
  - file share permissions
  - CORS origins ที่ถูกต้อง

