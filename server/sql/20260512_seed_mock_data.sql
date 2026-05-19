-- ─────────────────────────────────────────────────────────────────────────────
-- Seed Mock Data — PART_CATALOG_AIX
-- ใช้สำหรับ UAT / Demo เท่านั้น
-- ต้องรัน 20260512_bulk_cost_full_schema.sql + 20260512_axon_ai_tables.sql ก่อน
-- ห้ามรันบน production หรือฐานข้อมูลที่มี AXON/PartCatalogAxon handoff จริง
-- หลัง architecture reset ให้ใช้ AXON final comparison view ผ่าน ChainId แทน seed queue นี้
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. AxonExtractionQueue  (13 pending items)
-- ═════════════════════════════════════════════════════════════════════════════
-- ล้างข้อมูลเก่า (ถ้ามี) แล้ว reseed
DELETE FROM [dbo].[AxonExtractionQueue];
SET IDENTITY_INSERT [dbo].[AxonExtractionQueue] ON;

INSERT INTO [dbo].[AxonExtractionQueue]
    ([QueueID],[SourceFileId],[SourceFileName],[DocumentType],[DocumentNo],[DocumentDate],
     [SupplierRawName],[SupplierCodeHint],[SupplierConfidence],
     [Currency],[PurchaseTerm],[TermLocation],[TotalLines],[Status],[RawPayloadJson],[ReceivedAt])
VALUES
(1, 'AXON-FILE-20260504-001', 'quote_grainger_20260504.pdf',       'quote', 'ALLOC-GRAINGER-MANAGER-2026-0430', '2026-05-04', 'Grainger',                        'V-GRA-001',          0.97, 'USD', 'Ex-work',            'California', 20, 'PENDING', N'{}', '2026-05-04T10:07:00'),
(2, 'AXON-FILE-20260506-001', 'quotation_mcmaster_20260506.pdf',   'quote', 'ALLOC-MCM-EXW-COUR-2026-0506',    '2026-05-06', 'McMaster-Carr Supply Co.',          'V-MCM-EXW-COUR',     0.93, 'USD', 'Exwork',             'US',         3,  'PENDING', N'{}', '2026-05-06T09:12:00'),
(3, 'AXON-FILE-20260506-002', 'quote_rs_components_20260506.pdf',  'quote', 'ALLOC-RSC-FCA-TRUCK-2026-0506',   '2026-05-06', 'RS Components Ltd.',                'V-RSC-FCA-TRUCK',    0.91, 'GBP', 'FCA',                'UK',         3,  'PENDING', N'{}', '2026-05-06T09:28:00'),
(4, 'AXON-FILE-20260506-003', 'smc_quote_20260506.pdf',            'quote', 'ALLOC-SMC-FOB-AIR-2026-0506',     '2026-05-06', 'SMC Corporation Japan',             'V-SMC-FOB-AIR',      0.95, 'JPY', 'FOB',                'JP',         3,  'PENDING', N'{}', '2026-05-06T09:45:00'),
(5, 'AXON-FILE-20260506-004', 'parker_china_quote_20260506.pdf',   'quote', 'ALLOC-PARKER-CN-SEA-2026-0506',   '2026-05-06', 'Parker China Distribution',         'V-PARKER-CN-SEA',    0.88, 'CNY', 'Exwork',             'CN',         3,  'PENDING', N'{}', '2026-05-06T10:02:00'),
(6, 'AXON-FILE-20260506-005', 'thai_industrial_supply_20260506.pdf','quote', 'ALLOC-LOCAL-DDP-QTRUCK-2026-0506','2026-05-06', 'Thai Industrial Supply Co., Ltd.',  'V-LOCAL-DDP-QTRUCK', 0.82, 'THB', 'DDP',                'TH',         3,  'PENDING', N'{}', '2026-05-06T10:18:00'),
(7, 'AXON-FILE-20260506-006', 'sick_sg_quote_20260506.pdf',        'quote', 'ALLOC-SICK-SG-DAP-2026-0506',     '2026-05-06', 'SICK Singapore Pte. Ltd.',          'V-SICK-SG-DAP',      0.96, 'SGD', 'DAP',                'SG',         3,  'PENDING', N'{}', '2026-05-06T10:34:00'),
(8, 'AXON-FILE-20260506-007', 'rittal_de_quote_20260506.pdf',      'quote', 'ALLOC-RITTAL-DE-FCA-2026-0506',   '2026-05-06', 'Rittal GmbH & Co. KG',              'V-RITTAL-DE-FCA',    0.90, 'EUR', 'FCA',                'DE',         3,  'PENDING', N'{}', '2026-05-06T10:52:00'),
(9, 'AXON-FILE-20260506-008', 'brammer_uk_quote_20260506.pdf',     'quote', 'ALLOC-BRAMMER-FAS-UK-2026-0506',  '2026-05-06', 'Brammer UK Industrial Parts',       'V-BRAMMER-FAS-UK',   0.87, 'GBP', 'FAS',                'UK',         3,  'OPENED', N'{}', '2026-05-06T11:05:00'),
(10,'AXON-FILE-20260506-009', 'thai_automation_quote_20260506.pdf','quote', 'ALLOC-TH-CPT-AIR-2026-0506',      '2026-05-06', 'Thai Automation Trading',           'V-TH-CPT-AIR',       0.79, 'THB', 'CPT',                'TH',         2,  'PENDING', N'{}', '2026-05-06T11:18:00'),
(11,'AXON-FILE-20260506-010', 'global_pump_quote_20260506.pdf',    'quote', 'ALLOC-CIF-TH-SEA-2026-0506',      '2026-05-06', 'Global Pump Importer',              'V-CIF-TH-SEA',       0.84, 'USD', 'CIF',                'TH',         2,  'PENDING', N'{}', '2026-05-06T11:31:00'),
(12,'AXON-FILE-20260506-011', 'qtec_local_pickup_20260506.pdf',    'quote', 'ALLOC-QTEC-PICK-MC-2026-0506',    '2026-05-06', 'QTEC Local Pickup Mock Supplier',   'V-QTEC-PICK-MC',     0.75, 'THB', 'QTEC PICK UP',       'TH',         2,  'PENDING', N'{}', '2026-05-06T11:46:00'),
(13,'AXON-FILE-20260506-012', 'thai_factory_direct_20260506.pdf',  'quote', 'ALLOC-EXFACT-TH-2026-0506',       '2026-05-06', 'Thai Factory Direct',               'V-EXFACT-TH',        0.81, 'THB', 'EX-FACTORY-Thailand','TH',         2,  'PENDING', N'{}', '2026-05-06T12:02:00');

-- OPENED row: set OpenedAt / OpenedBy
UPDATE [dbo].[AxonExtractionQueue]
SET [OpenedAt] = '2026-05-06T11:30:00', [OpenedBy] = 'Kittipat'
WHERE [QueueID] = 9;

SET IDENTITY_INSERT [dbo].[AxonExtractionQueue] OFF;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. BulkCostRun  (13 runs — ครอบทุก status)
-- ═════════════════════════════════════════════════════════════════════════════
DELETE FROM [dbo].[BulkCostRun];
SET IDENTITY_INSERT [dbo].[BulkCostRun] ON;

INSERT INTO [dbo].[BulkCostRun]
    ([RunID],[Status],[VendorCode],[VendorName],[ReferenceNo],
     [Currency],[ExchangeRate],[OrderTerm],[Location],[ShipModeNo],
     [SaleIncharge],
     [TotalLines],[TotalQty],[TotalAmount],[TotalWeight],
     [CreatedBy],[UpdatedBy],[CreatedAt],[UpdatedAt])
VALUES
(1,  'AWARDED',        'V-GRA-001',          'Grainger',                        'ALLOC-GRAINGER-MANAGER-2026-0430', 'USD', 33.00, 'Ex-work',            'California', 5, 'Kittipat Milawan', 20, 34,    8691.32,  52.21,  'Kittipat Milawan', 'Kittipat Milawan', '2026-04-30T09:50:00', '2026-04-30T10:14:00'),
(2,  'LOST',           'V-MCM-EXW-COUR',     'McMaster-Carr Supply Co.',        'ALLOC-MCM-EXW-COUR-2026-0506',    'USD', 33.00, 'Exwork',             'US',         6, 'Kittipat Milawan', 3,  6,     463.70,   5.30,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T09:12:00', '2026-05-06T09:45:00'),
(3,  'DRAFT',          'V-RSC-FCA-TRUCK',    'RS Components Ltd.',              'ALLOC-RSC-FCA-TRUCK-2026-0506',   'GBP', 45.00, 'FCA',                'UK',         3, 'Kittipat Milawan', 3,  59,    267.50,   4.10,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T09:28:00', '2026-05-06T10:05:00'),
(4,  'AWARDED',        'V-SMC-FOB-AIR',      'SMC Corporation Japan',           'ALLOC-SMC-FOB-AIR-2026-0506',     'JPY', 0.26,  'FOB',                'JP',         1, 'Kittipat Milawan', 3,  15,    121400,   7.70,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T09:45:00', '2026-05-06T11:00:00'),
(5,  'DRAFT',          'V-PARKER-CN-SEA',    'Parker China Distribution',       'ALLOC-PARKER-CN-SEA-2026-0506',   'CNY', 5.50,  'Exwork',             'CN',         2, 'Kittipat Milawan', 3,  27,    4615,     19.55,  'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T10:02:00', '2026-05-06T10:45:00'),
(6,  'QUOTED',         'V-LOCAL-DDP-QTRUCK', 'Thai Industrial Supply Co., Ltd.','ALLOC-LOCAL-DDP-QTRUCK-2026-0506','THB', 1.00,  'DDP',                'TH',         5, 'Kittipat Milawan', 3,  65,    33960,    20.62,  'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T10:18:00', '2026-05-06T10:55:00'),
(7,  'AWARDED',        'V-SICK-SG-DAP',      'SICK Singapore Pte. Ltd.',        'ALLOC-SICK-SG-DAP-2026-0506',     'SGD', 26.40, 'DAP',                'SG',         6, 'Kittipat Milawan', 3,  9,     3424,     3.53,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T10:34:00', '2026-05-06T11:20:00'),
(8,  'REVERSE_MAPPED', 'V-RITTAL-DE-FCA',    'Rittal GmbH & Co. KG',            'ALLOC-RITTAL-DE-FCA-2026-0506',   'EUR', 39.00, 'FCA',                'DE',         6, 'Kittipat Milawan', 3,  10,    595.40,   4.60,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T10:52:00', '2026-05-06T11:40:00'),
(9,  'LOST',           'V-BRAMMER-FAS-UK',   'Brammer UK Industrial Parts',     'ALLOC-BRAMMER-FAS-UK-2026-0506',  'GBP', 45.00, 'FAS',                'UK',         6, 'Kittipat Milawan', 3,  35,    416.80,   3.48,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T11:05:00', '2026-05-06T12:10:00'),
(10, 'DRAFT',          'V-TH-CPT-AIR',       'Thai Automation Trading',         'ALLOC-TH-CPT-AIR-2026-0506',      'THB', 1.00,  'CPT',                'TH',         1, 'Kittipat Milawan', 2,  5,     33400,    1.52,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T11:18:00', '2026-05-06T11:55:00'),
(11, 'AWARDED',        'V-CIF-TH-SEA',       'Global Pump Importer',            'ALLOC-CIF-TH-SEA-2026-0506',      'USD', 33.00, 'CIF',                'TH',         2, 'Kittipat Milawan', 2,  3,     2140,     85.80,  'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T11:31:00', '2026-05-06T12:20:00'),
(12, 'ARCHIVED',       'V-QTEC-PICK-MC',     'QTEC Local Pickup Mock Supplier', 'ALLOC-QTEC-PICK-MC-2026-0506',    'THB', 1.00,  'QTEC PICK UP',       'TH',         4, 'Kittipat Milawan', 2,  3,     1810,     0.13,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T11:46:00', '2026-05-06T12:35:00'),
(13, 'DRAFT',          'V-EXFACT-TH',        'Thai Factory Direct',             'ALLOC-EXFACT-TH-2026-0506',       'THB', 1.00,  'EX-FACTORY-Thailand','TH',         3, 'Kittipat Milawan', 2,  21,    13800,    5.70,   'Kittipat Milawan', 'Kittipat Milawan', '2026-05-06T12:02:00', '2026-05-06T12:50:00');

SET IDENTITY_INSERT [dbo].[BulkCostRun] OFF;
