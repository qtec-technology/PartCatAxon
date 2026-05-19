# Executive Alignment

Last updated: 2026-05-19

This note captures the current executive direction from the meeting transcripts in
`.meetingdata/`. It is the guardrail for the architecture reset before the next
feature phase.

## Core Direction

PartCatalogAxon is not an AXON replacement. AXON is owned by Pi-Jo's side and
owns the RFQ chain. PartCatalogAxon is Kim's costing, calculation, snapshot, and
Item/Term bridge that consumes AXON's final comparison result.

```text
AXON = RFQ chain owner
PartCatalogAxon = costing / calculation / snapshot / Item-Term bridge
ChainId = shared correlation key across both systems
```

## Meeting Decisions To Preserve

- AXON and PartCatalogAxon must run together on the same server environment
  without port conflicts.
- Nginx, subdomains, and internal CA certificates are the deploy direction.
- GitHub PRs, regression tests, and smoke tests are mandatory for traceability.
- Database users must follow least privilege. Do not connect with an admin user
  for normal app operations.
- AXON final comparison is the entry point into PartCatalogAxon. Sales should not
  be forced to restart context in an unrelated Bulk Cost screen.
- Integration is shared DB/view/module oriented, not a separate public REST API
  between AXON and PartCatalogAxon.
- `ChainId` is the shared correlation id, but it is not enough as a primary key
  for cost snapshots because supplier quotes can change by revision.
- Bulk Cost calculation belongs to PartCatalogAxon because it depends on QTEC
  Term formulas, Item/Term fields, SAP mapping, and audit.
- AI suggestions remain review-first. Users must be able to verify and edit all
  suggested fields before save or award.
- Before Awarded reverse mapping is designed, do not write Bulk Cost output to
  `@POITM` or `@PITM1`.

## Immediate Reset Priorities

1. Stabilize deploy/runtime so PartCatalogAxon can coexist with AXON.
2. Port proven production fixes from `repos2`, starting with SQL Server local
   `GETDATE()` for Item/Term `UpdatedDate`.
3. Clean old architecture references such as retired `client/` assumptions.
4. Lock the AXON handoff contract around `ChainId`, revision, supplier quote,
   and line identity.
5. Make module boundaries explicit before moving or rewriting large code paths.
6. Move Bulk Cost toward a backend/shared calculation source of truth before any
   Award/SAP automation.

## Non-Goals For This Reset

- Do not rebuild AXON inside PartCatalogAxon.
- Do not migrate all server logic to Next.js Server Actions in one pass.
- Do not replace raw `mssql` and stored procedures with Prisma in this reset.
- Do not introduce a PartCatalog-owned Python AI orchestrator.
- Do not implement Awarded reverse mapping until insert/update rules are
  approved.
