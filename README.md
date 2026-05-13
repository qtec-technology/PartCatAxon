# QTEC Part Catalog

PartCatalog is an internal web application for Item, Term, Attachment, Calculation, and Bulk Cost workflows.

## Current Architecture

```text
Browser
  -> next-shell (Next.js 16 + React 19, port 3010)
      -> /api/[...path] proxy
          -> server (Express + TypeScript, port 3001)
              -> SQL Server
              -> network file shares
```

`next-shell/` is the active frontend. `server/` remains the backend API. `client/` is a legacy React/Vite frontend kept only as temporary reference during retirement and must not be part of normal dev or deploy.

Read [.docs/CLIENT_RETIREMENT_PLAN.md](.docs/CLIENT_RETIREMENT_PLAN.md) before deleting `client/`.

## Project Structure

```text
PartCatalog/
  next-shell/  Active Next.js frontend and BFF proxy
  server/      Express API, DB access, auth, file-share logic
  .docs/       Technical docs and handoff plans
  .github/     Agent instructions
```

## Requirements

- Windows environment
- Node.js 22+ and npm
- Access to SQL Server
- Access to required network shares:
  - `ITEM_IMAGE_DIR`
  - `ATTACHMENT_DIR`
  - `USER_PICTURE_DIR`

## Install

```powershell
npm --prefix .\server ci
npm --prefix .\next-shell ci
```

## Environment

Create or update:

```powershell
Copy-Item .\server\.env.example .\server\.env
```

Key local values:

```env
# server/.env
NODE_ENV=development
PORT=3001
CORS_ALLOWED_ORIGINS=http://localhost:3010
CORS_ORIGIN=http://localhost:3010
```

```env
# next-shell/.env.local
EXPRESS_API_URL=http://localhost:3001
EXPRESS_CSRF_ORIGIN=http://localhost:3010
```

## Development

From repo root:

```powershell
npm run dev
```

This starts:

- Express API: `http://localhost:3001`
- Next.js app: `http://localhost:3010`

Separate commands:

```powershell
npm run dev:server
npm run dev:next
```

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Current verified baseline:

- `npm run typecheck` passes for `server` and `next-shell`
- `npm test` passes: `server` 37 tests, `next-shell` 33 tests
- `npm run build` passes for `server` and `next-shell`
- Production smoke passed:
  - `GET http://localhost:3001/api/health` -> `200`
  - `GET http://localhost:3010/api/health` -> `200`
  - `GET http://localhost:3010/` -> `307 /partcatalog`
  - `GET http://localhost:3010/partcatalog` -> `200`
  - `GET http://localhost:3010/api/items?page=1&pageSize=1` -> `200`

## Production Shape

Run as two services:

```powershell
npm --prefix .\server run build
npm --prefix .\server start

npm --prefix .\next-shell run build
npm --prefix .\next-shell start
```

Recommended reverse proxy:

```text
https://partcatalog.example.local -> http://127.0.0.1:3010
next-shell /api/[...path]         -> http://127.0.0.1:3001
```

Production env must set matching origins:

```env
# next-shell
EXPRESS_API_URL=http://127.0.0.1:3001
EXPRESS_CSRF_ORIGIN=https://partcatalog.example.local

# server
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://partcatalog.example.local
```

## Important Rules

- Do not move `server/` into `next-shell/` during this cutover.
- Do not deploy or run `client/` as the active frontend.
- Term calculation remains backend source of truth.
- Bulk Cost backend persistence must wait for approved schema/rules in `.docs`.
- Keep docs updated when architecture or workflow changes.
