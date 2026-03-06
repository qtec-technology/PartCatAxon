export const buildCreateAttachmentInsertSql = (attachmentTableName: string): string => `
    INSERT INTO ${attachmentTableName} (
        CatID, ParentID, Category, Attachement, Updatedby, UpdatedDate
    )
    OUTPUT INSERTED.AttachmentID
    VALUES (
        @CatID, @ParentID, @Category, @Attachement, @Updatedby, @UpdatedDate
    );
`;

export const buildDeleteAttachmentSql = (attachmentTableName: string): string => `
    DELETE FROM ${attachmentTableName}
    WHERE AttachmentID = @AttachmentID
      AND CatID = @CatID
      AND ParentID = @ParentID
`;

export const buildDeleteAttachmentViaSpSql = (
    attachmentTableName: string,
    deleteAttachmentSpName: string
): string => `
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
        THROW 50011, 'Attachment not found for the specified owner', 1;
    END

    DECLARE @returnRowAffected INT = 0;

    EXEC ${deleteAttachmentSpName}
        @AttachmentID = @AttachmentID,
        @returnRowAffected = @returnRowAffected OUTPUT;

    IF ISNULL(@returnRowAffected, 0) <= 0
    BEGIN
        THROW 50012, 'SPIT_DeleteAttachFile reported no affected rows', 1;
    END

    COMMIT TRANSACTION;

    SELECT @returnRowAffected AS RowsAffected;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
    END
    THROW;
END CATCH;
`;
