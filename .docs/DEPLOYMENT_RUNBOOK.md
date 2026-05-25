# Deployment Runbook

Last updated: 2026-05-19

This runbook is the target deployment direction for PartCatalogAxon after the
May 2026 server incident. It is intentionally conservative and keeps the current
Express API while aligning runtime with AXON's Nginx/NSSM environment.

## Target Topology

```text
Nginx :80/:443
  ├── axon.<internal-domain>        -> AXON app
  └── partcatalog.<internal-domain> -> PartCatalogAxon Next.js

PartCatalogAxon
  ├── Next.js standalone service
  └── Express API service

Data
  ├── PART_CATALOG_AIX
  ├── SBOQTEC
  ├── AXON read-only views/shared tables
  └── UNC file shares for attachments/images
```

## Port Ownership

Ports must be explicit and must not compete for `80` directly.

| Component | Suggested Port | Public Exposure |
|---|---:|---|
| Nginx HTTP | 80 | Yes |
| Nginx HTTPS | 443 | Yes |
| PartCatalogAxon Next.js | 3010 | No, Nginx only |
| PartCatalogAxon Express API | 3001 | No, Next/BFF or Nginx internal only |
| AXON app | Confirm with Pi-Jo | No, Nginx only |

## Certificates

- Use an internal CA from the domain controller.
- Bind certificates at Nginx.
- Do not rely on free public DNS auto-renew flows for old Windows Server
  compatibility.

## Service Model

Use NSSM-managed services for long-running Node processes.

```text
PartCatalogAxon Next service
PartCatalogAxon Express API service
AXON services owned by Pi-Jo
```

Each service must document:

- executable path
- working directory
- environment file
- stdout/stderr log path
- restart policy
- stop command

## Auth Headers

PartCatalogAxon uses trusted proxy headers as the production auth transport.
The target path is:

```text
Domain auth / SSO / reverse proxy auth
  -> Nginx trusted headers
  -> PartCatalogAxon Express auth middleware
```

The trusted proxy layer must set identity headers only after authentication:

| Header | Meaning |
|---|---|
| `x-forwarded-user` | `DOMAIN\username` or `username@domain` |
| `x-forwarded-email` | user email |
| `x-forwarded-name` | display name |
| `x-forwarded-groups` | semicolon/comma-separated catalog AD groups |
| `x-forwarded-roles` | optional role aliases |

Keep `AUTH_TRUST_PROXY_HEADERS=true`. Do not expose the Express API port
directly to browsers; only the trusted proxy/Next BFF should reach it.

## Deploy Protocol

1. Create or review PR. Do not patch production code directly.
2. Run local verification:

   ```powershell
   npm run typecheck
   npm test
   npm run build
   ```

3. Build deploy artifacts.
4. Stop only the PartCatalogAxon services being deployed.
5. Apply artifact/config changes.
6. Start services.
7. Run smoke tests.
8. Check logs.
9. Roll back immediately if health/smoke checks fail.

## Required Smoke Tests

- Next.js page loads through Nginx.
- Express API health is reachable through the expected path.
- Search page returns data.
- Item view/edit/save preserves local SQL Server `UpdatedDate`.
- Term view/edit/save/calculation works.
- Attachment list/upload path can reach the UNC share.
- AXON handoff view can be read by `ChainId` once available.

## Rollback Requirement

Before any deploy, keep the previous deploy artifact and config snapshot. A
rollback must not require editing code on the server.

## Database User Rule

Application connections must use least privilege. Do not use a SQL admin account
for normal PartCatalogAxon runtime. Add explicit permissions only when a route or
stored procedure requires them.
