import { Router } from 'express';
import * as ctrl from '#src/controllers/lookup.controller.js';
import { validate } from '#src/middleware/validate.middleware.js';
import {
    brandVendorQuerySchema,
    categoryBrandsQuerySchema,
    contactsQuerySchema,
    itemAttachmentsQuerySchema,
    subLocationsQuerySchema,
    termAttachmentsQuerySchema,
    vendorBrandQuerySchema,
} from '#src/dtos/lookup/lookup.request.schema.js';

const router = Router();

router.get('/brands', ctrl.getBrands);
router.get('/item-form', ctrl.getItemFormLookups);
router.get('/term-form', ctrl.getTermFormLookups);
router.get('/term-critical', ctrl.getTermCriticalLookups);
router.get('/item-groups', ctrl.getItemGroups);
router.get('/uom', ctrl.getUOMs);
router.get('/currencies', ctrl.getCurrencies);
router.get('/order-terms', ctrl.getOrderTerms);
router.get('/locations', ctrl.getLocations);
router.get('/sub-locations', validate(subLocationsQuerySchema, 'query'), ctrl.getSubLocations);
router.get('/permit-types', ctrl.getPermitTypes);
router.get('/vendors', ctrl.getVendors);
router.get('/vendor-brand/vendors', ctrl.getVendorsForVendorBrandForm);
router.get('/contacts', validate(contactsQuerySchema, 'query'), ctrl.getContacts);
router.get('/freight-types', ctrl.getFreightTypes);
router.get('/sales-persons', ctrl.getSalesPersons);
router.get('/countries', ctrl.getCountries);
router.get('/brand-vendor', validate(brandVendorQuerySchema, 'query'), ctrl.getBrandVendor);
router.get('/vendor-brand', validate(vendorBrandQuerySchema, 'query'), ctrl.getVendorBrand);
router.get('/item-categories', ctrl.getItemCategories);
router.get('/category-brand', validate(categoryBrandsQuerySchema, 'query'), ctrl.getCategoryBrands);
router.get('/item-attachments', validate(itemAttachmentsQuerySchema, 'query'), ctrl.getItemAttachments);
router.get('/term-attachments', validate(termAttachmentsQuerySchema, 'query'), ctrl.getTermAttachments);

export default router;
