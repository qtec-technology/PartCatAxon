import { logger } from '#src/utils/logger.js';

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

export interface AuditLogEntry {
    action: AuditActionType;
    entity: AuditEntityType;
    entityId: number;
    username: string;
    detail?: string;
}

/**
 * Application-level audit event only.
 *
 * This project does not use a database audit table.
 * Actor identity is derived from Windows Authentication and
 * persisted in business records through Updatedby/UpdatedDate.
 */
export function writeAuditLog(entry: AuditLogEntry): void {
    logger.info('Audit event', {
        component: 'AuditLog',
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        username: String(entry.username || 'System').substring(0, 50),
        detail: entry.detail
            ? String(entry.detail).substring(0, 500)
            : null,
    });
}
