-- Manual Bulk Cost revision metadata
-- Adds explicit BulkCostRun revision fields only.
-- Line snapshots remain in DraftItem/DraftTerm for the live Phase 3A schema.
-- This script does not write @POITM/@PITM1 and does not create legacy line
-- table storage.

IF COL_LENGTH(N'[dbo].[BulkCostRun]', N'RevisionGroupID') IS NULL
BEGIN
    ALTER TABLE [dbo].[BulkCostRun]
        ADD [RevisionGroupID] bigint NULL;
END;

IF COL_LENGTH(N'[dbo].[BulkCostRun]', N'RevisionNo') IS NULL
BEGIN
    ALTER TABLE [dbo].[BulkCostRun]
        ADD [RevisionNo] int NOT NULL
            CONSTRAINT [DF_BulkCostRun_RevisionNo] DEFAULT ((1));
END;

IF COL_LENGTH(N'[dbo].[BulkCostRun]', N'RevisionSourceRunID') IS NULL
BEGIN
    ALTER TABLE [dbo].[BulkCostRun]
        ADD [RevisionSourceRunID] bigint NULL;
END;

-- Backfill RevisionGroupID using dynamic SQL to avoid parse-time column validation error
EXEC sp_executesql N'
    UPDATE [dbo].[BulkCostRun]
    SET [RevisionGroupID] = [RunID]
    WHERE [RevisionGroupID] IS NULL
';

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_BulkCostRun_RevisionGroup'
      AND [object_id] = OBJECT_ID(N'[dbo].[BulkCostRun]', N'U')
)
BEGIN
    CREATE INDEX [IX_BulkCostRun_RevisionGroup]
        ON [dbo].[BulkCostRun] ([RevisionGroupID], [RevisionNo] DESC, [RunID] DESC);
END;
