-- ─────────────────────────────────────────────────────────────────────────────
-- GraingerWeightData — Exported Grainger Product Weight / Dimension Data
-- Target database: PART_CATALOG_AIX
-- OBSOLETE for active CWeight lookup as of 2026-05-14.
-- Active source: [GRAINGER].[dbo].[@GRAINGER_CWEIGHT].
-- Do not deploy this staging table unless a separate cache/staging decision is approved.
-- Purpose: Source table for CWeight (C1) lookup suggestions
--   • Import ข้อมูลจาก Grainger export file (CSV/Excel) เป็น batch
--   • ระบบจะ match supplierOrderCode / mfgPartNumber กับ GraingerOrderCode
--     เพื่อแนะนำ itemWeightPerEach + dimensionWeightPerEach ให้ผู้ใช้
--   • ข้อมูลที่ match สำเร็จจะถูก cache ไว้ใน AIRecommendCache (FeatureType = WEIGHT)
-- Run after: 20260512_axon_ai_tables.sql
-- ─────────────────────────────────────────────────────────────────────────────

IF OBJECT_ID(N'[dbo].[GraingerWeightData]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[GraingerWeightData] (
        -- PK
        [WeightDataID]          bigint          IDENTITY(1, 1) NOT NULL,

        -- ─── Part Identity (lookup keys) ─────────────────────────────────────
        -- GraingerOrderCode คือ Supplier Order Code (E6 ใน BulkCost sheet)
        [GraingerOrderCode]     nvarchar(50)    NOT NULL,   -- เช่น "4YR55", "3E178"
        [ManufacturerPartNo]    nvarchar(100)   NULL,       -- MFG P/N จาก Grainger export
        [ManufacturerName]      nvarchar(150)   NULL,       -- เช่น "Parker", "SMC", "3M"

        -- ─── Product Description ─────────────────────────────────────────────
        [Description]           nvarchar(500)   NULL,       -- Product title จาก Grainger

        -- ─── Weight (กิโลกรัม) ───────────────────────────────────────────────
        -- ค่าน้ำหนักจริงต่อหน่วย (per each) ตาม UOM ใน [SalesUOM]
        [ItemWeightKg]          decimal(12, 6)  NULL,       -- Actual weight per each (kg)

        -- ─── Dimensions (เซนติเมตร) ──────────────────────────────────────────
        -- ขนาดบรรจุภัณฑ์ต่อหน่วย สำหรับคำนวณ Dimensional Weight
        [LengthCm]              decimal(10, 4)  NULL,
        [WidthCm]               decimal(10, 4)  NULL,
        [HeightCm]              decimal(10, 4)  NULL,

        -- Dimensional weight (L×W×H / 5000) คำนวณล่วงหน้า (cm³ / 5000 = kg)
        -- ถ้า NULL = คำนวณใน app ตอน runtime
        [DimWeightKg]           decimal(12, 6)  NULL,

        -- ─── Unit of Measure ─────────────────────────────────────────────────
        -- ตรงกับ UOM ที่ Grainger ขาย (ซื้อทีละ EA, BX, PK ฯลฯ)
        [SalesUOM]              nvarchar(20)    NULL        CONSTRAINT [DF_GW_SalesUOM] DEFAULT (N'EA'),

        -- ─── Data Quality ────────────────────────────────────────────────────
        -- ระดับความเชื่อมั่น:
        --   verified  = ตรวจสอบจากเอกสาร spec จริง
        --   extracted = ดึงจาก Grainger export ตรงๆ ยังไม่ verify
        --   estimated = AI ประเมิน (ยังไม่มีข้อมูล)
        [DataQuality]           nvarchar(20)    NOT NULL    CONSTRAINT [DF_GW_DataQuality] DEFAULT (N'extracted'),

        -- ─── Source Tracking ─────────────────────────────────────────────────
        [SourceFile]            nvarchar(300)   NULL,       -- ชื่อไฟล์ที่ import เช่น "grainger_export_20260512.csv"
        [ImportedAt]            datetime2(3)    NOT NULL    CONSTRAINT [DF_GW_ImportedAt] DEFAULT (SYSDATETIME()),
        [ImportedBy]            nvarchar(50)    NULL,       -- username ที่ import

        -- ─── Soft delete / versioning ────────────────────────────────────────
        -- เมื่อ import ไฟล์ใหม่ให้ set IsActive = 0 ของ batch เก่าก่อน insert ใหม่
        [IsActive]              bit             NOT NULL    CONSTRAINT [DF_GW_IsActive] DEFAULT (1),

        CONSTRAINT [PK_GraingerWeightData] PRIMARY KEY CLUSTERED ([WeightDataID] ASC),

        CONSTRAINT [CK_GW_DataQuality]
            CHECK ([DataQuality] IN (N'verified', N'extracted', N'estimated')),

        CONSTRAINT [CK_GW_Weights]
            CHECK (
                ([ItemWeightKg] IS NULL OR [ItemWeightKg] >= 0) AND
                ([DimWeightKg]  IS NULL OR [DimWeightKg]  >= 0)
            ),

        CONSTRAINT [CK_GW_Dimensions]
            CHECK (
                ([LengthCm] IS NULL OR [LengthCm] > 0) AND
                ([WidthCm]  IS NULL OR [WidthCm]  > 0) AND
                ([HeightCm] IS NULL OR [HeightCm] > 0)
            )
    );

    -- หลัก: lookup by Grainger Order Code (ใช้บ่อยที่สุด — ตรงกับ SupplierOrderCode / GG CODE)
    CREATE UNIQUE INDEX [UQ_GW_OrderCode_Active]
        ON [dbo].[GraingerWeightData] ([GraingerOrderCode])
        WHERE [IsActive] = 1;

    -- Secondary: lookup by MFG Part No + Manufacturer (ใช้เมื่อไม่มี GG CODE)
    CREATE INDEX [IX_GW_MfgPartNo_Mfg]
        ON [dbo].[GraingerWeightData] ([ManufacturerPartNo], [ManufacturerName])
        WHERE [ManufacturerPartNo] IS NOT NULL AND [IsActive] = 1;

    -- Source tracking: ดูว่า import จากไฟล์ไหน batch ไหน
    CREATE INDEX [IX_GW_SourceFile_ImportedAt]
        ON [dbo].[GraingerWeightData] ([SourceFile], [ImportedAt]);

END;


-- ─────────────────────────────────────────────────────────────────────────────
-- GraingerWeightImportLog
-- บันทึกประวัติการ import แต่ละครั้ง สำหรับ audit และ rollback
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'[dbo].[GraingerWeightImportLog]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[GraingerWeightImportLog] (
        [ImportLogID]   bigint          IDENTITY(1, 1) NOT NULL,
        [SourceFile]    nvarchar(300)   NOT NULL,
        [RowsInserted]  int             NOT NULL    CONSTRAINT [DF_GWLog_RowsInserted] DEFAULT (0),
        [RowsDeactivated] int           NOT NULL    CONSTRAINT [DF_GWLog_RowsDeactivated] DEFAULT (0),
        [ImportedAt]    datetime2(3)    NOT NULL    CONSTRAINT [DF_GWLog_ImportedAt] DEFAULT (SYSDATETIME()),
        [ImportedBy]    nvarchar(50)    NULL,
        [Remark]        nvarchar(500)   NULL,       -- เช่น "Full replace", "Partial append"
        [Status]        nvarchar(20)    NOT NULL    CONSTRAINT [DF_GWLog_Status] DEFAULT (N'COMPLETED'),

        CONSTRAINT [PK_GraingerWeightImportLog] PRIMARY KEY CLUSTERED ([ImportLogID] ASC),
        CONSTRAINT [CK_GWLog_Status] CHECK ([Status] IN (N'COMPLETED', N'FAILED', N'PARTIAL'))
    );
END;


-- ─────────────────────────────────────────────────────────────────────────────
-- Sample seed rows — ใช้ทดสอบ CWeight lookup (Grainger export สมมติ)
-- ลบออกได้หลัง import ข้อมูลจริง
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM [dbo].[GraingerWeightData] WHERE [GraingerOrderCode] = N'5YR11')
BEGIN
    INSERT INTO [dbo].[GraingerWeightData]
        ([GraingerOrderCode], [ManufacturerPartNo], [ManufacturerName], [Description],
         [ItemWeightKg], [LengthCm], [WidthCm], [HeightCm], [DimWeightKg],
         [SalesUOM], [DataQuality], [SourceFile], [ImportedBy])
    VALUES
    -- Pneumatic / SMC
    (N'5YR11',  N'AW20-02G',         N'SMC',          N'Filter Regulator, 1/4 In, 5 to 150 psi',      0.450, 12.0, 8.0,  9.0,  0.173, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),
    (N'3E178',  N'AR20-02G',         N'SMC',          N'Regulator, 1/4 In NPT, 7 to 125 psi',         0.320, 10.0, 7.0,  8.0,  0.112, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),
    (N'6YA23',  N'VQZ115-5G1',       N'SMC',          N'Solenoid Valve, 5 Port 2 Pos, 1/8 In',        0.190, 9.0,  5.0,  5.5,  0.050, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),

    -- Parker / Hydraulic
    (N'4YR55',  N'926-10-8',         N'Parker',       N'Hydraulic Adapter, 5/8 In-18 to 1/2 In-14',   0.085, 5.0,  5.0,  3.5,  0.018, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),
    (N'2ZU35',  N'ANN-10S-S',        N'Parker',       N'Hydraulic Tube Fitting, Stainless Steel',      0.120, 7.0,  4.0,  4.0,  0.022, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),

    -- RS Components crossover
    (N'3LN12',  N'LM2596S-ADJ',      N'Texas Instruments', N'Step-Down Voltage Regulator, TO-263-5',   0.004, 3.0,  2.0,  1.0,  0.001, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),
    (N'4CW88',  N'RS-25-24',         N'Mean Well',    N'AC/DC Power Supply, 25W, 24VDC Output',        0.540, 14.0, 7.8,  4.0,  0.087, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),

    -- Grainger-branded / MRO
    (N'1TDH5',  N'1TDH5',            N'Dayton',       N'AC Motor, 1/3 HP, 1725 RPM, 115/230V',        5.900, 20.0, 15.0, 17.0, 1.020, N'EA', N'extracted', N'grainger_sample_seed.csv', N'system'),
    (N'2VAE3',  N'2VAE3',            N'Tough Guy',    N'Ratchet Tie Down Strap, 2 In x 27 ft, 3333 lb',0.650, 28.0, 10.0, 6.0,  0.336, N'PK', N'extracted', N'grainger_sample_seed.csv', N'system'),

    -- Fasteners / Small parts
    (N'3CVG8',  N'B18.6.3-#8-32x1', N'Brighton-Best',N'Machine Screw, Pan Head, #8-32 x 1 In, SS',    0.005, 4.0,  2.5,  1.5,  0.003, N'BX', N'extracted', N'grainger_sample_seed.csv', N'system'),
    (N'1XTL8',  N'M5x0.8x20-A2',    N'Earnest',      N'Hex Cap Screw, M5-0.8 x 20mm, SS A2',          0.006, 4.0,  2.0,  1.5,  0.002, N'BX', N'extracted', N'grainger_sample_seed.csv', N'system');
END;
