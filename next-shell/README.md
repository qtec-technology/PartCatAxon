# PartCatalog Next Shell

**Active frontend** สำหรับ Part Catalog — Next.js 16 + React 19 + TypeScript BFF/Shell

สำหรับ AI agent: อ่าน `../.github/copilot-instructions.md` ก่อนเริ่มงานทุกครั้ง

## สถานะปัจจุบัน

- Native pages: `/partcatalog`, `/item/[id]`, `/item/new`, `/term/[itemId]`
- Bulk Cost workspace: `/bulk-cost` (interactive UI, mock data)
- `/api/*` BFF proxy → Express (port 3001)
- 33 unit tests ผ่าน (vitest)

## Development URL

```text
http://localhost:3010
```

## คำสั่งที่ใช้บ่อย

```powershell
# จาก root PartCatalogApp/
npm run dev:next     # รัน next-shell เท่านั้น
npm run typecheck    # TypeScript check
npm test             # Unit tests (ต้องผ่าน 33)
npm run build        # Build check

# หรือจาก next-shell/ โดยตรง
npm --prefix .\next-shell run dev
npm --prefix .\next-shell run typecheck
npm --prefix .\next-shell test -- --run
npm --prefix .\next-shell run build
```

## ข้อควรระวัง

อย่าให้มีไฟล์ `package-lock.json` ที่ root `PartCatalogApp/`
Turbopack จะสับสนและหา `tailwindcss` ผิดที่ (ดู `docs/ARCHITECTURE.md` section 4)

## Migration Rule

คง Express API ไว้เป็น stable core จนกว่าแต่ละ Next.js page จะผ่าน UI parity + workflow check
