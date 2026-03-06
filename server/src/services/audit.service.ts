import { execute } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import { logger } from '#src/utils/logger.js';

// ─── Audit Action Constants ─────────────────────────────────────────────────
export const AuditAction = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntity = {
    ITEM: 'ITEM',
    TERM: 'TERM',
    ATTACHMENT: 'ATTACHMENT',
} as const;

export type AuditEntityType = (typeof AuditEntity)[keyof typeof AuditEntity];

// ─── Audit Table Name ───────────────────────────────────────────────────────
function resolveAuditTableName(): string {
    return dbObjects.tables.qtec.auditLog;
}

// ─── Audit Log Entry ────────────────────────────────────────────────────────
export interface AuditLogEntry {
    action: AuditActionType;
    entity: AuditEntityType;
    entityId: number;
    username: string;
    detail?: string;
}

/**
 * Write an audit log entry to the database.
 *
 * This is fire-and-forget (non-blocking) — a failed audit write should
 * NOT cause the original request to fail. Errors are logged to console only.
 *
 * Table: [@AUDITLOG]
 * Columns: Action, Entity, EntityID, Username, Detail, CreatedAt
 *
 * ⚠️ The table must be created on the database first:
 * ```sql
 * CREATE TABLE [@AUDITLOG] (
 *     AuditID INT IDENTITY(1,1) PRIMARY KEY,
 *     Action VARCHAR(10) NOT NULL,
 *     Entity VARCHAR(20) NOT NULL,
 *     EntityID INT NOT NULL,
 *     Username VARCHAR(50) NOT NULL,
 *     Detail NVARCHAR(500) NULL,
 *     CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
 * );
 * CREATE INDEX IX_AUDITLOG_Entity ON [@AUDITLOG](Entity, EntityID);
 * CREATE INDEX IX_AUDITLOG_Date ON [@AUDITLOG](CreatedAt DESC);
 * ```
 */
export function writeAuditLog(entry: AuditLogEntry): void {
    const tableName = resolveAuditTableName();
    const detail = entry.detail
        ? String(entry.detail).substring(0, 500)
        : null;

    // Fire-and-forget — don't await, just catch errors silently
    execute(
        `INSERT INTO ${tableName} (Action, Entity, EntityID, Username, Detail, CreatedAt)
         VALUES (@action, @entity, @entityId, @username, @detail, GETDATE())`,
        {
            action: entry.action,
            entity: entry.entity,
            entityId: entry.entityId,
            username: String(entry.username || 'System').substring(0, 50),
            detail,
        }
    ).catch((err) => {
        // Log but never propagate — audit failure must not break the app
        logger.error('Failed to write audit entry', {
            component: 'AuditLog',
            error: err instanceof Error ? err.message : String(err),
        });
    });
}
