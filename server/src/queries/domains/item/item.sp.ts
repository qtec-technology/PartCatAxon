import { dbObjects } from '#src/config/db-objects.js';

// Stored procedure names used by item repository.
export const SP_GET_ITEM_DETAIL_BY_ITEM_ID = dbObjects.procedures.getItemDetailByItemId;
export const SP_GENERATE_CATALOG_NO = dbObjects.procedures.generateCatalogNo;
export const SP_CHECK_DUPLICATED_BY_CATALOG_NO = dbObjects.procedures.checkDuplicatedByCatalogNo;
export const SP_GET_INVNTRY_UOM_BY_ITEM_ID = dbObjects.procedures.getInvntryUomByItemId;
