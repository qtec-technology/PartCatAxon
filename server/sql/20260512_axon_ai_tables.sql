-- Bulk Cost Phase 3B: AXON Extraction Queue + AI Recommend Cache
-- Target database: PART_CATALOG_AIX
-- Run after: 20260508_bulk_cost_draft_snapshot.sql (BulkCostRun + BulkCostLine must exist)

-- ─────────────────────────────────────────────────────────────────────────────
-- AxonExtractionQueue
-- รับ raw payload จาก AXON Python orchestrator (Push model)
-- เซลล์เห็นตารางนี้ใน Dashboard และกดเลือกเพื่อเปิดใน Workspace (Pull)
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'[dbo].[AxonExtractionQueue]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AxonExtractionQueue] (
        -- PK
        [QueueID]            bigint          IDENTITY(1, 1) NOT NULL,

        -- ข้อมูลจาก AXON เกี่ยวกับไฟล์ต้นทาง
        [SourceFileId]       nvarchar(120)   NOT NULL,   -- AXON internal file ID (unique per email/PDF)
        [SourceFileName]     nvarchar(500)   NULL,       -- ชื่อไฟล์ เช่น "quote_grainger_20260510.pdf"
        [DocumentType]       nvarchar(50)    NULL,       -- quote / invoice / proforma / email / spreadsheet
        [DocumentNo]         nvarchar(100)   NULL,       -- เลข quote ในเอกสาร เช่น "Q-20260510-001"
        [DocumentDate]       date            NULL,       -- วันที่ในเอกสาร

        -- ข้อมูล Supplier ที่ AXON extract ได้
        [SupplierRawName]    nvarchar(255)   NOT NULL,   -- ชื่อ Supplier ดิบจากเอกสาร (ก่อน match)
        [SupplierCodeHint]   nvarchar(30)    NULL,       -- VendorCode ที่ AXON แนะนำว่าน่าจะเป็น
        [SupplierConfidence] decimal(9, 6)   NULL,       -- ความมั่นใจในการ match 0.0–1.0

        -- ข้อมูลรายการและค่าตั้งต้น
        [Currency]           nvarchar(10)    NULL,       -- สกุลเงินหลักในเอกสาร
        [PurchaseTerm]       nvarchar(40)    NULL,       -- Incoterm เช่น Ex-work, FOB
        [TermLocation]       nvarchar(80)    NULL,       -- ที่มาสินค้า เช่น USA, CN
        [TotalLines]         int             NOT NULL    CONSTRAINT [DF_AxonQueue_TotalLines] DEFAULT (0),

        -- สถานะ
        -- PENDING   = AXON ส่งมาแล้ว รอเซลล์เปิด
        -- OPENED    = เซลล์เปิดแล้ว กำลัง work
        -- PROCESSED = เซลล์ save draft แล้ว (มี RunID)
        -- REJECTED  = เซลล์ปฏิเสธ (ข้อมูลผิด / ไม่เกี่ยวข้อง)
        [Status]             nvarchar(20)    NOT NULL    CONSTRAINT [DF_AxonQueue_Status] DEFAULT (N'PENDING'),

        -- Raw payload ทั้งหมดจาก AXON (เก็บไว้ audit ตลอด)
        [RawPayloadJson]     nvarchar(max)   NOT NULL,

        -- Audit timestamps
        [ReceivedAt]         datetime2(3)    NOT NULL    CONSTRAINT [DF_AxonQueue_ReceivedAt] DEFAULT (SYSDATETIME()),
        [OpenedAt]           datetime2(3)    NULL,       -- เวลาที่เซลล์กดเปิด
        [OpenedBy]           nvarchar(50)    NULL,       -- username เซลล์ที่เปิด

        -- เชื่อมกับ BulkCostRun หลังจาก save draft
        [RunID]              bigint          NULL,       -- NULL จนกว่าเซลล์จะ save draft

        CONSTRAINT [PK_AxonExtractionQueue]     PRIMARY KEY CLUSTERED ([QueueID] ASC),
        CONSTRAINT [UQ_AxonQueue_SourceFileId]  UNIQUE ([SourceFileId]),
        CONSTRAINT [CK_AxonQueue_Status]        CHECK ([Status] IN (N'PENDING', N'OPENED', N'PROCESSED', N'REJECTED')),
        CONSTRAINT [CK_AxonQueue_Confidence]    CHECK ([SupplierConfidence] IS NULL OR ([SupplierConfidence] >= 0 AND [SupplierConfidence] <= 1)),
        CONSTRAINT [FK_AxonQueue_BulkCostRun]   FOREIGN KEY ([RunID]) REFERENCES [dbo].[BulkCostRun] ([RunID])
    );

    -- Dashboard query: เซลล์ดู PENDING items เรียงตามวันที่ล่าสุด
    CREATE INDEX [IX_AxonQueue_Status_ReceivedAt]
        ON [dbo].[AxonExtractionQueue] ([Status], [ReceivedAt] DESC);

    -- ค้นหาตาม Supplier ที่แนะนำ
    CREATE INDEX [IX_AxonQueue_SupplierCodeHint]
        ON [dbo].[AxonExtractionQueue] ([SupplierCodeHint])
        WHERE [SupplierCodeHint] IS NOT NULL;
END;


-- ─────────────────────────────────────────────────────────────────────────────
-- AIRecommendCache
-- Cache ผลการค้นหา AI (weight, HS code, permit) ต่อ part number
-- ป้องกัน API call ซ้ำ ประหยัดค่า GPT/Gemini/Grainger
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID(N'[dbo].[AIRecommendCache]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AIRecommendCache] (
        -- PK
        [CacheID]       bigint          IDENTITY(1, 1) NOT NULL,

        -- Key สำหรับ lookup
        -- SHA-256 hash ของ (FeatureType + partNo/brand/description รวมกัน)
        [CacheKey]      nvarchar(64)    NOT NULL,

        -- ประเภทของข้อมูลที่ cache
        -- WEIGHT  = น้ำหนักและขนาด (C1)
        -- HSCODE  = พิกัดภาษีและอัตราภาษี (C2)
        -- PERMIT  = ใบอนุญาตนำเข้าและ shelf life (C3)
        [FeatureType]   nvarchar(10)    NOT NULL,

        -- Input ที่ใช้ถาม AI (เก็บไว้ debug / retrain)
        [InputJson]     nvarchar(max)   NOT NULL,

        -- ผลที่ได้จาก AI หรือ Grainger
        [ResultJson]    nvarchar(max)   NOT NULL,

        -- แหล่งที่มาของข้อมูล
        -- grainger     = ดึงจาก Grainger product database
        -- ai_estimate  = AI ประเมินจาก description
        -- not_found    = หาไม่ได้
        [Source]        nvarchar(20)    NOT NULL,

        -- ความมั่นใจ 0.0–1.0 (จาก AI หรือ Grainger match score)
        [Confidence]    decimal(9, 6)   NOT NULL    CONSTRAINT [DF_AICache_Confidence] DEFAULT (0),

        -- Audit
        [CreatedAt]     datetime2(3)    NOT NULL    CONSTRAINT [DF_AICache_CreatedAt] DEFAULT (SYSDATETIME()),

        -- Cache TTL: WEIGHT/HSCODE หมดอายุใน 30 วัน, PERMIT ใน 7 วัน
        -- (ราคา Grainger เปลี่ยน, กฎหมายภาษีอาจปรับ)
        [ExpiresAt]     datetime2(3)    NOT NULL,

        CONSTRAINT [PK_AIRecommendCache]            PRIMARY KEY CLUSTERED ([CacheID] ASC),
        CONSTRAINT [UQ_AICache_Key_Feature]         UNIQUE ([CacheKey], [FeatureType]),
        CONSTRAINT [CK_AICache_FeatureType]         CHECK ([FeatureType] IN (N'WEIGHT', N'HSCODE', N'PERMIT')),
        CONSTRAINT [CK_AICache_Source]              CHECK ([Source] IN (N'grainger', N'ai_estimate', N'not_found')),
        CONSTRAINT [CK_AICache_Confidence]          CHECK ([Confidence] >= 0 AND [Confidence] <= 1)
    );

    -- Query หลัก: lookup by key + feature type + ยังไม่หมดอายุ
    CREATE INDEX [IX_AICache_Key_Feature_Expires]
        ON [dbo].[AIRecommendCache] ([CacheKey], [FeatureType], [ExpiresAt]);

    -- Cleanup job: ลบ expired cache
    CREATE INDEX [IX_AICache_ExpiresAt]
        ON [dbo].[AIRecommendCache] ([ExpiresAt]);
END;
