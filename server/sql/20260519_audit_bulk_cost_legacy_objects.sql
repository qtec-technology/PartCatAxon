/*
  Read-only audit for Bulk Cost / AXON legacy SQL objects.

  Run this in SSMS against the exact database where the old scripts were run.
  This script does not modify data. Use the result to decide whether legacy
  tables are empty, demo-only, or already contain real business data.
*/

SET NOCOUNT ON;

SELECT
    DB_NAME() AS CurrentDatabase,
    SUSER_SNAME() AS CurrentLogin,
    SYSDATETIME() AS AuditedAt;

SELECT
    t.name AS TableName,
    t.create_date AS CreatedAt,
    t.modify_date AS ModifiedAt,
    SUM(p.rows) AS ApproxRows
FROM sys.tables AS t
JOIN sys.partitions AS p
    ON p.object_id = t.object_id
   AND p.index_id IN (0, 1)
WHERE t.name IN (
    N'BulkCostRun',
    N'DraftItem',
    N'DraftTerm',
    N'AxonExtractionQueue',
    N'AIRecommendCache',
    N'GraingerWeightData',
    N'GraingerWeightImportLog'
)
GROUP BY t.name, t.create_date, t.modify_date
ORDER BY t.name;

IF OBJECT_ID(N'[dbo].[BulkCostRun]', N'U') IS NOT NULL
BEGIN
    SELECT TOP (50)
        N'BulkCostRun' AS SourceTable,
        [RunID],
        [Status],
        [VendorCode],
        [VendorName],
        [ReferenceNo],
        [CreatedBy],
        [CreatedAt],
        [UpdatedBy],
        [UpdatedAt]
    FROM [dbo].[BulkCostRun]
    ORDER BY [UpdatedAt] DESC, [RunID] DESC;
END;

IF OBJECT_ID(N'[dbo].[AxonExtractionQueue]', N'U') IS NOT NULL
BEGIN
    SELECT TOP (50)
        N'AxonExtractionQueue' AS SourceTable,
        [QueueID],
        [SourceFileId],
        [SourceFileName],
        [DocumentNo],
        [SupplierRawName],
        [SupplierCodeHint],
        [Status],
        [ReceivedAt],
        [OpenedAt],
        [OpenedBy],
        [RunID]
    FROM [dbo].[AxonExtractionQueue]
    ORDER BY [ReceivedAt] DESC, [QueueID] DESC;
END;

IF OBJECT_ID(N'[dbo].[DraftItem]', N'U') IS NOT NULL
BEGIN
    SELECT TOP (50)
        N'DraftItem' AS SourceTable,
        [DraftItemID],
        [RunID],
        [LineKey],
        [LineNo],
        [DraftStatus],
        [MatchType],
        [ItemIDHint],
        [AwardedItemID],
        [Updatedby],
        [UpdatedDate]
    FROM [dbo].[DraftItem]
    ORDER BY [UpdatedDate] DESC, [DraftItemID] DESC;
END;

IF OBJECT_ID(N'[dbo].[DraftTerm]', N'U') IS NOT NULL
BEGIN
    SELECT TOP (50)
        N'DraftTerm' AS SourceTable,
        [DraftTermID],
        [DraftItemID],
        [RunID],
        [LineKey],
        [DraftStatus],
        [TermIDHint],
        [VendorCode],
        [Updatedby],
        [UpdatedDate]
    FROM [dbo].[DraftTerm]
    ORDER BY [UpdatedDate] DESC, [DraftTermID] DESC;
END;

IF OBJECT_ID(N'[dbo].[GraingerWeightData]', N'U') IS NOT NULL
BEGIN
    SELECT TOP (50)
        N'GraingerWeightData' AS SourceTable,
        [WeightDataID],
        [GraingerOrderCode],
        [ManufacturerPartNo],
        [ManufacturerName],
        [SourceFile],
        [ImportedAt],
        [ImportedBy],
        [IsActive]
    FROM [dbo].[GraingerWeightData]
    ORDER BY [ImportedAt] DESC, [WeightDataID] DESC;
END;
