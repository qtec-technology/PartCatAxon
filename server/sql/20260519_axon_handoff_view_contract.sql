-- AXON -> PartCatalog final comparison read-model contract
-- Date: 2026-05-19
--
-- This file is a handoff contract for Pi-Jo/AXON to review and publish on the
-- AXON database side. Do not run it against PART_CATALOG_AIX as a migration.
-- PartCatalog reads these views only through:
--
--   DB_VIEW_AXON_FINAL_COMPARISON_HEADER
--   DB_VIEW_AXON_FINAL_COMPARISON_LINES
--
-- Source tables verified from the read-only AXON copy:
--   dbo.CustomerRFQ
--   dbo.CustomerRFQBrandGroup
--   dbo.CustomerRFQLine
--   dbo.SupplierRFQ
--   dbo.RFQ_SUPPLIER_QUOTE
--   dbo.RFQ_SUPPLIER_QUOTE_ITEM
--   dbo.RFQ_QUOTE_RANKING
--
-- Important:
--   * QlinkChainID is exposed as ChainId. It is a correlation reference, not a
--     PartCatalog BulkCostRun primary key.
--   * ComparisonRevision below is a "current snapshot" revision derived from
--     the latest AXON quote/ranking timestamp. A persistent AXON comparison
--     revision table is still preferred if AXON needs historical revisions.
--   * PartCatalog clones rows from these views into Origin/Latest snapshots
--     before calculating Bulk Cost. It must never update AXON source tables.

-- Suggested env values after AXON publishes the views:
-- DB_VIEW_AXON_FINAL_COMPARISON_HEADER=AXON.dbo.vwPartCatalogAxonFinalComparisonHeader
-- DB_VIEW_AXON_FINAL_COMPARISON_LINES=AXON.dbo.vwPartCatalogAxonFinalComparisonLines

CREATE OR ALTER VIEW [dbo].[vwPartCatalogAxonFinalComparisonHeader]
AS
WITH SourceEvents AS (
    SELECT cr.CustRFQMasterID, CAST(cr.DateUpdated AS datetime2(3)) AS UpdatedAt
    FROM dbo.CustomerRFQ cr
    WHERE cr.QlinkChainID IS NOT NULL

    UNION ALL

    SELECT bg.CustRFQMasterID, CAST(q.UpdatedAt AS datetime2(3)) AS UpdatedAt
    FROM dbo.CustomerRFQBrandGroup bg
    JOIN dbo.SupplierRFQ sr
      ON sr.CustRFQBrandGroupID = bg.CustRFQBrandGroupID
    JOIN dbo.RFQ_SUPPLIER_QUOTE q
      ON q.SuppRFQOperationID = sr.SuppRFQOperationID

    UNION ALL

    SELECT bg.CustRFQMasterID, CAST(qr.RankedAt AS datetime2(3)) AS UpdatedAt
    FROM dbo.CustomerRFQBrandGroup bg
    JOIN dbo.RFQ_QUOTE_RANKING qr
      ON qr.CustRFQBrandGroupID = bg.CustRFQBrandGroupID
),
SourceClock AS (
    SELECT
        CustRFQMasterID,
        MAX(UpdatedAt) AS UpdatedAt
    FROM SourceEvents
    GROUP BY CustRFQMasterID
)
SELECT
    cr.QlinkChainID AS ChainId,
    CONCAT(
        N'AXON-CURRENT-',
        CONVERT(nvarchar(30), DATEDIFF_BIG(MILLISECOND, CONVERT(datetime2(3), '1970-01-01'), COALESCE(sc.UpdatedAt, cr.DateUpdated, cr.DateReceived)))
    ) AS ComparisonRevision,
    CONVERT(nvarchar(50), cr.CustRFQMasterID) AS SourceRfqId,
    cr.CustCompany AS CustomerName,
    cr.CustRefNo AS CustomerReferenceNo,
    cr.Subject AS [Subject],
    cr.SapNo AS DocumentNo,
    cr.DateReceived AS DocumentDate,
    CAST(NULL AS nvarchar(30)) AS SupplierCode,
    CAST(NULL AS nvarchar(255)) AS SupplierName,
    CAST(NULL AS nvarchar(10)) AS Currency,
    CAST(NULL AS nvarchar(40)) AS PurchaseTerm,
    CAST(NULL AS nvarchar(80)) AS TermLocation,
    cr.Status AS QuoteStatus,
    COALESCE(sc.UpdatedAt, cr.DateUpdated, cr.DateReceived) AS UpdatedAt
FROM dbo.CustomerRFQ cr
LEFT JOIN SourceClock sc
  ON sc.CustRFQMasterID = cr.CustRFQMasterID
WHERE cr.QlinkChainID IS NOT NULL
  AND ISNULL(cr.Canceled, 0) = 0;
GO

CREATE OR ALTER VIEW [dbo].[vwPartCatalogAxonFinalComparisonLines]
AS
WITH SourceEvents AS (
    SELECT cr.CustRFQMasterID, CAST(cr.DateUpdated AS datetime2(3)) AS UpdatedAt
    FROM dbo.CustomerRFQ cr
    WHERE cr.QlinkChainID IS NOT NULL

    UNION ALL

    SELECT bg.CustRFQMasterID, CAST(q.UpdatedAt AS datetime2(3)) AS UpdatedAt
    FROM dbo.CustomerRFQBrandGroup bg
    JOIN dbo.SupplierRFQ sr
      ON sr.CustRFQBrandGroupID = bg.CustRFQBrandGroupID
    JOIN dbo.RFQ_SUPPLIER_QUOTE q
      ON q.SuppRFQOperationID = sr.SuppRFQOperationID

    UNION ALL

    SELECT bg.CustRFQMasterID, CAST(qr.RankedAt AS datetime2(3)) AS UpdatedAt
    FROM dbo.CustomerRFQBrandGroup bg
    JOIN dbo.RFQ_QUOTE_RANKING qr
      ON qr.CustRFQBrandGroupID = bg.CustRFQBrandGroupID
),
SourceClock AS (
    SELECT
        CustRFQMasterID,
        MAX(UpdatedAt) AS UpdatedAt
    FROM SourceEvents
    GROUP BY CustRFQMasterID
),
RankedSuppliers AS (
    SELECT
        sr.SuppRFQOperationID,
        qr.RankingID,
        CASE
            WHEN qr.RecommendedSuppRFQID = sr.SuppRFQOperationID THEN 1
            WHEN qr.AlternativeSuppRFQID = sr.SuppRFQOperationID THEN 2
            ELSE 999
        END AS SourceRank,
        CASE WHEN qr.RecommendedSuppRFQID = sr.SuppRFQOperationID THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS IsRecommendedSupplier,
        CAST(NULL AS bit) AS IsSelectedSupplier
    FROM dbo.SupplierRFQ sr
    LEFT JOIN dbo.RFQ_QUOTE_RANKING qr
      ON qr.CustRFQBrandGroupID = sr.CustRFQBrandGroupID
)
SELECT
    cr.QlinkChainID AS ChainId,
    CONCAT(
        N'AXON-CURRENT-',
        CONVERT(nvarchar(30), DATEDIFF_BIG(MILLISECOND, CONVERT(datetime2(3), '1970-01-01'), COALESCE(sc.UpdatedAt, cr.DateUpdated, cr.DateReceived)))
    ) AS ComparisonRevision,
    CONVERT(nvarchar(50), cr.CustRFQMasterID) AS SourceRfqId,
    CONVERT(nvarchar(50), bg.CustRFQBrandGroupID) AS BrandGroupId,
    CONVERT(nvarchar(50), sr.SuppRFQOperationID) AS SupplierRfqOperationId,
    CONVERT(nvarchar(50), q.QuoteID) AS SupplierQuoteId,
    CONVERT(nvarchar(50), qi.QuoteItemID) AS QuoteItemId,
    CONVERT(nvarchar(50), qi.CustRFQLineID) AS RfqLineId,
    CONCAT(N'AXON-QI-', CONVERT(nvarchar(50), qi.QuoteItemID)) AS AxonLineId,
    COALESCE(
        TRY_CONVERT(int, qi.RfqItemNo),
        ROW_NUMBER() OVER (PARTITION BY q.QuoteID ORDER BY qi.QuoteItemID)
    ) AS LineNo,
    rs.SourceRank,
    rs.IsRecommendedSupplier,
    rs.IsSelectedSupplier,
    sr.SupplierCode,
    sr.SupplierName,
    q.QuotationNo,
    q.QuoteDate,
    q.PaymentTerms,
    q.Incoterm AS PurchaseTerm,
    q.DeliveryTerms,
    q.FreightType,
    q.FreightAmount,
    qi.SupplierPartNumber AS SupplierOrderCode,
    COALESCE(bg.MfgBrand, cl.MfgBrand) AS MfrBrand,
    cl.PartNumber AS MfrCatalogNo,
    COALESCE(NULLIF(qi.Description, N''), cl.Description) AS [Description],
    COALESCE(qi.QuotedQty, qi.RfqQty, cl.Quantity) AS Qty,
    COALESCE(qi.QuotedUom, qi.RfqUom, cl.UOM) AS Uom,
    qi.UnitPrice,
    COALESCE(qi.Currency, q.Currency) AS Currency,
    qi.QuotedQty,
    qi.QuotedUom,
    qi.RfqQty,
    qi.RfqUom,
    qi.Moq,
    qi.LotSize,
    qi.LeadTimeDays,
    CAST(NULL AS decimal(19,6)) AS ItemWeightKg,
    CAST(NULL AS decimal(19,6)) AS [Length],
    CAST(NULL AS decimal(19,6)) AS [Width],
    CAST(NULL AS decimal(19,6)) AS [Height],
    CAST(NULL AS nvarchar(10)) AS DimUnit,
    CAST(NULL AS decimal(19,6)) AS ChargeableWeightKg,
    CAST(NULL AS nvarchar(30)) AS HsCode,
    CAST(NULL AS decimal(19,6)) AS DutyPercent,
    CAST(NULL AS bit) AS PermitRequired,
    CAST(NULL AS bit) AS ShelfLifeRequired,
    qi.MatchMethod,
    qi.MatchConfidence,
    COALESCE(qi.MatchConfidence, q.ExtractionConfidence) AS SourceConfidence,
    COALESCE(NULLIF(qi.SupplierRemarks, N''), NULLIF(q.ThreadSummary, N'')) AS SourceText
FROM dbo.CustomerRFQ cr
JOIN dbo.CustomerRFQBrandGroup bg
  ON bg.CustRFQMasterID = cr.CustRFQMasterID
JOIN dbo.SupplierRFQ sr
  ON sr.CustRFQBrandGroupID = bg.CustRFQBrandGroupID
JOIN dbo.RFQ_SUPPLIER_QUOTE q
  ON q.SuppRFQOperationID = sr.SuppRFQOperationID
JOIN dbo.RFQ_SUPPLIER_QUOTE_ITEM qi
  ON qi.QuoteID = q.QuoteID
LEFT JOIN dbo.CustomerRFQLine cl
  ON cl.CustRFQLineID = qi.CustRFQLineID
LEFT JOIN SourceClock sc
  ON sc.CustRFQMasterID = cr.CustRFQMasterID
LEFT JOIN RankedSuppliers rs
  ON rs.SuppRFQOperationID = sr.SuppRFQOperationID
WHERE cr.QlinkChainID IS NOT NULL
  AND ISNULL(cr.Canceled, 0) = 0
  AND q.TotalItemCount > 0;
GO
