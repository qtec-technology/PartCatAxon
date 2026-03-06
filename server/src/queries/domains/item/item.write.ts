import { toSqlIdentifier } from '#src/utils/sql.js';

/** Whitelist of columns allowed in UPDATE SET clause. */
const ALLOWED_UPDATE_COLUMNS = new Set([
    'ItemGroup', 'U_Brand', 'U_Calalogno', 'ItemDescription', 'InvntryUom', 'U_CountryOrg',
    'BPStockItemNo', 'SAPB1Desc', 'VatGroupPu', 'VatGourpSa',
    'U_ECCN', 'U_UNSPSC', 'U_EpoCode', 'U_HScode', 'U_Remark', 'LeadTime', 'SaleSubLocation',
    'ItemCategory', 'SpecialRequirement', 'GeneralSpec', 'GeneralSpecUrl',
    'LongDesc1', 'LongDesc2', 'LongDesc3', 'LongDesc4',
    'U_Punchout', 'U_VMI', 'U_CustBPA', 'U_IsQTECSTock', 'U_B1Item', 'U_Serialreq',
    'U_MSDS', 'U_Certificate', 'U_Ecommerce', 'U_DG_Required', 'U_Permitreq', 'U_PermitType',
    'Active', 'MasterFG', 'Updatedby', 'UpdatedDate',
]);

export const buildCreateItemInsertSql = (writeTableName: string): string => `
    INSERT INTO ${writeTableName} (
        ItemGroup, U_Brand, U_Calalogno, ItemDescription, InvntryUom, U_CountryOrg,
        BPStockItemNo, SAPB1Desc, VatGroupPu, VatGourpSa,
        U_ECCN, U_UNSPSC, U_EpoCode, U_HScode, U_Remark, LeadTime, SaleSubLocation,
        ItemCategory, SpecialRequirement, GeneralSpec, GeneralSpecUrl,
        LongDesc1, LongDesc2, LongDesc3, LongDesc4,
        U_Punchout, U_VMI, U_CustBPA, U_IsQTECSTock, U_B1Item, U_Serialreq,
        U_MSDS, U_Certificate, U_Ecommerce, U_DG_Required, U_Permitreq, U_PermitType,
        Active, MasterFG, Updatedby, UpdatedDate
    )
    OUTPUT INSERTED.ItemID
    VALUES (
        @ItemGroup, @U_Brand, @U_Calalogno, @ItemDescription, @InvntryUom, @U_CountryOrg,
        @BPStockItemNo, @SAPB1Desc, @VatGroupPu, @VatGourpSa,
        @U_ECCN, @U_UNSPSC, @U_EpoCode, @U_HScode, @U_Remark, @LeadTime, @SaleSubLocation,
        @ItemCategory, @SpecialRequirement, @GeneralSpec, @GeneralSpecUrl,
        @LongDesc1, @LongDesc2, @LongDesc3, @LongDesc4,
        @U_Punchout, @U_VMI, @U_CustBPA, @U_IsQTECSTock, @U_B1Item, @U_Serialreq,
        @U_MSDS, @U_Certificate, @U_Ecommerce, @U_DG_Required, @U_Permitreq, @U_PermitType,
        @Active, @MasterFG, @Updatedby, @UpdatedDate
    );
`;

export const buildUpdateItemSql = (writeTableName: string, columns: string[]): string => {
    if (columns.length === 0) {
        throw new Error('buildUpdateItemSql requires at least one column');
    }

    // Validate every column against the whitelist
    for (const col of columns) {
        if (!ALLOWED_UPDATE_COLUMNS.has(col)) {
            throw new Error(`Disallowed column in UPDATE: ${col}`);
        }
    }

    const setClause = columns
        .map((column) => `${toSqlIdentifier(column)} = @${column}`)
        .join(',\n        ');

    return `
    UPDATE ${writeTableName}
    SET
        ${setClause}
    WHERE ItemID = @ItemID;

    SELECT @@ROWCOUNT AS RowsAffected;
`;
};


export const buildDeleteItemSql = (
    itemTableName: string,
    termTableName: string,
    attachmentTableName: string
): string => `
SET XACT_ABORT ON;

BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @itemRows INT = 0;
    DECLARE @attachmentRows INT = 0;

    IF NOT EXISTS (
        SELECT 1
        FROM ${itemTableName} WITH (UPDLOCK, HOLDLOCK)
        WHERE ItemID = @ItemID
    )
    BEGIN
        THROW 50001, 'Item not found', 1;
    END

    IF EXISTS (
        SELECT 1
        FROM ${termTableName} WITH (UPDLOCK, HOLDLOCK)
        WHERE ItemID = @ItemID
    )
    BEGIN
        THROW 50002, 'Cannot delete item that has existing terms. Delete terms first.', 1;
    END

    DELETE FROM ${attachmentTableName}
    WHERE CatID = 'I'
      AND ParentID = @ItemID;
    SET @attachmentRows = @@ROWCOUNT;

    DELETE FROM ${itemTableName}
    WHERE ItemID = @ItemID;
    SET @itemRows = @@ROWCOUNT;

    IF (@itemRows <> 1)
    BEGIN
        THROW 50003, 'Delete item failed due to unexpected row count.', 1;
    END

    COMMIT TRANSACTION;

    SELECT
        @itemRows AS ItemRowsAffected,
        @attachmentRows AS AttachmentRowsAffected;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
    END
    THROW;
END CATCH;
`;
