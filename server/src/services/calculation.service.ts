// ─────────────────────────────────────────────────────────────────────────────
// Input Model
// ─────────────────────────────────────────────────────────────────────────────
//
// ไฟล์นี้เป็น "แกนกลางการคำนวณ" ของ Term ทั้งหมด
// โดยรับค่าจาก API (ผ่าน controller) แล้วคำนวณทีละขั้นจนได้ผลลัพธ์ครบทุกฟิลด์
//
// หมายเหตุ:
// - หน่วย/ความหมายของแต่ละ field อ้างอิงตามหน้าจอ Term
// - ทุกผลลัพธ์สุดท้ายจะถูกปัดเป็นทศนิยม 6 ตำแหน่งก่อนส่งออก
//
export interface CalcInput {
    // ─── Order Price (OP) ───────────────────────────────────────────────────
    productCost: number;            // Product Cost (PCS)
    pkh: number;                    // Packing Handling (PKH)
    soc: number;                    // Supplier Outbound Cost (SOC)
    exchangeRate: number;           // Exchange Rate

    // ─── Freight to QTEC (FR) ───────────────────────────────────────────────
    orderTerm: string;              // Exwork/FCA/FAS/FOB/CIF/CFR/DDP
    shipModeNo: number;             // 1=Air FWD, 2=Sea, 3=Truck, 4=QTEC-MC, 5=QTEC-Truck, 6=Air COUR
    dimUnit: number;                // 1=CM, 2=INCH
    length: number;                 // Length
    width: number;                  // Width
    height: number;                 // Height
    itemWeight: number;             // Item Weight (KG)
    freightRate: number;            // Freight/Courier rate

    // ─── CIF / Duty / Tax ───────────────────────────────────────────────────
    freight: number;                // Freight (FR) ที่กรอกเองจากหน้าจอ
    insPercent: number;             // Insurance %
    zoneRate: number;               // Zone Rate (THB/KG)
    dtPercent: number;              // Duty %
    miscTax: number;                // Misc Tax (ETC)
    etPercent: number;              // Excise Tax %

    // ─── QLC ────────────────────────────────────────────────────────────────
    wtt: number;                    // Wire T/T
    cc: number;                     // Custom Clear
    scc: number;                    // Special Custom Clear
    stkPercent: number;             // Stock Fee %

    // ─── UOM Conversion ─────────────────────────────────────────────────────
    numInBuy: number;               // Stock Conversion
    numInSale: number;              // Sales Conversion

    // ─── Sales Calculation ──────────────────────────────────────────────────
    markupPercent: number;          // Markup %
    sspk: number;                   // SPK
    qoc: number;                    // QOC
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Model
// ─────────────────────────────────────────────────────────────────────────────
export interface CalcResult {
    // ─── Order Price (OP) ───────────────────────────────────────────────────
    U_OP: number;                   // OP1 (PCS)
    U_OP_SUM: number;               // OP1 (THB) ก่อนเงื่อนไข surcharge
    U_OP_THB: number;               // OP1 (THB) หลังเงื่อนไข surcharge

    // ─── Freight / CIF / Tax ────────────────────────────────────────────────
    U_DimWeight: number;            // Dimensional Weight
    U_ShipWeightCal: number;        // Shipping Weight (หลัง CEILING)
    U_INS: number;                  // Insurance
    U_FRZONE: number;               // Zone Freight
    U_FreightQTEC: number;          // Freight to QTEC WH
    U_CIF: number;                  // CIF ปกติ
    U_CIFZONE: number;              // CIF จาก Zone (กรณีพิเศษ)
    U_ZoneRate: number;
    U_DT: number;                   // Import Duty (เลือกค่าสูงสุด)
    U_DT_FR: number;
    U_DT_FRZONE: number;
    U_ET: number;                   // Excise Tax
    U_MT: number;                   // Municipal Tax

    // ─── QLC / Sales ────────────────────────────────────────────────────────
    U_preQLC: number;
    U_STK: number;                  // Stock Fee Amount
    U_QLC: number;                  // QTEC Landed Cost
    U_QLC2: number;                 // QLC ต่อ Stock UOM
    U_QLC3: number;                 // Legacy persisted Total Price (SPK + QOC)
    U_TotalPrice: number;           // Compatibility alias ของ Total Price
    U_MK_THB: number;               // Markup เป็นเงินบาท
    U_SalesPrice: number;           // ราคาขายสุดท้าย
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calculation Pipeline
// ─────────────────────────────────────────────────────────────────────────────
export function calculate(input: CalcInput): CalcResult {
    const {
        productCost, pkh, soc, exchangeRate, orderTerm, shipModeNo,
        dimUnit, length, width, height, itemWeight, freightRate, freight,
        insPercent, zoneRate, dtPercent, etPercent, miscTax,
        wtt, cc, scc, stkPercent, sspk, qoc,
        markupPercent, numInBuy, numInSale,
    } = input;

    // ─── Order Price (OP) ───────────────────────────────────────────────────
    // OP = Product Cost + PKH + SOC
    const op = calcOP(productCost, pkh, soc);

    // ─── Order Price THB ────────────────────────────────────────────────────
    // OP_SUM = OP * ExRate (ค่า base)
    // OP_THB = OP * ExRate และอาจมี surcharge +3% ตามเงื่อนไข term/ship mode
    const opSum = calcOP_SUM(op, exchangeRate);
    const opTHB = calcOP_THB(op, exchangeRate, orderTerm, shipModeNo);

    // ─── Freight to QTEC (FR) ───────────────────────────────────────────────
    // DW = น้ำหนักปริมาตร
    // SW_CAL = CEILING(MAX(DW, ItemWeight), 0.5)
    // FreightQTEC = SW_CAL * FreightRate
    const dw = calcDW(length, width, height, shipModeNo, dimUnit);
    const swCal = calcSW_CAL(dw, itemWeight);
    const freightQtec = calcFQTEC(swCal, freightRate);

    // ─── CIF / Zone Freight ─────────────────────────────────────────────────
    // INS = OP_THB * INS%
    // FRZONE ใช้เฉพาะบาง orderTerm + shipMode
    // CIF / CIFZONE แยกตามเงื่อนไข Exwork/FCA + (Truck/Air COUR)
    const ins = calcINS(insPercent, opTHB);
    const frzone = calcFRZONE(opTHB, shipModeNo, orderTerm, zoneRate, dw, itemWeight);
    const cif = calcCIF(opTHB, ins, freight, shipModeNo, orderTerm);
    const cifzone = calcCIFZONE(opTHB, ins, frzone, shipModeNo, orderTerm);

    // ─── Import Duty (DT) ───────────────────────────────────────────────────
    // DT_FR = CIF * Duty%
    // DT_FRZONE = CIFZONE * Duty%
    // DT = MAX(DT_FR, DT_FRZONE)
    const dtFR = cif * (dtPercent / 100);
    const dtFRZONE = cifzone * (dtPercent / 100);
    const dt = calcDT(dtFR, dtFRZONE);

    // ─── Excise Tax (ET) + Municipal Tax (MT) ──────────────────────────────
    // ET ใช้สูตร reverse calculation
    // MT = ET * 10%
    const et = calcET(cif, cifzone, dt, miscTax, etPercent);
    const mt = calcMT(et);

    // ─── QTEC W/H Cost (QLC) ────────────────────────────────────────────────
    // preQLC = (OP * ExRate) + INS + FR + DT + ET + MT + MiscTax + WTT + CC + SCC
    // STK = STK% * preQLC
    // QLC = CEILING(preQLC + STK, 0.01)
    const fr = freight;
    const preQLC = (op * exchangeRate) + ins + fr + dt + et + mt + miscTax + wtt + cc + scc;
    const stk = (stkPercent / 100) * preQLC;
    const qlc = ceilTo(preQLC + stk, 0.01);

    // ─── Sales Calculation ──────────────────────────────────────────────────
    // QLC2 = QLC / numInBuy
    // qlc3Base = QLC2 * numInSale (intermediate only)
    // Total = qlc3Base + SPK + QOC
    // Legacy business rule: persist Total ลง U_QLC3
    // MK_THB = (Total/(1-Markup%)) - Total
    // SalesPrice = Total/(1-Markup%)
    const qlc2 = calcQLCPerStockUOM(qlc, numInBuy);
    const qlc3Base = calcQLCPerSalesUOM(qlc2, numInSale);
    const totalPrice = calcTotalPrice(qlc3Base, sspk, qoc);
    const mkTHB = calcMarkupTHB(totalPrice, markupPercent);
    const salesPrice = calcSalesPrice(totalPrice, markupPercent);

    // ปัดผลลัพธ์ทุกค่าที่ส่งกลับเป็นทศนิยม 6 ตำแหน่ง
    return {
        U_OP: round6(op),
        U_OP_SUM: round6(opSum),
        U_OP_THB: round6(opTHB),
        U_DimWeight: round6(dw),
        U_ShipWeightCal: round6(swCal),
        U_INS: round6(ins),
        U_FRZONE: round6(frzone),
        U_FreightQTEC: round6(freightQtec),
        U_CIF: round6(cif),
        U_CIFZONE: round6(cifzone),
        U_ZoneRate: round6(zoneRate),
        U_DT: round6(dt),
        U_DT_FR: round6(dtFR),
        U_DT_FRZONE: round6(dtFRZONE),
        U_ET: round6(et),
        U_MT: round6(mt),
        U_preQLC: round6(preQLC),
        U_STK: round6(stk),
        U_QLC: round6(qlc),
        U_QLC2: round6(qlc2),
        U_QLC3: round6(totalPrice),
        U_TotalPrice: round6(totalPrice),
        U_MK_THB: round6(mkTHB),
        U_SalesPrice: round6(salesPrice),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Formula Functions
// ─────────────────────────────────────────────────────────────────────────────

// ─── 4.2.1 Order Price (OP) ────────────────────────────────────────────────
// สูตร: OP = ProductCost + PKH + SOC
function calcOP(productCost: number, pkh: number, soc: number): number {
    return productCost + pkh + soc;
}

// ─── 4.2.2 OP_SUM (THB Base) ───────────────────────────────────────────────
// สูตร: OP_SUM = OP * ExRate
function calcOP_SUM(op: number, exRate: number): number {
    return op * exRate;
}

// ─── 4.2.2 OP_THB (THB Final) ──────────────────────────────────────────────
// สูตรพื้นฐาน: OP_THB = OP * ExRate
// เงื่อนไขพิเศษ +3%:
// - orderTerm อยู่ใน [Exwork, FCA, FAS, FOB]
// - และ shipMode เป็น 3 หรือ 6
function calcOP_THB(
    op: number, exRate: number, orderTerm: string, shipMode: number
): number {
    const isFOBType = ['Exwork', 'FCA', 'FAS', 'FOB'].includes(orderTerm);
    if (isFOBType && (shipMode === 3 || shipMode === 6)) {
        return op * exRate * 1.03;
    }
    return op * exRate;
}

// ─── 4.2.3 Dimension Weight (DW) ───────────────────────────────────────────
// 1) vol = L * W * H
// 2) ถ้าเป็น INCH (dimUnit=2) ใช้ vol * 17 (legacy approximation)
// 3) แยกสูตรตาม shipMode:
//    - 1,4,5 => /6000
//    - 2     => /1000 และขั้นต่ำ 1000
//    - 3,6   => /5000
//    - default => /6000
function calcDW(
    l: number, w: number, h: number, shipMode: number, dimUnit: number
): number {
    if (shipMode < 1) return 0;

    const vol = l * w * h;
    if (vol === 0) return 0;

    const adjustedVol = dimUnit === 2 ? vol * 17 : vol;

    let dw: number;
    switch (shipMode) {
        case 1:
        case 4:
        case 5:
            dw = adjustedVol / 6000;
            break;
        case 2:
            dw = adjustedVol / 1000;
            if (dw < 1000) dw = 1000;
            break;
        case 3:
        case 6:
            dw = adjustedVol / 5000;
            break;
        default:
            dw = adjustedVol / 6000;
    }
    return dw;
}

// ─── 4.2.4 Shipping Weight ─────────────────────────────────────────────────
// สูตร: SW_CAL = CEILING(MAX(DW, ItemWeight), 0.5)
function calcSW_CAL(dw: number, iw: number): number {
    const maxWeight = Math.max(dw, iw);
    return ceilTo(maxWeight, 0.5);
}

// ─── 4.2.5 Insurance ───────────────────────────────────────────────────────
// สูตร: INS = OP_THB * (INS% / 100)
function calcINS(insPercent: number, opTHB: number): number {
    return opTHB * (insPercent / 100);
}

// ─── 4.2.7 CIF ─────────────────────────────────────────────────────────────
// สูตรปกติ: CIF = OP_THB + INS + FR
// ยกเว้น: ถ้า orderTerm = Exwork/FCA และ shipMode = 3 => CIF = 0
function calcCIF(
    opTHB: number, ins: number, fr: number, shipMode: number, orderTerm: string
): number {
    if (orderTerm === 'Exwork' || orderTerm === 'FCA') {
        if (shipMode === 3) return 0;
    }
    return opTHB + ins + fr;
}

// ─── 4.2.7.1 CIFZONE ───────────────────────────────────────────────────────
// คำนวณเฉพาะกรณี Exwork/FCA + shipMode 3/6 เท่านั้น
// สูตร: CIFZONE = OP_THB + INS + FRZONE
function calcCIFZONE(
    opTHB: number, ins: number, frzone: number, shipMode: number, orderTerm: string
): number {
    if (orderTerm === 'Exwork' || orderTerm === 'FCA') {
        if (shipMode === 3 || shipMode === 6) {
            return opTHB + ins + frzone;
        }
    }
    return 0;
}

// ─── 4.2.7.2 Zone Freight (FRZONE) ─────────────────────────────────────────
// คิดเฉพาะ Exwork/FCA:
// - shipMode 3 => FRZONE = 10% ของ OP_THB
// - shipMode 6 => FRZONE = MAX(DW, ItemWeight) * ZoneRate
// - อื่นๆ => 0
function calcFRZONE(
    opTHB: number, shipMode: number, orderTerm: string,
    zoneRate: number, dw: number, iw: number
): number {
    if (orderTerm === 'Exwork' || orderTerm === 'FCA') {
        if (shipMode === 3) {
            return 0.1 * opTHB;
        }
        if (shipMode === 6) {
            return Math.max(dw, iw) * zoneRate;
        }
    }
    return 0;
}

// ─── 4.2.8 Freight to QTEC ────────────────────────────────────────────────
// สูตร: FreightQTEC = SW_CAL * FreightRate
function calcFQTEC(swCal: number, freightRate: number): number {
    return swCal * freightRate;
}

// ─── 4.2.9 Import Duty ─────────────────────────────────────────────────────
// สูตร: DT = MAX(DT_FR, DT_FRZONE)
function calcDT(dtfr: number, dtfrzone: number): number {
    return Math.max(dtfr, dtfrzone);
}

// ─── 4.2.10 Excise Tax (Reverse Formula) ───────────────────────────────────
// ถ้า ET% = 0 => ET = 0
// denominator = 1 - (1.1 * ET% / 100)
// ถ้า denominator <= 0 => ET = 0 (กันหารศูนย์หรือค่าติดลบ)
// สูตร: ET = (MAX(CIF, CIFZONE) + DT + ETC) * (ET%/100) / denominator
function calcET(
    cif: number, cifzone: number, dt: number, etc: number, etPercent: number
): number {
    if (etPercent === 0) return 0;
    const cifMax = Math.max(cif, cifzone);
    const denominator = 1 - (1.1 * etPercent / 100);
    if (denominator <= 0) return 0;
    return (cifMax + dt + etc) * (etPercent / 100) / denominator;
}

// ─── 4.2.11 Municipal Tax ──────────────────────────────────────────────────
// สูตร: MT = ET * 10%
function calcMT(et: number): number {
    return et * 0.10;
}

// ─── 4.2.15.1 QLC ต่อ Stock UOM ───────────────────────────────────────────
// สูตร: QLC2 = QLC / numInBuy
// ถ้า numInBuy ไม่ใช่เลข หรือ <= 0 => คืน 0
function calcQLCPerStockUOM(qlc: number, numInBuy: number): number {
    if (!Number.isFinite(numInBuy) || numInBuy <= 0) return 0;
    return qlc / numInBuy;
}

// ─── 4.2.15.2 QLC ต่อ Sales UOM ───────────────────────────────────────────
// สูตร: qlc3Base = QLC2 * numInSale
// ถ้า numInSale ไม่ใช่เลข หรือ <= 0 => คืน 0
function calcQLCPerSalesUOM(qlcPerStockUOM: number, numInSale: number): number {
    if (!Number.isFinite(numInSale) || numInSale <= 0) return 0;
    return qlcPerStockUOM * numInSale;
}

// ─── 4.2.15.3 Total Price ──────────────────────────────────────────────────
// สูตร: TotalPrice = qlc3Base + SPK + QOC
function calcTotalPrice(qlc3Base: number, spk: number, qoc: number): number {
    return qlc3Base + spk + qoc;
}

// ─── 4.2.15.4 Markup THB ───────────────────────────────────────────────────
// denominator = 1 - (Markup% / 100)
// ถ้า denominator <= 0 => คืน 0
// สูตร: MK_THB = (TotalPrice / denominator) - TotalPrice
function calcMarkupTHB(totalPrice: number, markupPercent: number): number {
    const denominator = 1 - (markupPercent / 100);
    if (denominator <= 0) return 0;
    return (totalPrice / denominator) - totalPrice;
}

// ─── 4.2.15.5 Sales Price ──────────────────────────────────────────────────
// denominator = 1 - (Markup% / 100)
// ถ้า denominator <= 0 => คืน 0
// สูตร: SalesPrice = TotalPrice / denominator
function calcSalesPrice(totalPrice: number, markupPercent: number): number {
    const denominator = 1 - (markupPercent / 100);
    if (denominator <= 0) return 0;
    return totalPrice / denominator;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

// ปัดขึ้นตาม step (เหมือน Excel CEILING)
function ceilTo(value: number, step: number): number {
    if (step === 0) return value;
    return Math.ceil(value / step) * step;
}

// ปัดเป็นทศนิยม 6 ตำแหน่ง (ให้ตรงกับ numeric(19,6) ฝั่งฐานข้อมูล)
function round6(value: number): number {
    return Math.round(value * 1000000) / 1000000;
}
