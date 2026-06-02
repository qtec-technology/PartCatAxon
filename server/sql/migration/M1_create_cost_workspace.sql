-- ============================================================================
-- Cost Workspace Schema — Phase M1: Expand (create alongside existing tables)
-- Based on Business Decisions answered 2026-05-27
-- Target DB: PART_CATALOG_AIX
-- ============================================================================
-- Decision record:
--   #1  Draft persistence    : DraftJson is overwritable; immutable on Save Revision
--   #2  3 save actions       : Draft (overwrite), Revision (new RunID), Finalize (validate)
--   #3  Weight-missing policy: Block CAL 100% for bulk-by-weight; CWeight required per line
--   #4  Mixed currency       : Manual convert/reject in Phase 1; no auto-convert
--   #5  Doc fees             : Service Line (separate) — not spread across item lines
--   #6  Existing item+term   : Always Add New Term to keep price history
--   #7  Manual finalize      : User-triggered; Master Write only on Got Order
--   #8  ValidTo default      : ValidFrom + 1 month (editable)
--   #9  SCC/ASP basis        : Deferred — field stored as NULL, not used in CAL yet
--   #10 Unified line         : CostWorkspaceLine = DraftItem + DraftTerm merged
-- ============================================================================

-- 1. CostWorkspaceRun (replaces BulkCostRun for new Cost Workspace flow)
-- ---------------------------------------------------------------------------
CREATE TABLE [dbo].[CostWorkspaceRun] (
    RunID               BIGINT IDENTITY(1,1) PRIMARY KEY,

    -- Source & Mode
    SourceType          NVARCHAR(20)  NOT NULL DEFAULT 'MANUAL',    -- MANUAL | AXON_AWARDED
    CalcMode            NVARCHAR(10)  NOT NULL DEFAULT 'BULK',      -- SINGLE | BULK
    ChainId             NVARCHAR(50)  NULL,                          -- AXON correlation (not PK)
    SourceRevision      INT           NULL,                          -- AXON comparison revision

    -- Revision tracking
    RevisionGroupID     BIGINT        NULL,        -- groups revisions; backfilled to RunID on first save
    RevisionNo          INT           NOT NULL DEFAULT 1,
    RevisionSourceRunID BIGINT        NULL,        -- parent revision RunID

    -- Lifecycle: DRAFT → QUOTED → AWARDED → REVERSE_MAPPED → LOST → ARCHIVED
    -- Decision #2: Draft = overwrite DraftJson; Revision = new RunID with SnapshotType=SAVE_REVISION
    Status              NVARCHAR(20)  NOT NULL DEFAULT 'DRAFT',

    -- Draft persistence (Decision #1: overwritable workspace state)
    DraftJson           NVARCHAR(MAX) NULL,        -- full draft RAM state (overwritten on Save Draft)

    -- Supplier
    VendorCode          NVARCHAR(30)  NOT NULL,
    VendorName          NVARCHAR(200) NULL,
    ReferenceNo         NVARCHAR(100) NULL,

    -- Run-level defaults
    Currency            NVARCHAR(10)  NULL,
    ExchangeRate        DECIMAL(19,6) NULL DEFAULT 1,
    OrderTerm           NVARCHAR(30)  NULL,
    Location            NVARCHAR(30)  NULL,
    SubLocation         NVARCHAR(30)  NULL,
    ShipModeNo          INT           NULL DEFAULT -1,
    ContactPerson       NVARCHAR(100) NULL,
    SaleIncharge        NVARCHAR(100) NULL,

    -- Header costs for allocation
    U_PKH               DECIMAL(19,6) NULL DEFAULT 0,
    U_SOC               DECIMAL(19,6) NULL DEFAULT 0,
    U_Freight           DECIMAL(19,6) NULL DEFAULT 0,
    U_Customs           DECIMAL(19,6) NULL DEFAULT 0,
    U_WireTT            DECIMAL(19,6) NULL DEFAULT 0,

    -- Run-level defaults pushed down to new lines
    DefaultINSPercent   DECIMAL(19,6) NULL DEFAULT 1,
    DefaultDutyPercent  DECIMAL(19,6) NULL DEFAULT 0,
    DefaultSTKPercent   DECIMAL(19,6) NULL DEFAULT 0,
    DefaultSPK          DECIMAL(19,6) NULL DEFAULT 0,
    DefaultQOC          DECIMAL(19,6) NULL DEFAULT 0,
    DefaultMarkup       DECIMAL(19,6) NULL DEFAULT 0,

    -- Summary (denormalised for list views)
    TotalLines          INT           NULL DEFAULT 0,
    TotalQty            DECIMAL(19,6) NULL DEFAULT 0,
    TotalAmount         DECIMAL(19,6) NULL DEFAULT 0,
    TotalWeight         DECIMAL(19,6) NULL DEFAULT 0,
    Remark              NVARCHAR(500) NULL,

    -- Latest CAL result cache (overwritten on every CAL run)
    PreviewSnapshotJson NVARCHAR(MAX) NULL,

    -- Migration link to legacy BulkCostRun
    LegacyRunID         BIGINT        NULL,

    -- Audit
    CreatedBy           NVARCHAR(100) NOT NULL,
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedBy           NVARCHAR(100) NOT NULL,
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_CWRun_RevisionGroup
    ON [dbo].[CostWorkspaceRun] (RevisionGroupID, RevisionNo DESC, RunID DESC);

CREATE INDEX IX_CWRun_ChainId
    ON [dbo].[CostWorkspaceRun] (ChainId) WHERE ChainId IS NOT NULL;

CREATE INDEX IX_CWRun_Status
    ON [dbo].[CostWorkspaceRun] (Status, UpdatedAt DESC);


-- 2. CostWorkspaceLine (Decision #10: merged DraftItem + DraftTerm)
-- ---------------------------------------------------------------------------
CREATE TABLE [dbo].[CostWorkspaceLine] (
    LineID              BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunID               BIGINT        NOT NULL REFERENCES [dbo].[CostWorkspaceRun](RunID) ON DELETE CASCADE,
    LineKey             NVARCHAR(50)  NOT NULL,
    [LineNo]            INT           NOT NULL DEFAULT 0,

    -- Status
    DraftStatus         NVARCHAR(20)  NULL DEFAULT 'DRAFT',
    MatchType           NVARCHAR(30)  NULL,    -- 'existing' | 'new_item'

    -- ─── Item Fields (@POITM mirror) ───────────────────────────────────────
    ItemIDHint          INT           NULL,    -- matched existing ItemID (hint, not FK)
    ItemCode            NVARCHAR(50)  NULL,
    ItemGroup           NVARCHAR(10)  NULL,
    ItemCategory        NVARCHAR(50)  NULL,
    U_Brand             NVARCHAR(100) NULL,
    U_Calalogno         NVARCHAR(100) NULL,    -- Mfr Catalog No (matches @POITM column name)
    ItemDescription     NVARCHAR(500) NULL,
    InvntryUom          NVARCHAR(20)  NULL,    -- Stock UOM
    U_CountryOrg        NVARCHAR(50)  NULL,
    BPStockItemNo       NVARCHAR(100) NULL,    -- Supplier Order Code
    U_HScode            NVARCHAR(50)  NULL,
    U_Permitreq         NVARCHAR(5)   NULL,
    U_PermitType        NVARCHAR(50)  NULL,
    CustomerStockCode   NVARCHAR(100) NULL,

    -- Item extended fields (captured at Finalize time)
    ECCN                NVARCHAR(50)  NULL,
    UNSPSC              NVARCHAR(50)  NULL,
    U_eProcurementCode  NVARCHAR(100) NULL,
    LongDesc1           NVARCHAR(MAX) NULL,
    LongDesc2           NVARCHAR(MAX) NULL,
    LongDesc3           NVARCHAR(MAX) NULL,
    LongDesc4           NVARCHAR(MAX) NULL,
    GeneralSpec         NVARCHAR(MAX) NULL,
    ReferenceUrl        NVARCHAR(500) NULL,

    -- Item Y/N flags (NVARCHAR(5) matches @POITM convention)
    Active              NVARCHAR(5)   NULL DEFAULT 'Y',
    U_SDS               NVARCHAR(5)   NULL,
    U_Certificate       NVARCHAR(5)   NULL,
    U_CustBPA           NVARCHAR(5)   NULL,
    U_IsQTECSTock       NVARCHAR(5)   NULL,
    U_SerialReq         NVARCHAR(5)   NULL,
    U_DG                NVARCHAR(5)   NULL,
    U_eCommerce         NVARCHAR(5)   NULL,

    -- ─── Term Fields (@PITM1 mirror) ───────────────────────────────────────
    TermIDHint          INT           NULL,    -- matched existing TermID (hint, not FK)
    VendorCode          NVARCHAR(30)  NULL,
    VendorName          NVARCHAR(200) NULL,

    -- Quantity & Price
    QuoteQty            DECIMAL(19,6) NULL DEFAULT 0,
    QuoteAmount         DECIMAL(19,6) NULL DEFAULT 0,
    U_ProdCost          DECIMAL(19,6) NULL DEFAULT 0,
    U_PurCurr           NVARCHAR(10)  NULL,
    U_PurRate           DECIMAL(19,6) NULL DEFAULT 1,

    -- Term context
    U_OrderTerm         NVARCHAR(30)  NULL,
    U_TermLocation      NVARCHAR(30)  NULL,
    SubLocation         NVARCHAR(30)  NULL,
    U_SalesTerm         NVARCHAR(30)  NULL,
    SaleSubLocation     NVARCHAR(30)  NULL,
    U_ShipModeNo        INT           NULL DEFAULT -1,
    U_ValidFrom         DATETIME2     NULL,
    U_ValidTo           DATETIME2     NULL,    -- Decision #8: default = ValidFrom + 1 month

    -- Dimensions & Weight
    U_DimUnitNo         INT           NULL DEFAULT 1,
    U_Length            DECIMAL(19,6) NULL DEFAULT 0,
    U_Width             DECIMAL(19,6) NULL DEFAULT 0,
    U_Height            DECIMAL(19,6) NULL DEFAULT 0,
    U_Weight            DECIMAL(19,6) NULL DEFAULT 0,
    U_CWeight           DECIMAL(19,6) NULL DEFAULT 0,    -- Decision #3: must not be NULL for CAL

    -- Freight & Insurance
    U_FreightRate       DECIMAL(19,6) NULL DEFAULT 0,
    U_FR                DECIMAL(19,6) NULL DEFAULT 0,
    INS_Percent         DECIMAL(19,6) NULL DEFAULT 1,
    U_ZoneRate          DECIMAL(19,6) NULL DEFAULT 0,

    -- Tax & Duty
    U_DT_Percent        DECIMAL(19,6) NULL DEFAULT 0,
    U_ETPer             DECIMAL(19,6) NULL DEFAULT 0,
    U_MiscTax           DECIMAL(19,6) NULL DEFAULT 0,
    U_ASP               DECIMAL(19,6) NULL DEFAULT 0,    -- SCC (Decision #9: deferred — store only)
    U_STK_Percent       DECIMAL(19,6) NULL DEFAULT 0,

    -- UOM & Conversion
    BuyUnitMsr          NVARCHAR(20)  NULL,
    SalUnitMsr          NVARCHAR(20)  NULL,
    NumInBuy            DECIMAL(19,6) NULL DEFAULT 1,
    NumInSale           DECIMAL(19,6) NULL DEFAULT 1,

    -- Sales
    U_SPK               DECIMAL(19,6) NULL DEFAULT 0,
    U_QOC               DECIMAL(19,6) NULL DEFAULT 0,
    U_MK_Percent        DECIMAL(19,6) NULL DEFAULT 0,
    U_WTT               DECIMAL(19,6) NULL DEFAULT 0,
    U_CC                DECIMAL(19,6) NULL DEFAULT 0,

    -- Document Fees per each (Decision #5: Service Line = no spreading)
    DocFee_COC          DECIMAL(19,6) NULL DEFAULT 0,
    DocFee_MillCert     DECIMAL(19,6) NULL DEFAULT 0,
    DocFee_TestCert     DECIMAL(19,6) NULL DEFAULT 0,
    DocFee_COA          DECIMAL(19,6) NULL DEFAULT 0,
    DocFee_COO          DECIMAL(19,6) NULL DEFAULT 0,
    DocFee_AnyOther     DECIMAL(19,6) NULL DEFAULT 0,
    DocFeeBasisJson     NVARCHAR(500) NULL,    -- per-kind basis config (JSON)

    -- Lead Time & MOQ
    DeliveryLeadTime    NVARCHAR(50)  NULL,
    MOQ                 DECIMAL(19,6) NULL,

    -- Person codes
    ContactPerson       NVARCHAR(100) NULL,
    SaleIncharge        NVARCHAR(100) NULL,
    SourcedBy           NVARCHAR(100) NULL,

    -- ─── Calculated Output (from CAL engine) ──────────────────────────────
    U_OP                DECIMAL(19,6) NULL,
    U_OP_SUM            DECIMAL(19,6) NULL,
    U_OP_THB            DECIMAL(19,6) NULL,
    U_DimWeight         DECIMAL(19,6) NULL,
    U_ShipWeightCal     DECIMAL(19,6) NULL,
    U_INS               DECIMAL(19,6) NULL,
    U_FRZONE            DECIMAL(19,6) NULL,
    U_FreightQTEC       DECIMAL(19,6) NULL,
    U_CIF               DECIMAL(19,6) NULL,
    U_CIFZONE           DECIMAL(19,6) NULL,
    U_DT                DECIMAL(19,6) NULL,
    U_DT_FR             DECIMAL(19,6) NULL,
    U_DT_FRZONE         DECIMAL(19,6) NULL,
    U_ET                DECIMAL(19,6) NULL,
    U_MT                DECIMAL(19,6) NULL,
    U_preQLC            DECIMAL(19,6) NULL,
    U_STK               DECIMAL(19,6) NULL,
    U_QLC               DECIMAL(19,6) NULL,
    U_QLC2              DECIMAL(19,6) NULL,
    U_QLC3              DECIMAL(19,6) NULL,
    U_TotalPrice        DECIMAL(19,6) NULL,
    U_MK_THB            DECIMAL(19,6) NULL,
    U_SalesPrice        DECIMAL(19,6) NULL,

    -- ─── Allocation Output ────────────────────────────────────────────────
    WeightRatioPerEach  DECIMAL(19,6) NULL,
    ValueRatioPerEach   DECIMAL(19,6) NULL,
    AllocPKH            DECIMAL(19,6) NULL,
    AllocSOC            DECIMAL(19,6) NULL,
    AllocFreight        DECIMAL(19,6) NULL,
    AllocWireTT         DECIMAL(19,6) NULL,
    AllocCC             DECIMAL(19,6) NULL,

    -- ─── AXON Matching Hints ──────────────────────────────────────────────
    AxonUniqueLineId    NVARCHAR(100) NULL,
    AxonMatchMethod     NVARCHAR(50)  NULL,
    AxonMatchConfidence DECIMAL(5,2)  NULL,

    -- ─── Awarded Tracking (Decision #6: always Add New Term) ─────────────
    AwardedItemID       INT           NULL,    -- FK hint to @POITM.ItemID after Finalize
    AwardedTermID       INT           NULL,    -- FK hint to @PITM1.TermID after Finalize
    AwardedAt           DATETIME2     NULL,
    AwardedBy           NVARCHAR(100) NULL,

    -- Snapshots
    LatestSnapshotJson  NVARCHAR(MAX) NULL,
    OriginSnapshotJson  NVARCHAR(MAX) NULL,

    -- Audit
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt           DATETIME2     NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_CWLine_RunLineKey UNIQUE (RunID, LineKey)
);

CREATE INDEX IX_CWLine_RunID
    ON [dbo].[CostWorkspaceLine] (RunID, [LineNo] ASC);


-- 3. CostWorkspaceSnapshot (immutable revision history)
-- ---------------------------------------------------------------------------
-- Decision #2: Save Revision creates a new snapshot row; never updated after insert.
CREATE TABLE [dbo].[CostWorkspaceSnapshot] (
    SnapshotID          BIGINT IDENTITY(1,1) PRIMARY KEY,
    RunID               BIGINT        NOT NULL REFERENCES [dbo].[CostWorkspaceRun](RunID),
    SnapshotType        NVARCHAR(20)  NOT NULL,    -- 'SAVE_REVISION' | 'FINALIZE' | 'ORIGIN'
    RevisionNo          INT           NOT NULL,

    RunSnapshotJson     NVARCHAR(MAX) NOT NULL,    -- full run header state at snapshot time
    LinesSnapshotJson   NVARCHAR(MAX) NOT NULL,    -- all lines + calc results at snapshot time

    CreatedBy           NVARCHAR(100) NOT NULL,
    CreatedAt           DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_CWSnapshot_Run
    ON [dbo].[CostWorkspaceSnapshot] (RunID, RevisionNo DESC);
