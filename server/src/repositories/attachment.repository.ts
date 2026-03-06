import { execSP, queryOne, sql } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import {
    buildDeleteAttachmentViaSpSql,
} from '#src/queries/domains/attachment/attachment.write.js';
import { SP_CREATE_ATTACH_FILE } from '#src/queries/domains/attachment/attachment.sp.js';

// ใช้สำหรับคืนชื่อตารางไฟล์แนบในฐาน SAP
function resolveAttachmentTableName(): string {
    return dbObjects.tables.sap.attachment;
}

// ใช้สำหรับประกอบชื่อ Stored Procedure ลบไฟล์แนบแบบ fully-qualified
function resolveDeleteAttachmentSpName(): string {
    return dbObjects.qualifiedProcedures.deleteAttachFile;
}

// ใช้สำหรับแปลง relatedType ให้เป็น CatID (I/T) ที่ใช้ในตาราง
function toCatId(relatedType: string): 'I' | 'T' {
    const normalized = String(relatedType || '').trim().toUpperCase();
    if (normalized === 'ITEM') return 'I';
    if (normalized === 'TERM') return 'T';
    throw new Error('relatedType must be ITEM or TERM');
}

/**
 * Create an attachment record.
 * Calls the configured create-attachment stored procedure.
 */
// ใช้สำหรับสร้างข้อมูลไฟล์แนบผ่าน SPIT_CreateAttachFile
export async function createAttachment(
    relatedId: number,
    relatedType: string,  // 'ITEM' or 'TERM'
    fileName: string,
    filePath: string,
    fileType: string,
    createdBy: string
): Promise<number> {
    const catId = toCatId(relatedType);
    const attachmentValue = String(fileName || '').trim() || String(filePath || '').trim();
    const categoryValue = String(fileType || '').trim();
    const updatedByValue = String(createdBy || '').trim() || 'System';

    if (!attachmentValue) {
        throw new Error('fileName or filePath is required');
    }

    const result = await execSP(
        SP_CREATE_ATTACH_FILE,
        {
            ParentID: { type: sql.Int, value: relatedId },
            CatID: { type: sql.VarChar(1), value: catId },
            Category: { type: sql.VarChar(20), value: categoryValue },
            Attachment: { type: sql.VarChar(100), value: attachmentValue },
            UpdatedBy: { type: sql.VarChar(50), value: updatedByValue },
        },
        {
            returnAttachmentID: { type: sql.Int },
        }
    );

    const attachmentId = Number(result.output?.returnAttachmentID || 0);
    if (!Number.isFinite(attachmentId) || attachmentId <= 0) {
        throw new Error('SPIT_CreateAttachFile failed to create attachment');
    }

    return attachmentId;
}

/**
 * Delete an attachment record.
 * Deletes from the configured attachment table with owner validation.
 */
// ใช้สำหรับลบไฟล์แนบตามเจ้าของ (owner) โดยตรวจ CatID และ ParentID
export async function deleteAttachment(
    attachmentId: number,
    relatedType: string,
    relatedId: number
): Promise<void> {
    const attachmentTableName = resolveAttachmentTableName();
    const deleteAttachmentSpName = resolveDeleteAttachmentSpName();
    const catId = toCatId(relatedType);

    const row = await queryOne<{ RowsAffected: number }>(
        buildDeleteAttachmentViaSpSql(attachmentTableName, deleteAttachmentSpName),
        {
            AttachmentID: attachmentId,
            CatID: catId,
            ParentID: relatedId,
        }
    );

    const rowsAffected = Number(row?.RowsAffected ?? 0);
    if (!Number.isFinite(rowsAffected) || rowsAffected <= 0) {
        throw new Error('Attachment not found for the specified owner');
    }
}
