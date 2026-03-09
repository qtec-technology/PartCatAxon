import { queryOne } from '#src/config/database.js';
import { dbObjects } from '#src/config/db-objects.js';
import type { AttachmentRecord } from '#src/types/lookup.types.js';

function resolveAttachmentTableName(): string {
    return dbObjects.tables.sap.attachment;
}

function resolveCreateAttachmentSpName(): string {
    return dbObjects.qualifiedProcedures.createAttachFile;
}

function resolveDeleteAttachmentSpName(): string {
    return dbObjects.qualifiedProcedures.deleteAttachFile;
}

function toCatId(relatedType: string): 'I' | 'T' {
    const normalized = String(relatedType || '').trim().toUpperCase();
    if (normalized === 'ITEM') return 'I';
    if (normalized === 'TERM') return 'T';
    throw new Error('relatedType must be ITEM or TERM');
}

function resolveParentTarget(relatedType: string): {
    tableName: string;
    idColumn: 'ItemID' | 'TermID';
} {
    const normalized = String(relatedType || '').trim().toUpperCase();
    if (normalized === 'ITEM') {
        return {
            tableName: dbObjects.tables.sap.poitm,
            idColumn: 'ItemID',
        };
    }

    if (normalized === 'TERM') {
        return {
            tableName: dbObjects.tables.sap.pitm1,
            idColumn: 'TermID',
        };
    }

    throw new Error('relatedType must be ITEM or TERM');
}

function buildFindAttachmentSql(attachmentTableName: string): string {
    return `
        SELECT TOP 1
            AttachmentID,
            CatID COLLATE DATABASE_DEFAULT AS CatID,
            ParentID,
            Category COLLATE DATABASE_DEFAULT AS Category,
            Attachement COLLATE DATABASE_DEFAULT AS Attachement,
            Updatedby COLLATE DATABASE_DEFAULT AS Updatedby,
            UpdatedDate
        FROM ${attachmentTableName}
        WHERE AttachmentID = @AttachmentID
          AND CatID = @CatID
          AND ParentID = @ParentID
    `;
}

function buildCreateAttachmentViaSpAndTouchSql(
    createAttachmentSpName: string,
    parentTableName: string,
    parentIdColumn: 'ItemID' | 'TermID'
): string {
    return `
SET XACT_ABORT ON;

BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @returnAttachmentID INT = 0;

    EXEC ${createAttachmentSpName}
        @ParentID = @ParentID,
        @CatID = @CatID,
        @Category = @Category,
        @Attachment = @Attachment,
        @UpdatedBy = @UpdatedBy,
        @returnAttachmentID = @returnAttachmentID OUTPUT;

    IF ISNULL(@returnAttachmentID, 0) <= 0
    BEGIN
        RAISERROR ('SPIT_CreateAttachFile failed to create attachment', 16, 1);
        RETURN;
    END

    UPDATE ${parentTableName}
    SET Updatedby = @UpdatedBy,
        UpdatedDate = GETDATE()
    WHERE ${parentIdColumn} = @ParentID;

    IF @@ROWCOUNT <> 1
    BEGIN
        RAISERROR ('Parent record not found for attachment owner', 16, 1);
        RETURN;
    END

    COMMIT TRANSACTION;

    SELECT @returnAttachmentID AS AttachmentID;
END TRY
BEGIN CATCH
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
    END
    RAISERROR (@ErrorMessage, 16, 1);
END CATCH;
`;
}

function buildDeleteAttachmentViaSpAndTouchParentSql(
    attachmentTableName: string,
    deleteAttachmentSpName: string,
    parentTableName: string,
    parentIdColumn: 'ItemID' | 'TermID'
): string {
    return `
SET XACT_ABORT ON;

BEGIN TRANSACTION;
BEGIN TRY
    IF NOT EXISTS (
        SELECT 1
        FROM ${attachmentTableName} WITH (UPDLOCK, HOLDLOCK)
        WHERE AttachmentID = @AttachmentID
          AND CatID = @CatID
          AND ParentID = @ParentID
    )
    BEGIN
        RAISERROR ('Attachment not found for the specified owner', 16, 1);
        RETURN;
    END

    DECLARE @returnRowAffected INT = 0;

    EXEC ${deleteAttachmentSpName}
        @AttachmentID = @AttachmentID,
        @returnRowAffected = @returnRowAffected OUTPUT;

    IF ISNULL(@returnRowAffected, 0) <= 0
    BEGIN
        RAISERROR ('SPIT_DeleteAttachFile reported no affected rows', 16, 1);
        RETURN;
    END

    UPDATE ${parentTableName}
    SET Updatedby = @UpdatedBy,
        UpdatedDate = GETDATE()
    WHERE ${parentIdColumn} = @ParentID;

    IF @@ROWCOUNT <> 1
    BEGIN
        RAISERROR ('Parent record not found for attachment owner', 16, 1);
        RETURN;
    END

    COMMIT TRANSACTION;

    SELECT @returnRowAffected AS RowsAffected;
END TRY
BEGIN CATCH
    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
    END
    RAISERROR (@ErrorMessage, 16, 1);
END CATCH;
`;
}

export async function createAttachment(
    relatedId: number,
    relatedType: string,
    fileName: string,
    filePath: string,
    fileType: string,
    createdBy: string
): Promise<number> {
    const catId = toCatId(relatedType);
    const createAttachmentSpName = resolveCreateAttachmentSpName();
    const { tableName: parentTableName, idColumn: parentIdColumn } = resolveParentTarget(relatedType);
    const attachmentValue = String(fileName || '').trim() || String(filePath || '').trim();
    const categoryValue = String(fileType || '').trim();
    const updatedByValue = String(createdBy || '').trim() || 'System';

    if (!attachmentValue) {
        throw new Error('fileName or filePath is required');
    }

    const row = await queryOne<{ AttachmentID: number }>(
        buildCreateAttachmentViaSpAndTouchSql(createAttachmentSpName, parentTableName, parentIdColumn),
        {
            ParentID: relatedId,
            CatID: catId,
            Category: categoryValue,
            Attachment: attachmentValue,
            UpdatedBy: updatedByValue,
        }
    );

    const attachmentId = Number(row?.AttachmentID ?? 0);
    if (!Number.isFinite(attachmentId) || attachmentId <= 0) {
        throw new Error('SPIT_CreateAttachFile failed to create attachment');
    }

    return attachmentId;
}

export async function getAttachmentForOwner(
    attachmentId: number,
    relatedType: string,
    relatedId: number
): Promise<AttachmentRecord | null> {
    const attachmentTableName = resolveAttachmentTableName();
    const catId = toCatId(relatedType);

    return await queryOne<AttachmentRecord>(
        buildFindAttachmentSql(attachmentTableName),
        {
            AttachmentID: attachmentId,
            CatID: catId,
            ParentID: relatedId,
        }
    );
}

export async function deleteAttachment(
    attachmentId: number,
    relatedType: string,
    relatedId: number,
    updatedBy: string
): Promise<void> {
    const attachmentTableName = resolveAttachmentTableName();
    const deleteAttachmentSpName = resolveDeleteAttachmentSpName();
    const catId = toCatId(relatedType);
    const updatedByValue = String(updatedBy || '').trim() || 'System';
    const { tableName: parentTableName, idColumn: parentIdColumn } = resolveParentTarget(relatedType);

    const row = await queryOne<{ RowsAffected: number }>(
        buildDeleteAttachmentViaSpAndTouchParentSql(
            attachmentTableName,
            deleteAttachmentSpName,
            parentTableName,
            parentIdColumn
        ),
        {
            AttachmentID: attachmentId,
            CatID: catId,
            ParentID: relatedId,
            UpdatedBy: updatedByValue,
        }
    );

    const rowsAffected = Number(row?.RowsAffected ?? 0);
    if (!Number.isFinite(rowsAffected) || rowsAffected <= 0) {
        throw new Error('Attachment not found for the specified owner');
    }
}
