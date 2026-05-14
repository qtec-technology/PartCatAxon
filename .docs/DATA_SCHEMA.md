# DATA_SCHEMA.md — PartCatalog Complete Data Reference

> **วัตถุประสงค์**: เอกสาร reference ถาวรสำหรับ column mapping, DB objects, calculation engine, stored procedures และ data sync jobs  
> **Source**: สังเคราะห์จาก AI/ folder (docs 5, 6, 8) ก่อน folder ถูกลบ  
> **อัปเดตล่าสุด**: 2026-05-14
> **Agent protocol**: ถ้าเพิ่ม field ใหม่ หรือแก้สูตร หรือแก้ DB object → อัปเดตเอกสารนี้ด้วย

---

## 1. ภาพรวม Database Architecture

| DB | บทบาท | หมายเหตุ |
|---|---|---|
| `PART_CATALOG_AIX` | DB หลักของ PartCatalog | write target ทุก table |
| `SBOQTEC` | SAP B1 DB | read-only via linked server / cross-DB query |

**Pattern**: หน้า Item และ Term ใช้ **read via view, write via table** เสมอ

---

## 2. DB Objects — Item

### 2.1 Read Objects (Item)

| Object | DB | บทบาท |
|---|---|---|
| `VWIT_@POITM` | SBOQTEC | Primary read view (ItemList, Search, Item detail) |
| `@POITM` | PART_CATALOG_AIX | left join สำหรับ `GeneralSpec` และ `GeneralSpecUrl` |
| `VWIT_@POITM_PARTNO` | SBOQTEC | Mfr Catalog No autocomplete |
| `VWIT_@POITM_CATEGORY_BRAND` | SBOQTEC | Category → Brand report |

### 2.2 Write Target (Item)

| Operation | Target | หมายเหตุ |
|---|---|---|
| Create item | `@POITM` (INSERT) | `ItemCode` ยังไม่มีตอน insert |
| Update item | `@POITM` (UPDATE) | by `ItemID` |
| Generate ItemCode | SP `SPIT_GenCatalogNo` | เรียกหลัง insert สำเร็จ |
| Upload image | filesystem `ITEM_IMAGE_DIR` | ชื่อไฟล์ `IIMG{ItemID}.{ext}` |
| Upload attachment | filesystem `ATTACHMENT_DIR` + SP `SPIT_CreateAttachFile` | owner type = `I` |

---

## 3. DB Objects — Term

### 3.1 Read Objects (Term)

| Object | DB | บทบาท |
|---|---|---|
| `vw@PITM1` | PART_CATALOG_AIX | Primary read view (Term detail) |
| `@PITM1_BRAND_VENDOR` | PART_CATALOG_AIX synonym | Brand → Vendor report cache |
| `@PITM1_VENDOR_BRAND` | PART_CATALOG_AIX synonym | Vendor → Brand report cache |

### 3.2 Write Target (Term)

| Operation | Target |
|---|---|
| Create term | `@PITM1` (INSERT) |
| Update term | `@PITM1` (UPDATE) by `TermID` |
| Upload attachment | filesystem `ATTACHMENT_DIR` + SP `SPIT_CreateAttachFile` |

> ⚠️ **สำคัญ**: Backend คำนวณ calculation ใหม่ทุกครั้งก่อน create/update term → client ส่งแค่ input fields เท่านั้น

---

### 3.3 Bulk Cost Draft Snapshot Tables

Phase 3A stores quotation work as app-side snapshots in `PART_CATALOG_AIX`.
These tables are independent from master Item/Term writes and must not update
`@POITM` or `@PITM1`.

Creation script: `server/sql/20260512_bulk_cost_full_schema.sql`.

#### 3.3.1 `BulkCostRun`

| Column | Type | Role |
|---|---|---|
| `RunID` | `bigint identity` | Primary key |
| `Status` | `nvarchar(20)` | Lifecycle status; starts as `DRAFT` |
| `VendorCode`, `VendorName` | text | Supplier for one quotation run |
| `ReferenceNo`, `Currency`, `ExchangeRate`, `OrderTerm`, `Location`, `ShipModeNo` | mixed | Quote-level context; same for all lines in the run |
| `TotalLines`, `TotalQty`, `TotalAmount`, `TotalWeight` | numeric | Preview summary |
| `InputSnapshotJson` | `nvarchar(max)` | Costs + selected line keys + origin/latest summary |
| `PreviewSnapshotJson` | `nvarchar(max)` | Full allocation preview used when saved |
| `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt` | audit | App audit fields |

#### 3.3.2 `DraftItem` / `DraftTerm`

| Column | Type | Role |
|---|---|---|
| `DraftItemID` | `bigint identity` | Primary key for item-side draft snapshot |
| `DraftTermID` | `bigint identity` | Primary key for term-side draft snapshot |
| `RunID` | `bigint` | FK to `BulkCostRun` |
| `DraftItemID` on `DraftTerm` | `bigint` | FK from term-side snapshot to item-side snapshot |
| `LineKey`, `LineNo` | text/int | Source row identity inside the run |
| `ItemIDHint`, `TermIDHint` | int | Existing item/term hints only; not master writes |
| `LatestSnapshotJson`, `OriginSnapshotJson` | `nvarchar(max)` | Auditable source/edit snapshots |
| Item mirror fields | mixed | Draft Item candidate values, e.g. brand, catalog no, description, UOM |
| Term mirror fields | mixed | Draft Term candidate values, e.g. vendor stock code, costs, weight, CAL outputs |

`BulkCostLine` was removed from the live Phase 3A schema. Phase 3A now stores
draft snapshots as `DraftItem` and `DraftTerm` records under `BulkCostRun`.
These are still AIX draft tables only and must not be treated as writes to
master `@POITM` / `@PITM1`.

Document fee note: By Lot / Batch document-fee line candidates can live inside
snapshot JSON first. Before production migration or reporting requirements, add
explicit columns such as `LineType` and `DocumentFeeBasis` if generated
certificate/test fee lines need to be queried outside the JSON payload.

Status lifecycle: `DRAFT -> QUOTED -> AWARDED -> REVERSE_MAPPED -> LOST -> ARCHIVED`.
Awarded reverse mapping remains deferred until existing-term INSERT-vs-UPDATE rules
are confirmed.

---

## 4. Item Column Mapping

### 4.1 Item Header / Master Fields

| UI Field | API Field | Read Source | Save Target | Status | หมายเหตุ |
|---|---|---|---|---|---|
| Item ID | (route param) | `vw@POITM.ItemID` | PK of `@POITM` | Generated | |
| Item Group | `ItemGroup` | `vw@POITM.ItemGroup` | `@POITM.ItemGroup` | R/W | ส่งเป็นตัวเลข |
| Catalog No | (ไม่ส่ง) | `vw@POITM.ItemCode` | SP `SPIT_GenCatalogNo` | Generated | item code ของระบบ ≠ Mfr Catalog No |
| B1 Item No | `B1ItemNo` | `vw@POITM.B1ItemNo` | ✅ persist จริง | R/W | API รับและ repo เขียนลง DB ทั้ง create และ update; New Item ค่าว่างต้องส่ง/เก็บเป็น SQL `NULL` |
| Mfr Brand | `U_Brand` | `vw@POITM.U_Brand` | `@POITM.U_Brand` | R/W | |
| Mfr Catalog No | `U_Calalogno` | `vw@POITM.U_Calalogno` | `@POITM.U_Calalogno` | R/W | legacy typo "Calalog" |
| Item Description | `ItemDescription` | `vw@POITM.ItemDescription` | `@POITM.ItemDescription` | R/W | required |
| Special Requirement | `SpecialRequirement` | `vw@POITM.SpecialRequirement` | `@POITM.SpecialRequirement` | R/W | |
| Customer Stock Code | `BPStockItemNo` | `vw@POITM.BPStockItemNo` | `@POITM.BPStockItemNo` | R/W | |
| Stock UOM | `InvntryUom` | `vw@POITM.InvntryUom` | `@POITM.InvntryUom` | R/W | ใช้ต่อในหน้า Term |
| Country of Origin | `U_CountryOrg` | `vw@POITM.U_CountryOrg` | `@POITM.U_CountryOrg` | R/W | ว่าง → ส่ง `_Null` |
| ECCN | `U_ECCN` | `vw@POITM.U_ECCN` | `@POITM.U_ECCN` | R/W | |
| UNSPSC | `U_UNSPSC` | `vw@POITM.U_UNSPSC` | `@POITM.U_UNSPSC` | R/W | |
| E-Procurement Code | `U_EpoCode` | `vw@POITM.U_EpoCode` | `@POITM.U_EpoCode` | R/W | |
| Remark | `U_Remark` | `vw@POITM.U_Remark` | `@POITM.U_Remark` | R/W | |
| Updated By | (auto) | `vw@POITM.Updatedby` | `@POITM.Updatedby` | auto | backend set |
| Updated Date | (auto) | `vw@POITM.UpdatedDate` | `@POITM.UpdatedDate` | auto | backend set |

### 4.2 Item Flags / Checkboxes

| UI Field | API Field | DB Column | Format |
|---|---|---|---|
| Active | `Active` | `@POITM.Active` | bool/bit |
| Master FG | `MasterFG` | `@POITM.MasterFG` | bool/bit |
| Shelf Life Required | `U_Punchout` | `@POITM.U_Punchout` | `Y/N` — ✅ ส่งและบันทึกจริง ผ่าน `mapFormToApiBody()` |
| Punch Out | `U_Punchout` | `@POITM.U_Punchout` | `Y/N` |
| VMI | `U_VMI` | `@POITM.U_VMI` | `Y/N` |
| Customer BPA | `U_CustBPA` | `@POITM.U_CustBPA` | `Y/N` |
| Is QTEC Stock | `U_IsQTECSTock` | `@POITM.U_IsQTECSTock` | `Y/N` |
| B1 Item | `U_B1Item` | `@POITM.U_B1Item` | `Y/N` |
| Serial Required | `U_Serialreq` | `@POITM.U_Serialreq` | `Y/N` |
| SDS Required | `U_MSDS` | `@POITM.U_MSDS` | `Y/N` (UI=SDS, DB=MSDS) |
| Certificate Required | `U_Certificate` | `@POITM.U_Certificate` | `Y/N` |
| E-Commerce | `U_Ecommerce` | `@POITM.U_Ecommerce` | `Y/N` |
| DG Required | `U_DG_Required` | `@POITM.U_DG_Required` | `Y/N` |
| Permit Required | `U_Permitreq` | `@POITM.U_Permitreq` | `Y/N` |
| Permit Type | `U_PermitType` | `@POITM.U_PermitType` | lookup code |
| Harmonized Code (HS) | `U_HScode` | `@POITM.U_HScode` | manual, ยังไม่มี auto-derive |

### 4.3 Item Description / Reference Fields

| UI Field | API Field | Read Source | Save Target |
|---|---|---|---|
| LongDesc1–4 | `LongDesc1`–`LongDesc4` | `vw@POITM.LongDesc1`–4 | `@POITM.LongDesc1`–4 |
| General Spec | `GeneralSpec` | `@POITM.GeneralSpec` (left join) | `@POITM.GeneralSpec` |
| Reference URL | `GeneralSpecUrl` | `@POITM.GeneralSpecUrl` (left join) | `@POITM.GeneralSpecUrl` |
| hasImage | (derived) | filesystem `ITEM_IMAGE_DIR` | filesystem |

### 4.4 Field Mapping Notes

| Field | สถานะ | หมายเหตุ |
|---|---|---|
| `B1ItemNo` | ✅ ทำงานครบ | frontend ส่ง + server INSERT/UPDATE รับ; ค่าว่าง/blank ถูก normalize เป็น `null` แล้วส่งลง DB เป็น SQL `NULL`, ค่าที่มีจริงจะ trim ก่อน save |
| `shelfLifeRequired` | ✅ ทำงานครบ | map เป็น `U_Punchout: toYN(data.shelfLifeRequired)` ใน `mapFormToApiBody()` |
| `punchOut` (ItemData type) | ⚠️ Ghost field | มีใน `ItemData` type และ `mapItemToForm` (อ่านจาก `U_Punchout`) แต่**ไม่มี checkbox ใน UI** และ**ไม่มีใน write path** — อ่านค่าเดียวกับ `shelfLifeRequired`; ไม่กระทบการทำงาน safe to ignore |

---

## 5. Term Column Mapping

### 5.1 Term Header / Supplier Fields

| UI Field | API Field | Read Source | Save Target | Status |
|---|---|---|---|---|
| Term ID | (route param) | `vw@PITM1.TermID` | PK of `@PITM1` | Generated |
| Item Code | (ไม่ส่ง) | `vw@PITM1.ItemCode` หรือ item API | ไม่ save ใน term | Read-only |
| Item Description | (ไม่ส่ง) | `vw@PITM1.ItemDescription` | ไม่ save ใน term | Read-only |
| Supplier Code | `VendorCode` | `vw@PITM1.VendorCode` | `@PITM1.VendorCode` | R/W |
| Supplier Name | (ไม่ส่ง) | `vw@PITM1.CardName` / lookup | ไม่ save ตรง | Read-only/lookup |
| Contact Person Code | `CntctCode` | `vw@PITM1.CntctCode` | `@PITM1.CntctCode` | R/W |
| Contract No | `ContractNo` | `vw@PITM1.ContractNo` | `@PITM1.ContractNo` | R/W |
| Supp Order Code | `VendorStockItemNo` | `vw@PITM1.VendorStockItemNo` | `@PITM1.VendorStockItemNo` | R/W |
| Active | `Active` | `vw@PITM1.Active` | `@PITM1.Active` | R/W |
| Valid From | `U_ValidFrom` | `vw@PITM1.U_ValidFrom` | `@PITM1.U_ValidFrom` | R/W |
| Valid To | `U_ValidTo` | `vw@PITM1.U_ValidTo` | `@PITM1.U_ValidTo` | R/W |
| Purchase Term | `U_OrderTerm` | `vw@PITM1.U_OrderTerm` | `@PITM1.U_OrderTerm` | R/W |
| Purchase Term Location | `U_TermLocation` | `vw@PITM1.U_TermLocation` | `@PITM1.U_TermLocation` | R/W |
| Purchase Sub Location | `SubLocation` | `vw@PITM1.SubLocation` | `@PITM1.SubLocation` | R/W | Dropdown filtered from `@SUBLOCATION` by `Module='AP'` and `Country=<Purchase Term Location>` |
| Sales Term | `U_SalesTerm` | `vw@PITM1.U_SalesTerm` | `@PITM1.U_SalesTerm` | R/W |
| Sales Sub Location | `SaleSubLocation` | `vw@PITM1.SaleSubLocation` | `@PITM1.SaleSubLocation` | R/W |
| Remark | `U_Remark` | `vw@PITM1.U_Remark` | `@PITM1.U_Remark` | R/W |
| Lead Time | `LeadTime` | `vw@PITM1.LeadTime` | `@PITM1.LeadTime` | R/W |
| MOQ / MOV | `U_MOQ` | `vw@PITM1.U_MOQ` | `@PITM1.U_MOQ` | R/W |
| Vendor BPA | `U_VendorBPA` | `vw@PITM1.U_VendorBPA` | `@PITM1.U_VendorBPA` | R/W |
| Sales Person Code | `SlpCode` | `vw@PITM1.SlpCode` | `@PITM1.SlpCode` | R/W |
| Sourced By Code | `SlpSprtCode` | `vw@PITM1.SlpSprtCode` | `@PITM1.SlpSprtCode` | R/W |
| Updated By | (auto) | `vw@PITM1.Updatedby` | `@PITM1.Updatedby` | auto |
| Updated Date | (auto) | `vw@PITM1.UpdatedDate` | `@PITM1.UpdatedDate` | auto |

### 5.2 Term Calculation Input Fields

| UI Field | API Field | Save Target | หมายเหตุ |
|---|---|---|---|
| Product Cost | `U_ProdCost` | `@PITM1.U_ProdCost` | |
| PKH | `U_PKH` | `@PITM1.U_PKH` | |
| SOC | `U_SOC` | `@PITM1.U_SOC` | |
| Currency | `U_PurCurr` | `@PITM1.U_PurCurr` | |
| Exchange Rate | `U_PurRate` | `@PITM1.U_PurRate` | UI อาจ auto-fill จาก currency |
| Purchase UOM | `BuyUnitMsr` | `@PITM1.BuyUnitMsr` | |
| Sales UOM | `SalUnitMsr` | `@PITM1.SalUnitMsr` | |
| Num In Buy | `U_NumInBuy` | `@PITM1.U_NumInBuy` | default 1 ถ้า 0 |
| Num In Sale | `U_NumInSale` | `@PITM1.U_NumInSale` | default 1 ถ้า 0 |
| Ship Mode No | `U_ShipModeNo` | `@PITM1.U_ShipModeNo` | 1=Air Fwd, 2=Sea, 3=Truck, 4=QTEC-Moto, 5=QTEC-Truck, 6=Air Courier |
| Ship Mode Label | (Generated) | `@PITM1.U_ShipMode` | backend derive จาก No |
| Dim Unit No | `U_DimUnitNo` | `@PITM1.U_DimUnitNo` | 1=CM, 2=INCH |
| Dim Unit Label | (Generated) | `@PITM1.U_DimUnit` | backend derive จาก No |
| Length | `U_Length` | `@PITM1.U_Length` | |
| Width | `U_Width` | `@PITM1.U_Width` | |
| Height | `U_Height` | `@PITM1.U_Height` | |
| Weight | `U_Weight` | `@PITM1.U_Weight` | |
| CWeight | `U_CWeight` | `@PITM1.U_CWeight` | persist แล้วแต่ preview ยังใช้ MAX(DW, itemWeight) |
| Freight Type | `U_FreightType` | `@PITM1.U_FreightType` | |
| Freight Rate | `U_FreightRate` | `@PITM1.U_FreightRate` | |
| FR | `U_FR` | `@PITM1.U_FR` | **input** สำหรับ CIF/QLC |
| Insurance % | `INS_Percent` | `@PITM1.INS_Percent` | |
| Zone Rate | `U_ZoneRate` | `@PITM1.U_ZoneRate` | auto-fill จาก location lookup |
| DT % | `U_DT` | `@PITM1.U_DT` | duty % input |
| ET % | `U_ET` | `@PITM1.U_ET` | excise tax % input |
| Misc Tax | `U_MiscTax` | `@PITM1.U_MiscTax` | |
| WTT | `U_WTT` | `@PITM1.U_WTT` | |
| CC | `U_CC` | `@PITM1.U_CC` | Custom Clear cost (manual) |
| SCC / ASP | `U_ASP` | `@PITM1.U_ASP` | Special Custom Clear |
| STK % | `U_STK` | `@PITM1.U_STK` | % for stock cost |
| SPK | `U_SPK` | `@PITM1.U_SPK` | |
| QOC | `U_QOC` | `@PITM1.U_QOC` | |
| Markup % | `U_Markup` | `@PITM1.U_Markup` | |

### 5.3 Term Calculated Output Fields (persist ทั้งหมด)

| DB Column | ความหมาย |
|---|---|
| `U_OP` | Order Price (OP1) |
| `U_OP_SUM` | OP1 × ExchangeRate (THB base) |
| `U_OP_THB` | OP2 (THB) หลัง surcharge branch |
| `U_DimWeight` | Dimensional Weight |
| `U_ShipWeightCal` | Shipping Weight = CEILING(MAX(DimWeight, ItemWeight), 0.5) |
| `U_FreightQTEC` | Freight to QTEC = ShipWeightCal × FreightRate |
| `U_INS` | Insurance amount |
| `U_FRZONE` | Freight Zone cost |
| `U_CIF` | CIF (ปกติ) |
| `U_CIFZONE` | CIF Zone |
| `U_DT_FR` | Duty on CIF |
| `U_DT_FRZONE` | Duty on CIF Zone |
| `U_DT` | Import Duty = MAX(DT_FR, DT_FRZONE) |
| `U_ET` | Excise Tax |
| `U_MT` | Municipal Tax = ET × 0.10 |
| `U_preQLC` | Pre-QLC sum |
| `U_STK` | STK amount |
| `U_QLC` | QTEC W/H Cost = CEILING(preQLC + STK, 0.01) |
| `U_QLC2` | QLC / numInBuy (cost per stock unit) |
| **`U_QLC3`** | **Total Price (persisted source of truth)** |
| `U_MK_THB` | Markup amount |
| `U_SalesPrice` | Sales Price |
| `U_TotalPrice` | ⚠️ compatibility alias ของ `U_QLC3` เท่านั้น |

---

## 6. Calculation Engine — สูตรทั้งหมด

> **กฎ**: backend เป็น source of truth เสมอ; ปัดเป็น 6 decimal places ทุก output

### 6.1 Order Price (OP)

```
U_OP      = productCost + pkh + soc
U_OP_SUM  = U_OP × exchangeRate

Branch U_OP_THB:
  IF orderTerm ∈ {Exwork, FCA, FAS, FOB} AND shipModeNo ∈ {3, 6}
    → U_OP_THB = U_OP × exchangeRate × 1.03   (surcharge +3%)
  ELSE
    → U_OP_THB = U_OP × exchangeRate
```

### 6.2 Freight to QTEC

```
volume = length × width × height
IF dimUnit = 2 (INCH) → adjustedVolume = volume × 17
ELSE                   → adjustedVolume = volume

DimWeight:
  shipModeNo < 1 or volume = 0 → U_DimWeight = 0
  shipModeNo = 1,4,5           → U_DimWeight = adjustedVolume / 6000
  shipModeNo = 2 (Sea)         → U_DimWeight = MAX(adjustedVolume / 1000, 1000)
  shipModeNo = 3,6             → U_DimWeight = adjustedVolume / 5000
  else                         → U_DimWeight = adjustedVolume / 6000

U_ShipWeightCal = CEILING(MAX(U_DimWeight, itemWeight), 0.5)
U_FreightQTEC   = U_ShipWeightCal × freightRate
```

> **Note**: `U_CWeight` persist ได้ แต่ preview engine ยังใช้ `MAX(DimWeight, itemWeight)` ไม่ใช่ CWeight

### 6.3 CIF / Insurance / FRZONE / CIFZONE

```
U_INS = U_OP_THB × (insPercent / 100)

U_FRZONE:
  Exwork/FCA AND shipModeNo = 3 → U_FRZONE = 0.1 × U_OP_THB
  Exwork/FCA AND shipModeNo = 6 → U_FRZONE = MAX(U_DimWeight, itemWeight) × zoneRate
  else                          → U_FRZONE = 0

U_CIF:
  Exwork/FCA AND shipModeNo = 3 → U_CIF = 0
  else                          → U_CIF = U_OP_THB + U_INS + FR

U_CIFZONE:
  Exwork/FCA AND shipModeNo ∈ {3, 6} → U_CIFZONE = U_OP_THB + U_INS + U_FRZONE
  else                               → U_CIFZONE = 0
```

### 6.4 Import Duty (DT)

```
U_DT_FR    = U_CIF × (dtPercent / 100)
U_DT_FRZONE = U_CIFZONE × (dtPercent / 100)
U_DT       = MAX(U_DT_FR, U_DT_FRZONE)
```

### 6.5 Excise Tax (ET)

```
IF etPercent = 0 → U_ET = 0
ELSE:
  cifMax      = MAX(U_CIF, U_CIFZONE)
  denominator = 1 - (1.1 × etPercent / 100)
  IF denominator <= 0 → U_ET = 0
  ELSE → U_ET = (cifMax + U_DT + miscTax) × (etPercent / 100) / denominator
```

> Reverse formula — มี guard หารศูนย์

### 6.6 Municipal Tax (MT)

```
U_MT = U_ET × 0.10
```

### 6.7 QTEC W/H Cost (QLC)

```
U_preQLC = (U_OP × exchangeRate) + U_INS + FR + U_DT + U_ET + U_MT + miscTax + wtt + cc + scc
U_STK    = (stkPercent / 100) × U_preQLC
U_QLC    = CEILING(U_preQLC + U_STK, 0.01)
```

> ⚠️ base ของ `U_preQLC` ใช้ `U_OP × exchangeRate` (= `U_OP_SUM`) ไม่ใช่ `U_OP_THB`

### 6.8 UOM Conversion

```
IF numInBuy <= 0 → U_QLC2 = 0
ELSE             → U_QLC2 = U_QLC / numInBuy

IF numInSale <= 0 → qlc3Base = 0
ELSE              → qlc3Base = U_QLC2 × numInSale
```

### 6.9 Sales Calculation

```
totalPrice  = qlc3Base + sspk + qoc
denominator = 1 - (markupPercent / 100)

IF denominator <= 0:
  U_MK_THB    = 0
  U_SalesPrice = 0
ELSE:
  U_MK_THB    = (totalPrice / denominator) - totalPrice
  U_SalesPrice = totalPrice / denominator

U_QLC3      = totalPrice          ← persisted source of truth
U_TotalPrice = totalPrice          ← compatibility alias only
```

### 6.10 Business Rule Defaults

| Rule | ค่า |
|---|---|
| `exchangeRate` ไม่ส่ง | default = 1 |
| `numInBuy` / `numInSale` = 0 | treat as 1 |
| `FR` vs `U_FreightQTEC` | FR = user input; U_FreightQTEC = calculated |
| Markup guard | denominator ≤ 0 → output = 0 |
| Rounding | round 6 decimal places ทุก output |

---

## 7. Lookup Tables

### 7.1 Item Form Lookups

| Table | DB | UI Field | Key Columns |
|---|---|---|---|
| `@BRAND` | SBOQTEC | Brand / MFG | `Code, U_Brand` |
| `@ITEMGROUP` | PART_CATALOG_AIX | Item Group | `ItemGroupCode, ItemGroupName` |
| `@UOM` | SBOQTEC | Stock UOM | `Code, Name` |
| `@COUTRYORG` | SBOQTEC | Country of Origin | `Code, Name` |
| `@PERMITTYPE` | PART_CATALOG_AIX | Permit Type | `Code, Name` |
| `@ITEMCATEGORY` | SBOQTEC | Item Category | `Code, Name` |

### 7.2 Term Form Lookups

| Table | DB | UI Field | Key Columns |
|---|---|---|---|
| `@OCRD` | PART_CATALOG_AIX | Supplier | `CardCode, CardName, validFor` |
| `@OCPR` | PART_CATALOG_AIX | Contact Person | `CntctCode, CardCode, Name, Active` |
| `@ORDERTERM` | SBOQTEC | Purchase/Sales Term | `Code, Name` |
| `@LOCATION` | PART_CATALOG_AIX | Term Location | `Code, Name, Priority, ZoneName, ZoneRate` |
| `@SUBLOCATION` | PART_CATALOG_AIX | Sub Location | `Code, Module, Country, Name, Priority` |
| `@CURRENCY` | SBOQTEC | Currency | `Code, Name, U_ExRate` |
| `@FREIGHT` | SBOQTEC | Freight/Courier Rate | `Code, Name, U_Rate` |
| `@OSLP` | PART_CATALOG_AIX | Call By / Sourced By | `SlpCode, SlpName, Active` |
| `@UOM` | SBOQTEC | Purchase/Sales UOM | `Code, Name` |

---

## 8. Stored Procedures

| SP | DB | ใช้โดย | Input หลัก | Output หลัก |
|---|---|---|---|---|
| `SPIT_SearchItemByDescriptionFTS` | PART_CATALOG_AIX | Search FTS | `@pKeyword, @pBrand` | Item list |
| `SPIT_SearchItemByDescriptionFTS_GetBrand` | PART_CATALOG_AIX | Search FTS brand filter | `@pKeyword` | Brand list |
| `SPIT_SearchItemByDescriptionFTS_GetCL` | PART_CATALOG_AIX | Search autocomplete | `@pKeyword` | Suggestions |
| `SPIT_GetItemDetailByItemID` | PART_CATALOG_AIX | Item page read, New Term context | `@ItemID` | Item detail |
| **`SPIT_GenCatalogNo`** | PART_CATALOG_AIX | Item create | `@ItemID` | **ItemCode (generated)** |
| `SPIT_CheckDuplicatedByCatalogNo` | PART_CATALOG_AIX | Item duplicate check | `@CatalogNo, @Brand, @ItemID` | bool |
| `SPIT_GetInvntryUomByItemID` | PART_CATALOG_AIX | Term page helper | `@ItemID` | Stock UOM |
| `SPIT_GetCWeightByVendorStockItemNo` | PART_CATALOG_AIX | Term page CWeight lookup | `@VendorStockItemNo` | CWeight |
| `SPIT_GetVendorEmailByTermID` | PART_CATALOG_AIX | Term → Send RFQ | `@TermID` | Email/contact |
| `SPIT_CreateAttachFile` | PART_CATALOG_AIX | Item/Term attachment upload | attachment metadata + path | attachment ID |
| `SPIT_DeleteAttachFile` | PART_CATALOG_AIX | Item/Term attachment delete | `@AttachmentID` | — |
| `SPIT_GetCardNameByCardCode` | PART_CATALOG_AIX | (รองรับแต่ยังไม่มี call path ใน production) | `@CardCode` | CardName |

---

## 9. File Storage Paths

| ประเภท | Path | Pattern |
|---|---|---|
| Item Image | `\\192.168.2.53\AttachmentItemImage` | `IIMG{ItemID}.{ext}` |
| Item/Term Attachment | `\\192.168.2.53\Attachment` | metadata ใน `@tblAttachment` |

> ⚠️ Service account ของ API ต้องมี permission เขียน/อ่าน UNC shares เหล่านี้

---

## 10. Search & Report Objects

### 10.1 Item List / Search

- View: `VWIT_@POITM` (SBOQTEC)
- SP (FTS): `SPIT_SearchItemByDescriptionFTS` — ค้นจาก `[@FULLTEXT]`
  app-facing synonym. It is not a view in `PART_CATALOG_AIX`.

### 10.2 Term List (nested)

- View: `vw@PITM1` (PART_CATALOG_AIX)

### 10.3 Brand ↔ Vendor Reports

| Report | App-facing Object | Source Object |
|---|---|---|
| Brand → Vendor | `@PITM1_BRAND_VENDOR` synonym | `VWIT_@PITM1_BRAND_VENDOR_PCAT` |
| Vendor → Brand | `@PITM1_VENDOR_BRAND` synonym | `VWIT_@PITM1_VENDOR_BRAND_PCAT` |

### 10.4 Category → Brand

- View: `VWIT_@POITM_CATEGORY_BRAND` (SBOQTEC)

---

## 11. Data Synchronization Jobs (SQL Server Agent)

### Job 1: Sync POITM (Full-Text Search Cache)

**Name**: `Sync POITM PARTCATALOG_SQL SBOQTEC`  
**Schedule**: ทุกวัน 2 รอบ — 00:15 น. และ 12:15 น.  
**Actual job target**: `[PART_CATALOGSQL].[dbo].[@FULLTEXT]`  
**App-side access**: `PART_CATALOG_AIX` exposes `[@FULLTEXT]` as a synonym, not a view.

- **Step 1**: INSERT new items (ยังไม่มีใน @FULLTEXT)  
  - ลบ non-alpha characters ด้วย `RemoveNonAlphaCharacters()`  
  - concat Brand + CatalogNo + ItemDescription + LongDesc1-4 + SupplierName  
- **Step 2**: UPDATE changed items (UpdatedDate ใหม่กว่า @FULLTEXT)

### Job 2: Brand-Vendor Cache

**Name**: `PartCat_Collect_Brand_Vendor`  
**Schedule**: ทุกวัน 1 รอบ — 05:15 น.

- **Step 1**: Refresh underlying Brand → Vendor target exposed to the app as
  `@PITM1_BRAND_VENDOR` synonym from `VWIT_@PITM1_BRAND_VENDOR_PCAT`
- **Step 2**: Refresh underlying Vendor → Brand target exposed to the app as
  `@PITM1_VENDOR_BRAND` synonym from `VWIT_@PITM1_VENDOR_BRAND_PCAT`
- ⚠️ มี e-PRO section ถูก comment ไว้ — ถ้าต้องการ sync จาก e-PRO ต้องเปิด comment นั้น

### Deployment Note

These SQL Server Agent jobs are already synced in production with target database
`PART_CATALOGSQL`. This is acceptable because `PART_CATALOG_AIX` now provides
synonyms over the synced objects for the web app. Do not treat the job target as
a production blocker unless the underlying synonym contract changes.

---

## 12. Differences vs Legacy Business Docs

| ประเด็น | Legacy Docs | Current Web Code (ยึดอันนี้) |
|---|---|---|
| FRZONE ของ Air Courier | `SW_CAL × zoneRate` | `MAX(DimWeight, itemWeight) × zoneRate` |
| QLC3 | ต้นทุนต่อหน่วยขาย | total price = `qlc3Base + sspk + qoc` |
| `U_TotalPrice` | อาจเป็น output หลัก | compatibility alias ของ `U_QLC3` เท่านั้น |
| CWeight | ใช้ใน formula | persist แต่ยังไม่ใช้ใน engine |
| CC default | reference per shipment type (800/8000/14000...) | manual input ไม่มี auto-rule |
| Courier vs Forwarder threshold | 150 kg | user เลือก shipModeNo เอง |

---

## 13. Key Rules ต้องจำ

1. `FR` ≠ `U_FreightQTEC` — FR = user input; FreightQTEC = calculated from weight
2. `U_OP_SUM` ≠ `U_OP_THB` — SUM = base; THB = after surcharge branch
3. `U_QLC3` = persisted total price; `U_TotalPrice` = alias only
4. `qlc3Base` = intermediate; ไม่มีใน DB
5. `ItemCode` generate หลัง insert ผ่าน SP — ไม่รู้ก่อน save
6. Term: backend เป็น calculation source of truth เสมอ
7. `shelfLifeRequired` → ส่งเป็น `U_Punchout` (Y/N) — ✅ ทำงานจริงทั้ง create และ update (ไม่ใช่ `U_ShelfLife`)

---

_Last updated: 2026-05-14 | Source: AI/5, AI/6, AI/8 (distilled before folder deletion) + current code audit_
