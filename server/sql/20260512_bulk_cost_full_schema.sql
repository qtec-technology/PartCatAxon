-- ─────────────────────────────────────────────────────────────────────────────
-- Bulk Cost Full Schema — PART_CATALOG_AIX
-- สร้างทดแทน 20260508_bulk_cost_draft_snapshot.sql (อย่ารันไฟล์เก่า)
-- ─────────────────────────────────────────────────────────────────────────────
-- ลำดับ:
--   1. BulkCostRun     — หัวใบ Quotation ต่อ Supplier 1 ราย
--   2. DraftItem       — mirror @POITM  (Virtual FG ก่อน Awarded)
--   3. DraftTerm       — mirror @PITM1  (ราคา/เงื่อนไข ก่อน Awarded)
--
-- Reverse Mapping ตอน Awarded:
--   INSERT @POITM  ← SELECT @POITM columns  FROM DraftItem  WHERE RunID=X
--   INSERT @PITM1  ← SELECT @PITM1 columns  FROM DraftTerm  WHERE RunID=X
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. BulkCostRun — หัวใบ Quotation
-- ═════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID(N'[dbo].[BulkCostRun]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[BulkCostRun] (
        [RunID]          bigint         IDENTITY(1,1) NOT NULL,

        -- สถานะ lifecycle
        -- DRAFT         → เซลล์กำลัง work ยังไม่ส่งลูกค้า
        -- QUOTED         → ส่งใบเสนอราคาให้ลูกค้าแล้ว
        -- AWARDED        → ลูกค้า confirm → trigger Reverse Mapping เข้า SAP
        -- REVERSE_MAPPED → สร้าง Item/Term จริงใน SAP แล้ว
        -- LOST           → ลูกค้าไม่ซื้อ
        -- ARCHIVED       → ปิดแล้ว ไม่ใช้งาน
        [Status]         nvarchar(20)   NOT NULL CONSTRAINT [DF_BulkCostRun_Status]    DEFAULT (N'DRAFT'),

        -- Supplier ที่เสนอราคา
        [VendorCode]     nvarchar(30)   NOT NULL,
        [VendorName]     nvarchar(255)  NULL,
        [ReferenceNo]    nvarchar(100)  NULL,   -- เลข quote จาก supplier

        -- ค่าหลักระดับ run (ใช้กับทุก line)
        [Currency]       nvarchar(10)   NOT NULL CONSTRAINT [DF_BulkCostRun_Currency]      DEFAULT (N'THB'),
        [ExchangeRate]   decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_ExchangeRate]  DEFAULT ((1)),
        [OrderTerm]      nvarchar(40)   NULL,
        [Location]       nvarchar(80)   NULL,
        [ShipModeNo]     int            NULL,
        [ContactPerson]  nvarchar(255)  NULL,
        [SaleIncharge]   nvarchar(255)  NULL,   -- username เซลล์ที่ดูแล
        [Remark]         nvarchar(1000) NULL,

        -- ต้นทุน run-level (total สำหรับการ allocate)
        [U_PKH]          decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_PKH]        DEFAULT ((0)),
        [U_SOC]          decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_SOC]        DEFAULT ((0)),
        [U_Freight]      decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_Freight]    DEFAULT ((0)),
        [U_Customs]      decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_Customs]    DEFAULT ((0)),
        [U_WireTT]       decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_WireTT]     DEFAULT ((0)),

        -- Summary (อัปเดตตอน save)
        [TotalLines]     int            NOT NULL CONSTRAINT [DF_BulkCostRun_TotalLines]   DEFAULT ((0)),
        [TotalQty]       decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_TotalQty]     DEFAULT ((0)),
        [TotalAmount]    decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_TotalAmount]  DEFAULT ((0)),
        [TotalWeight]    decimal(19,6)  NOT NULL CONSTRAINT [DF_BulkCostRun_TotalWeight]  DEFAULT ((0)),

        -- Allocation preview snapshot (JSON): เก็บผลคำนวณ CAL ครั้งล่าสุด
        -- ใช้สำหรับ restore workspace โดยไม่ต้อง re-run CAL
        [PreviewSnapshotJson] nvarchar(max) NULL,

        -- Audit
        [CreatedBy]      nvarchar(50)   NOT NULL,
        [CreatedAt]      datetime2(3)   NOT NULL CONSTRAINT [DF_BulkCostRun_CreatedAt]    DEFAULT (SYSDATETIME()),
        [UpdatedBy]      nvarchar(50)   NOT NULL,
        [UpdatedAt]      datetime2(3)   NOT NULL CONSTRAINT [DF_BulkCostRun_UpdatedAt]    DEFAULT (SYSDATETIME()),

        CONSTRAINT [PK_BulkCostRun] PRIMARY KEY CLUSTERED ([RunID] ASC),
        CONSTRAINT [CK_BulkCostRun_Status] CHECK ([Status] IN (
            N'DRAFT', N'QUOTED', N'AWARDED', N'REVERSE_MAPPED', N'LOST', N'ARCHIVED'
        ))
    );

    CREATE INDEX [IX_BulkCostRun_Status_UpdatedAt]
        ON [dbo].[BulkCostRun] ([Status], [UpdatedAt] DESC);

    CREATE INDEX [IX_BulkCostRun_VendorCode_UpdatedAt]
        ON [dbo].[BulkCostRun] ([VendorCode], [UpdatedAt] DESC);
END;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. DraftItem — mirror @POITM + Bulk Cost metadata
--    ทุก column ที่ไม่ใช่ metadata ตรงกับ buildCreateItemInsertSql ใน item.write.ts
--    ตอน Awarded: INSERT INTO SBOQTEC.dbo.@POITM SELECT [columns] FROM DraftItem
-- ═════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID(N'[dbo].[DraftItem]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DraftItem] (

        -- ── Bulk Cost Metadata (ไม่มีใน @POITM) ──────────────────────────────
        [DraftItemID]            bigint        IDENTITY(1,1) NOT NULL,
        [RunID]                  bigint        NOT NULL,       -- FK → BulkCostRun
        [LineKey]                nvarchar(100) NOT NULL,       -- unique per run เช่น "grainger-001"
        [LineNo]                 int           NOT NULL,       -- ลำดับที่ใน run

        -- สถานะ (sync กับ BulkCostRun.Status)
        [DraftStatus]            nvarchar(20)  NOT NULL CONSTRAINT [DF_DraftItem_Status] DEFAULT (N'DRAFT'),

        -- ประเภทการ match
        -- existing  → มี Item จริงใน SAP แล้ว (ใช้ ItemIDHint)
        -- new_item  → ต้องสร้าง Item ใหม่ใน SAP ตอน Awarded
        [MatchType]              nvarchar(20)  NOT NULL CONSTRAINT [DF_DraftItem_MatchType] DEFAULT (N'new_item'),
        [ItemIDHint]             int           NULL,   -- ItemID ที่ match ถ้าเป็น existing
        [ItemGroupSuggestedByAI] bit           NOT NULL CONSTRAINT [DF_DraftItem_AISuggest] DEFAULT (0),

        -- Quote quantity/amount สำหรับ run นี้ (ไม่มีใน @POITM)
        [QuoteQty]               decimal(19,6) NOT NULL CONSTRAINT [DF_DraftItem_QuoteQty]    DEFAULT ((0)),
        [QuoteAmount]            decimal(19,6) NOT NULL CONSTRAINT [DF_DraftItem_QuoteAmount] DEFAULT ((0)),

        -- Reverse Mapping result (อัปเดตหลัง Awarded)
        [AwardedItemID]          int           NULL,   -- ItemID จริงใน SBOQTEC.@POITM
        [AwardedAt]              datetime2(3)  NULL,
        [AwardedBy]              nvarchar(50)  NULL,

        -- ── @POITM Columns (ตรงกับ INSERT ใน item.write.ts) ─────────────────
        -- Required fields
        [ItemGroup]              int           NOT NULL,          -- Item Group code
        [U_Brand]                nvarchar(50)  NOT NULL CONSTRAINT [DF_DraftItem_Brand]    DEFAULT (N''),
        [U_Calalogno]            nvarchar(100) NOT NULL CONSTRAINT [DF_DraftItem_Catalog]  DEFAULT (N''),  -- Catalog No
        [ItemDescription]        nvarchar(100) NOT NULL CONSTRAINT [DF_DraftItem_Desc]     DEFAULT (N''),
        [InvntryUom]             nvarchar(10)  NOT NULL CONSTRAINT [DF_DraftItem_Uom]      DEFAULT (N''),  -- Stock UOM

        -- Optional identification
        [U_CountryOrg]           nvarchar(10)  NULL,   -- Country of Origin
        [BPStockItemNo]          nvarchar(50)  NULL,   -- Supplier's stock item no
        [B1ItemNo]               nvarchar(50)  NULL,   -- SAP B1 Item No (NULL for new items)
        [SAPB1Desc]              nvarchar(100) NULL,   -- SAP B1 Description

        -- Tax groups
        [VatGroupPu]             nvarchar(10)  NULL,   -- VAT group purchase
        [VatGourpSa]             nvarchar(10)  NULL,   -- VAT group sales

        -- Trade / compliance
        [U_ECCN]                 nvarchar(20)  NULL,   -- Export Control Classification No
        [U_UNSPSC]               nvarchar(20)  NULL,   -- UNSPSC code
        [U_EpoCode]              nvarchar(20)  NULL,
        [U_HScode]               nvarchar(20)  NULL,   -- HS Code (จาก AI C2)
        [U_Remark]               nvarchar(254) NULL,

        -- Logistics
        [LeadTime]               nvarchar(5)   NULL,
        [SaleSubLocation]        nvarchar(50)  NULL,

        -- Classification
        [ItemCategory]           nvarchar(50)  NULL,
        [SpecialRequirement]     nvarchar(500) NULL,
        [GeneralSpec]            nvarchar(max) NULL,
        [GeneralSpecUrl]         nvarchar(500) NULL,
        [MasterFG]               nvarchar(20)  NULL,

        -- Long descriptions
        [LongDesc1]              nvarchar(max) NULL,
        [LongDesc2]              nvarchar(max) NULL,
        [LongDesc3]              nvarchar(max) NULL,
        [LongDesc4]              nvarchar(max) NULL,

        -- Checkbox flags (Y / N)
        [U_Punchout]             nvarchar(1)   NULL,
        [U_VMI]                  nvarchar(1)   NULL,
        [U_CustBPA]              nvarchar(1)   NULL,
        [U_IsQTECSTock]          nvarchar(1)   NULL,
        [U_B1Item]               nvarchar(1)   NULL,
        [U_Serialreq]            nvarchar(1)   NULL,
        [U_MSDS]                 nvarchar(1)   NULL,   -- MSDS required
        [U_Certificate]          nvarchar(1)   NULL,   -- Certificate required
        [U_Ecommerce]            nvarchar(1)   NULL,
        [U_DG_Required]          nvarchar(1)   NULL,   -- Dangerous goods
        [U_Permitreq]            nvarchar(1)   NULL,   -- Import permit required (จาก AI C3)
        [U_PermitType]           nvarchar(30)  NULL,   -- ประเภทใบอนุญาต (จาก AI C3)

        [Active]                 bit           NOT NULL CONSTRAINT [DF_DraftItem_Active] DEFAULT (1),

        -- Audit (ตรงกับ @POITM)
        [Updatedby]              nvarchar(50)  NOT NULL CONSTRAINT [DF_DraftItem_Updatedby]   DEFAULT (N''),
        [UpdatedDate]            datetime2(3)  NOT NULL CONSTRAINT [DF_DraftItem_UpdatedDate] DEFAULT (SYSDATETIME()),
        [CreatedAt]              datetime2(3)  NOT NULL CONSTRAINT [DF_DraftItem_CreatedAt]   DEFAULT (SYSDATETIME()),

        -- ── Snapshot JSON (workspace restore) ────────────────────────────────
        -- LatestSnapshotJson: full AllocationLineSource สำหรับ restore workspace
        -- OriginSnapshotJson: AXON origin snapshot (NULL จน Phase 3B AXON integrate)
        [LatestSnapshotJson]     nvarchar(max) NULL,
        [OriginSnapshotJson]     nvarchar(max) NULL,

        CONSTRAINT [PK_DraftItem]              PRIMARY KEY CLUSTERED ([DraftItemID] ASC),
        CONSTRAINT [UQ_DraftItem_Run_LineKey]  UNIQUE ([RunID], [LineKey]),
        CONSTRAINT [CK_DraftItem_Status]       CHECK ([DraftStatus] IN (N'DRAFT', N'QUOTED', N'AWARDED', N'REJECTED', N'ARCHIVED')),
        CONSTRAINT [CK_DraftItem_MatchType]    CHECK ([MatchType]   IN (N'existing', N'new_item')),
        CONSTRAINT [FK_DraftItem_BulkCostRun]  FOREIGN KEY ([RunID]) REFERENCES [dbo].[BulkCostRun] ([RunID]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_DraftItem_RunID_LineNo]
        ON [dbo].[DraftItem] ([RunID], [LineNo]);

    CREATE INDEX [IX_DraftItem_ItemIDHint]
        ON [dbo].[DraftItem] ([ItemIDHint])
        WHERE [ItemIDHint] IS NOT NULL;

    CREATE INDEX [IX_DraftItem_AwardedItemID]
        ON [dbo].[DraftItem] ([AwardedItemID])
        WHERE [AwardedItemID] IS NOT NULL;
END;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. DraftTerm — mirror @PITM1 + Bulk Cost metadata
--    ทุก column ที่ไม่ใช่ metadata ตรงกับ TERM_COLUMNS ใน term.write.ts
--    ตอน Awarded:
--      UPDATE DraftTerm SET ItemID = (AwardedItemID จาก DraftItem)
--      INSERT INTO SBOQTEC.dbo.@PITM1 SELECT [columns] FROM DraftTerm
-- ═════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID(N'[dbo].[DraftTerm]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DraftTerm] (

        -- ── Bulk Cost Metadata (ไม่มีใน @PITM1) ──────────────────────────────
        [DraftTermID]   bigint        IDENTITY(1,1) NOT NULL,
        [DraftItemID]   bigint        NOT NULL,       -- FK → DraftItem
        [RunID]         bigint        NOT NULL,       -- FK → BulkCostRun (redundant, ช่วย query)
        [LineKey]       nvarchar(100) NOT NULL,       -- ตรงกับ DraftItem.LineKey

        [DraftStatus]   nvarchar(20)  NOT NULL CONSTRAINT [DF_DraftTerm_Status] DEFAULT (N'DRAFT'),

        -- ItemID = NULL จน DraftItem ถูก Awarded แล้ว UPDATE เป็น ItemID จริง
        -- นี่คือ FK ที่จะใส่ตอน INSERT เข้า @PITM1 จริง
        [ItemID]        int           NULL,
        [TermIDHint]    int           NULL,   -- TermID เดิมถ้า existing term

        -- Reverse Mapping result
        [AwardedTermID] int           NULL,   -- TermID จริงใน SBOQTEC.@PITM1
        [AwardedAt]     datetime2(3)  NULL,
        [AwardedBy]     nvarchar(50)  NULL,

        -- ── @PITM1 Input Columns (user editable, ตรงกับ TERM_COLUMNS) ────────

        -- Supplier
        [VendorCode]        nvarchar(15)   NOT NULL CONSTRAINT [DF_DraftTerm_VendorCode] DEFAULT (N''),
        [VendorStockItemNo] nvarchar(100)  NULL,

        -- Purchase Term & Location
        [U_OrderTerm]       nvarchar(30)   NULL,
        [U_TermLocation]    nvarchar(10)   NULL,
        [SubLocation]       nvarchar(50)   NULL,

        -- Product Cost
        [U_ProdCost]        decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_ProdCost]  DEFAULT (0),
        [U_PurCurr]         nvarchar(10)   NOT NULL CONSTRAINT [DF_DraftTerm_PurCurr]   DEFAULT (N''),
        [U_PurRate]         decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_PurRate]   DEFAULT (1),
        [U_PKH]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_PKH]       DEFAULT (0),
        [U_SOC]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_SOC]       DEFAULT (0),

        -- Ship Mode (No = number, text = derived label)
        [U_ShipModeNo]      int            NOT NULL CONSTRAINT [DF_DraftTerm_ShipModeNo] DEFAULT (-1),
        [U_ShipMode]        nvarchar(10)   NULL,  -- Air FWD / Sea / Truck / QTEC-MC ...

        -- Dimension
        [U_DimUnitNo]       int            NOT NULL CONSTRAINT [DF_DraftTerm_DimUnitNo] DEFAULT (1),
        [U_DimUnit]         nvarchar(5)    NULL,  -- CM / INCH
        [U_Length]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_Length]    DEFAULT (0),
        [U_Width]           decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_Width]     DEFAULT (0),
        [U_Height]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_Height]    DEFAULT (0),
        [U_Weight]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_Weight]    DEFAULT (0),  -- น้ำหนักจริง kg (จาก AI C1)
        [U_CWeight]         decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_CWeight]   DEFAULT (0),  -- chargeable weight kg

        -- Freight
        [U_FreightType]     nvarchar(30)   NULL,
        [U_FreightRate]     decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_FreightRate] DEFAULT (0),
        [U_FR]              decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_FR]        DEFAULT (0),

        -- Cost rates
        [INS_Percent]       decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_INS_Pct]   DEFAULT (0),
        [U_ZoneRate]        decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_ZoneRate]  DEFAULT (0),
        [U_DT_Percent]      decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_DT]        DEFAULT (0),  -- Import Duty % (จาก AI C2)
        [U_ETPer]           decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_ET]        DEFAULT (0),  -- Excise Tax %
        [U_MiscTax]         decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_MiscTax]   DEFAULT (0),

        -- QLC components
        [U_WTT]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_WTT]       DEFAULT (0),  -- Wire TT
        [U_CC]              decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_CC]        DEFAULT (0),  -- Custom Clear
        [U_ASP]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_ASP]       DEFAULT (0),  -- Special Custom Clear
        [U_STK_Percent]     decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_STK]       DEFAULT (0),  -- Stock Fee %
        [U_MK_Percent]      decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_MK]        DEFAULT (0),  -- Markup %
        [U_SPK]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_SPK]       DEFAULT (0),  -- Special Packing
        [U_QOC]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_QOC]       DEFAULT (0),  -- QC Cost

        -- UOM
        [BuyUnitMsr]        nvarchar(20)   NULL,
        [NumInBuy]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_NumInBuy]  DEFAULT (1),
        [SalUnitMsr]        nvarchar(20)   NULL,
        [NumInSale]         decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_NumInSale] DEFAULT (1),

        -- Additional
        [U_MOQ]             nvarchar(50)   NULL,
        [LeadTime]          nvarchar(5)    NULL,
        [U_VendorBPA]       nvarchar(3)    NULL,   -- Y / N

        -- Person codes + names
        [CntctCode]         int            NULL,
        [CntctName]         nvarchar(100)  NULL,
        [SlpCode]           int            NULL,
        [SlpName]           nvarchar(100)  NULL,
        [SlpSprtCode]       int            NULL,
        [SlpSprtName]       nvarchar(100)  NULL,

        -- Validity
        [U_ValidFrom]       date           NULL,
        [U_ValidTo]         date           NULL,

        -- Sales info
        [U_SalesTerm]       nvarchar(20)   NULL,
        [U_Remark]          nvarchar(254)  NULL,
        [SaleSubLocation]   nvarchar(50)   NULL,
        [Active]            bit            NOT NULL CONSTRAINT [DF_DraftTerm_Active] DEFAULT (1),
        [ContractNo]        nvarchar(50)   NULL,

        -- ── @PITM1 Calculated Columns (populated by CAL engine before Save) ──

        -- Order Price
        [U_OP]              decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_OP]        DEFAULT (0),
        [U_OP_SUM]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_OPSUM]     DEFAULT (0),
        [U_OP_THB]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_OPTHB]     DEFAULT (0),

        -- Insurance & Freight
        [U_INS]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_INS_Amt]   DEFAULT (0),
        [U_FRZONE]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_FRZONE]    DEFAULT (0),

        -- CIF
        [U_CIF]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_CIF]       DEFAULT (0),
        [U_CIFZONE]         decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_CIFZONE]   DEFAULT (0),

        -- Import Duty amounts
        [U_DT]              decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_DTAmt]     DEFAULT (0),
        [U_DT_FR]           decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_DTFR]      DEFAULT (0),
        [U_DT_FRZONE]       decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_DTFRZONE]  DEFAULT (0),

        -- Excise & Misc
        [U_ET]              decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_ETAmt]     DEFAULT (0),
        [U_MT]              decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_MT]        DEFAULT (0),

        -- Weight calc
        [U_DimWeight]       decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_DimWeight] DEFAULT (0),
        [U_ShipWeightCal]   decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_ShipWgt]   DEFAULT (0),
        [U_FreightQTEC]     decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_FreightQ]  DEFAULT (0),

        -- QLC
        [U_preQLC]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_PreQLC]    DEFAULT (0),
        [U_STK]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_STKAmt]    DEFAULT (0),
        [U_QLC]             decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_QLC]       DEFAULT (0),
        [U_QLC2]            decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_QLC2]      DEFAULT (0),  -- QLC per Stock UOM
        [U_QLC3]            decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_QLC3]      DEFAULT (0),  -- Total Price (SPK+QOC)

        -- Sales Price
        [U_MK_THB]          decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_MKTHB]     DEFAULT (0),
        [U_SalesPrice]      decimal(19,6)  NOT NULL CONSTRAINT [DF_DraftTerm_SalesPrice] DEFAULT (0),

        -- ── Audit (ตรงกับ @PITM1) ────────────────────────────────────────────
        [Updatedby]         nvarchar(50)   NOT NULL CONSTRAINT [DF_DraftTerm_Updatedby]   DEFAULT (N''),
        [UpdatedDate]       datetime2(3)   NOT NULL CONSTRAINT [DF_DraftTerm_UpdatedDate] DEFAULT (SYSDATETIME()),
        [CreatedAt]         datetime2(3)   NOT NULL CONSTRAINT [DF_DraftTerm_CreatedAt]   DEFAULT (SYSDATETIME()),

        CONSTRAINT [PK_DraftTerm]             PRIMARY KEY CLUSTERED ([DraftTermID] ASC),
        CONSTRAINT [UQ_DraftTerm_Run_LineKey] UNIQUE ([RunID], [LineKey]),
        CONSTRAINT [CK_DraftTerm_Status]      CHECK ([DraftStatus] IN (N'DRAFT', N'QUOTED', N'AWARDED', N'REJECTED', N'ARCHIVED')),
        CONSTRAINT [FK_DraftTerm_DraftItem]   FOREIGN KEY ([DraftItemID]) REFERENCES [dbo].[DraftItem]  ([DraftItemID]) ON DELETE CASCADE,
        CONSTRAINT [FK_DraftTerm_BulkCostRun] FOREIGN KEY ([RunID])       REFERENCES [dbo].[BulkCostRun]([RunID])
    );

    CREATE INDEX [IX_DraftTerm_RunID]
        ON [dbo].[DraftTerm] ([RunID], [LineKey]);

    CREATE INDEX [IX_DraftTerm_DraftItemID]
        ON [dbo].[DraftTerm] ([DraftItemID]);

    CREATE INDEX [IX_DraftTerm_ItemID]
        ON [dbo].[DraftTerm] ([ItemID])
        WHERE [ItemID] IS NOT NULL;

    CREATE INDEX [IX_DraftTerm_AwardedTermID]
        ON [dbo].[DraftTerm] ([AwardedTermID])
        WHERE [AwardedTermID] IS NOT NULL;
END;
