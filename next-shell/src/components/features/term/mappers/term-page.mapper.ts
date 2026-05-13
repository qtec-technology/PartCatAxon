import type {
    TermAttachmentItem,
    TermContactOption,
    TermFormData,
    TermSalesPersonOption,
    TermSupplierOption,
} from '../../../../types/term_form.types';
import type { ContactLookupOption, SalesPersonLookupOption, VendorLookupOption } from '../../../../services/lookup.api';

const toNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value: unknown, fallback = ''): string => {
    if (value === null || value === undefined) return fallback;
    return String(value);
};

const toBoolean = (value: unknown, fallback = false): boolean => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === '') return fallback;
    if (['1', 'y', 'yes', 'true', 't'].includes(normalized)) return true;
    if (['0', 'n', 'no', 'false', 'f'].includes(normalized)) return false;
    return fallback;
};

export const uniqueStrings = (values: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
};

export function mapVendorsToSuppliers(vendors: VendorLookupOption[]): TermSupplierOption[] {
    const byCode = new Map<string, TermSupplierOption>();
    for (const row of vendors) {
        const code = String(row.cardCode || '').trim();
        const name = String(row.cardName || '').trim();
        if (!code || byCode.has(code)) continue;
        byCode.set(code, { code, name });
    }
    return Array.from(byCode.values()).sort((a, b) => {
        const left = a.name || a.code;
        const right = b.name || b.code;
        return left.localeCompare(right);
    });
}

export function mapContactsToOptions(rows: ContactLookupOption[]): TermContactOption[] {
    const byCode = new Map<string, TermContactOption>();
    for (const row of rows) {
        const code = String(row.cntctCode || '').trim();
        const name = String(row.name || '').trim();
        if (!code || !name || byCode.has(code)) continue;
        byCode.set(code, {
            code,
            name,
            active: String(row.active || '').trim(),
        });
    }
    return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function mapSalesPersonsToOptions(rows: SalesPersonLookupOption[]): TermSalesPersonOption[] {
    const byCode = new Map<string, TermSalesPersonOption>();
    for (const row of rows) {
        const code = String(row.slpCode || '').trim();
        const name = String(row.slpName || '').trim();
        if (!code || !name || byCode.has(code)) continue;
        byCode.set(code, {
            code,
            name,
            active: String(row.active || '').trim(),
        });
    }
    return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeSalesPersonCode(value: unknown): string {
    const code = toText(value);
    return code === '0' ? '' : code;
}

export function resolveSalesPersonNameFromLookup(
    code: unknown,
    currentName: unknown,
    salesPersons: TermSalesPersonOption[],
): string {
    const normalizedCode = normalizeSalesPersonCode(code);
    if (!normalizedCode) return '';

    const matched = salesPersons.find((row) => row.code === normalizedCode);
    if (matched?.name) return matched.name;

    return toText(currentName);
}

export function mapTermRecordToFormData(raw: Record<string, unknown>, prev: TermFormData): TermFormData {
    const salesPerson = normalizeSalesPersonCode(raw.SlpCode);
    const sourcedBy = normalizeSalesPersonCode(raw.SlpSprtCode);

    return {
        ...prev,
        supplier: toText(raw.VendorCode),
        supplierName: toText(raw.CardName),
        contactPerson: toText(raw.CntctCode),
        contactPersonName: toText(raw.CntctName),
        active: toBoolean(raw.Active, true),
        contractNo: toText(raw.ContractNo),
        mfgPartNo: toText(raw.U_CatalogNo ?? raw.U_CalalogNo),
        suppOrderCode: toText(raw.VendorStockItemNo),
        purchaseTerm: toText(raw.U_OrderTerm),
        purchaseTermLocation: toText(raw.U_TermLocation),
        purchaseTermLocationName: toText(raw.TermLocationName ?? raw.U_TermLocation),
        purchaseSubLocation: toText(raw.SubLocation),
        salesTerm: toText(raw.U_SalesTerm),
        salesSubLocation: toText(raw.SaleSubLocation),
        prodCost: toNumber(raw.U_ProdCost, 0),
        pkh: toNumber(raw.U_PKH, 0),
        soc: toNumber(raw.U_SOC, 0),
        currency: toText(raw.U_PurCurr),
        exRate: toNumber(raw.U_PurRate, 1),
        shipMode: toText(raw.U_ShipModeNo ?? prev.shipMode),
        dimUnit: toText(raw.U_DimUnitNo ?? prev.dimUnit),
        length: toNumber(raw.U_Length, 0),
        width: toNumber(raw.U_Width, 0),
        height: toNumber(raw.U_Height, 0),
        weight: toNumber(raw.U_Weight, 0),
        freightType: toText(raw.U_FreightType),
        freightRate: toNumber(raw.U_FreightRate, 0),
        fr: toNumber(raw.U_FR, 0),
        insPercent: toNumber(raw.INS_Percent, 0),
        dutyPercent: toNumber(raw.U_DT_Percent, 0),
        excisePercent: toNumber(raw.U_ETPer, 0),
        miscTax: toNumber(raw.U_MiscTax, 0),
        numInBuy: toNumber(raw.NumInBuy, 1),
        numInSale: toNumber(raw.NumInSale, 1),
        markup: toNumber(raw.U_MK_Percent, 0),
        stockFeePercent: toNumber(raw.U_STK_Percent, 0),
        wireTT: toNumber(raw.U_WTT, 0),
        customClear: toNumber(raw.U_CC, 0),
        scc: toNumber(raw.U_ASP, 0),
        zoneRate: toNumber(raw.U_ZoneRate, 0),
        cWeight: toNumber(raw.U_CWeight, 0),
        salesPerson,
        salesPersonName: salesPerson ? toText(raw.SlpName) : '',
        sourcedBy,
        sourcedByName: sourcedBy ? toText(raw.SlpSprtName) : '',
        remark: toText(raw.U_Remark),
        leadTime: toText(raw.LeadTime),
        moq: toText(raw.U_MOQ),
        vendorBPA: toBoolean(raw.U_VendorBPA, false),
        purchaseUOM: toText(raw.BuyUnitMsr),
        salesUOM: toText(raw.SalUnitMsr),
        spk: toNumber(raw.U_SPK, 0),
        qoc: toNumber(raw.U_QOC, 0),
        validFrom: toText(raw.U_ValidFrom),
        validTo: toText(raw.U_ValidTo),
        updatedBy: toText(raw.Updatedby),
        updatedDate: toText(raw.UpdatedDate),
    };
}

export function mapTermAttachments(rows: Array<Record<string, unknown>>): TermAttachmentItem[] {
    return rows
        .map((row) => ({
            id: toText(row.AttachmentID ?? row.id),
            category: toText(row.Category),
            fileName: toText(row.Attachement ?? row.FileName),
            updatedBy: toText(row.Updatedby),
            updatedDate: toText(row.UpdatedDate),
        }))
        .filter((row) => row.id !== '');
}
