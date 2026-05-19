// ─── Term Write Queries ──────────────────────────────────────────────────────

// Ship Mode number → label mapping (matches legacy VBA)
const SHIP_MODE_MAP: Record<number, string> = {
    1: 'Air FWD',
    2: 'Sea',
    3: 'Truck',
    4: 'QTEC-MC',
    5: 'QTEC-Truck',
    6: 'Air COUR',
};

// Dim Unit number → label mapping
const DIM_UNIT_MAP: Record<number, string> = {
    1: 'CM',
    2: 'INCH',
};

export function shipModeLabel(modeNo: number): string {
    return SHIP_MODE_MAP[modeNo] ?? '';
}

export function dimUnitLabel(unitNo: number): string {
    return DIM_UNIT_MAP[unitNo] ?? '';
}

// ─── Column list shared by INSERT and UPDATE ─────────────────────────────────
const TERM_COLUMNS = [
    'VendorCode', 'VendorStockItemNo',
    'U_OrderTerm', 'U_TermLocation', 'SubLocation',
    'U_ProdCost', 'U_PurCurr', 'U_PurRate',
    'U_PKH', 'U_SOC',
    'U_OP', 'U_OP_SUM', 'U_OP_THB',
    'U_INS', 'INS_Percent',
    'U_FR', 'U_FRZONE', 'U_ZoneRate',
    'U_CIF', 'U_CIFZONE',
    'U_DT_Percent', 'U_DT', 'U_DT_FR', 'U_DT_FRZONE',
    'U_ETPer', 'U_ET', 'U_MT', 'U_MiscTax',
    'U_Length', 'U_Width', 'U_Height',
    'U_DimWeight', 'U_Weight', 'U_DimUnitNo', 'U_DimUnit',
    'U_FreightType', 'U_FreightRate', 'U_ShipWeightCal',
    'U_FreightQTEC', 'U_ShipModeNo', 'U_ShipMode',
    'U_WTT', 'U_CC', 'U_ASP',
    'U_STK_Percent', 'U_STK', 'U_preQLC',
    'U_SPK', 'U_QOC',
    'U_QLC', 'U_QLC2', 'U_QLC3',
    'U_MK_Percent', 'U_MK_THB', 'U_SalesPrice',
    'U_ValidFrom', 'U_ValidTo',
    'BuyUnitMsr', 'NumInBuy', 'SalUnitMsr', 'NumInSale',
    'U_MOQ', 'LeadTime', 'U_VendorBPA',
    'CntctCode', 'CntctName', 'SlpCode', 'SlpName', 'SlpSprtCode', 'SlpSprtName',
    'Updatedby', 'UpdatedDate',
    'U_SalesTerm', 'U_Remark', 'SaleSubLocation',
    'Active', 'ContractNo', 'U_CWeight',
] as const;

/**
 * Build INSERT SQL for a new Term row in [@PITM1].
 * Returns the new TermID via OUTPUT INSERTED.
 */
export function buildCreateTermSql(tableName: string): string {
    const cols = ['ItemID', ...TERM_COLUMNS];
    const params = cols.map((c) => c === 'UpdatedDate' ? 'GETDATE()' : `@${c}`).join(', ');
    return `
    INSERT INTO ${tableName} (${cols.join(', ')})
    OUTPUT INSERTED.TermID
    VALUES (${params});`;
}

/**
 * Build UPDATE SQL for an existing Term row.
 */
export function buildUpdateTermSql(tableName: string): string {
    const setClause = TERM_COLUMNS
        .map((c) => c === 'UpdatedDate' ? `${c} = GETDATE()` : `${c} = @${c}`)
        .join(',\n        ');
    return `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE TermID = @TermID;

    SELECT @@ROWCOUNT AS RowsAffected;`;
}

export const buildDeleteTermSql = (
    termTableName: string,
    attachmentTableName: string
): string => `
SET XACT_ABORT ON;

BEGIN TRANSACTION;
BEGIN TRY
    DECLARE @termRows INT = 0;
    DECLARE @attachmentRows INT = 0;

    IF NOT EXISTS (
        SELECT 1
        FROM ${termTableName} WITH (UPDLOCK, HOLDLOCK)
        WHERE TermID = @TermID
    )
    BEGIN
        RAISERROR ('Term not found', 16, 1);
        RETURN;
    END

    DELETE FROM ${attachmentTableName}
    WHERE CatID = 'T'
      AND ParentID = @TermID;
    SET @attachmentRows = @@ROWCOUNT;

    DELETE FROM ${termTableName}
    WHERE TermID = @TermID;
    SET @termRows = @@ROWCOUNT;

    IF (@termRows <> 1)
    BEGIN
        RAISERROR ('Delete term failed due to unexpected row count.', 16, 1);
        RETURN;
    END

    COMMIT TRANSACTION;

    SELECT
        @termRows AS TermRowsAffected,
        @attachmentRows AS AttachmentRowsAffected;
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
