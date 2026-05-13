import { describe, expect, it } from 'vitest';
import { mapFormToApiBody } from '@/services/item.api';
import type { ItemData } from '@/types/item_types';

function makeItemData(overrides: Partial<ItemData> = {}): ItemData {
  return {
    itemGroup: '104',
    itemCategory: '_Null',
    catalogNo: '',
    b1ItemNo: '',
    mfrBrand: 'PROTO',
    mfrCatalogNo: 'PN-001',
    itemDescription: 'Test item',
    specialRequirement: '',
    customerStockCode: '',
    stockUOM: 'EA',
    countryOfOrigin: '_Null',
    eccn: '',
    unspsc: '',
    eProcurementCode: '',
    remark: '',
    active: true,
    masterFG: false,
    shelfLifeRequired: false,
    punchOut: false,
    vmi: false,
    customerBPA: false,
    isQTECStock: false,
    serialRequired: false,
    sdsRequired: false,
    certificateRequired: false,
    eCommerce: false,
    b1Item: false,
    dgRequired: false,
    permitRequired: false,
    permitType: '',
    hsCode: '',
    longDesc1: '',
    longDesc2: '',
    longDesc3: '',
    longDesc4: '',
    generalSpec: '',
    referenceUrl: '',
    updatedBy: '',
    updatedDate: '',
    hasImage: false,
    ...overrides,
  };
}

describe('mapFormToApiBody', () => {
  it('sends blank B1 Item No as null for new PartCatalog items', () => {
    const payload = mapFormToApiBody(makeItemData({ b1ItemNo: '' }));

    expect(payload.B1ItemNo).toBeNull();
  });

  it('trims nonblank B1 Item No before sending it to the API', () => {
    const payload = mapFormToApiBody(makeItemData({ b1ItemNo: '  B1-123  ' }));

    expect(payload.B1ItemNo).toBe('B1-123');
  });
});
