import { Request, Response, NextFunction } from 'express';
import * as lookupRepo from '#src/repositories/lookup.repository.js';
import {
    toBrandVendorQueryDTO,
    toCategoryBrandsQueryDTO,
    toContactsQueryDTO,
    toItemAttachmentsQueryDTO,
    toSubLocationsQueryDTO,
    toTermAttachmentsQueryDTO,
    toVendorBrandQueryDTO,
} from '#src/dtos/lookup/lookup.request.dto.js';
import type {
    ItemFormLookupsResponseDTO,
    TermFormLookupsResponseDTO,
} from '#src/dtos/lookup/lookup.response.dto.js';
import { success } from '#src/utils/response.js';

// ─── Lookup Controller ──────────────────────────────────────────────────────
// Each function returns dropdown data for ComboBoxes.

export async function getBrands(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getBrands())); } catch (err) { next(err); }
}

export async function getItemFormLookups(req: Request, res: Response, next: NextFunction) {
    try {
        const [brands, itemGroups, uoms, countries, permitTypes, itemCategories] = await Promise.all([
            lookupRepo.getBrands(),
            lookupRepo.getItemGroups(),
            lookupRepo.getUOMs(),
            lookupRepo.getCountries(),
            lookupRepo.getPermitTypes(),
            lookupRepo.getItemCategories(),
        ]);

        const payload: ItemFormLookupsResponseDTO = {
            brands,
            itemGroups,
            uoms,
            countries,
            permitTypes,
            itemCategories,
        };

        res.json(success(payload));
    } catch (err) { next(err); }
}

export async function getTermFormLookups(req: Request, res: Response, next: NextFunction) {
    try {
        const [vendors, orderTerms, locations, subLocations, currencies, freightTypes, salesPersons, uoms] = await Promise.all([
            lookupRepo.getVendors(),
            lookupRepo.getOrderTerms(),
            lookupRepo.getLocations(),
            lookupRepo.getSubLocations(),
            lookupRepo.getCurrencies(),
            lookupRepo.getFreightTypes(),
            lookupRepo.getSalesPersons(),
            lookupRepo.getUOMs(),
        ]);

        const payload: TermFormLookupsResponseDTO = {
            vendors,
            orderTerms,
            locations,
            subLocations,
            currencies,
            freightTypes,
            salesPersons,
            uoms,
        };

        res.json(success(payload));
    } catch (err) { next(err); }
}

export async function getTermCriticalLookups(req: Request, res: Response, next: NextFunction) {
    try {
        const [currencies, locations, freightTypes] = await Promise.all([
            lookupRepo.getCurrencies({ realtime: true }),
            lookupRepo.getLocations({ realtime: true }),
            lookupRepo.getFreightTypes({ realtime: true }),
        ]);

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        res.json(success({
            currencies,
            locations,
            freightTypes,
        }));
    } catch (err) { next(err); }
}

export async function getItemGroups(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getItemGroups())); } catch (err) { next(err); }
}

export async function getUOMs(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getUOMs())); } catch (err) { next(err); }
}

export async function getCurrencies(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getCurrencies())); } catch (err) { next(err); }
}

export async function getOrderTerms(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getOrderTerms())); } catch (err) { next(err); }
}

export async function getLocations(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getLocations())); } catch (err) { next(err); }
}

export async function getSubLocations(req: Request, res: Response, next: NextFunction) {
    try {
        const { module, country } = toSubLocationsQueryDTO(req.query);
        res.json(success(await lookupRepo.getSubLocations(module, country)));
    } catch (err) { next(err); }
}

export async function getPermitTypes(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getPermitTypes())); } catch (err) { next(err); }
}

export async function getVendors(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getVendors())); } catch (err) { next(err); }
}

export async function getVendorsForVendorBrandForm(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getVendorsForVendorBrandForm())); } catch (err) { next(err); }
}

export async function getContacts(req: Request, res: Response, next: NextFunction) {
    try {
        const { cardCode } = toContactsQueryDTO(req.query);
        res.json(success(await lookupRepo.getContacts(cardCode)));
    } catch (err) { next(err); }
}

export async function getFreightTypes(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getFreightTypes())); } catch (err) { next(err); }
}

export async function getSalesPersons(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getSalesPersons())); } catch (err) { next(err); }
}

export async function getCountries(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getCountries())); } catch (err) { next(err); }
}

export async function getBrandVendor(req: Request, res: Response, next: NextFunction) {
    try {
        const { brand } = toBrandVendorQueryDTO(req.query);
        res.json(success(await lookupRepo.getBrandVendor(brand)));
    } catch (err) { next(err); }
}

export async function getVendorBrand(req: Request, res: Response, next: NextFunction) {
    try {
        const { vendorCode, supplierName } = toVendorBrandQueryDTO(req.query);
        res.json(success(await lookupRepo.getVendorBrand(vendorCode, supplierName)));
    } catch (err) { next(err); }
}

export async function getItemCategories(req: Request, res: Response, next: NextFunction) {
    try { res.json(success(await lookupRepo.getItemCategories())); } catch (err) { next(err); }
}

export async function getCategoryBrands(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemCategory } = toCategoryBrandsQueryDTO(req.query);
        res.json(success(await lookupRepo.getCategoryBrands(itemCategory)));
    } catch (err) { next(err); }
}

export async function getItemAttachments(req: Request, res: Response, next: NextFunction) {
    try {
        const { itemId } = toItemAttachmentsQueryDTO(req.query);
        if (itemId === null) {
            res.json(success([]));
            return;
        }
        res.json(success(await lookupRepo.getItemAttachments(itemId)));
    } catch (err) { next(err); }
}

export async function getTermAttachments(req: Request, res: Response, next: NextFunction) {
    try {
        const { termId } = toTermAttachmentsQueryDTO(req.query);
        if (termId === null) {
            res.json(success([]));
            return;
        }
        res.json(success(await lookupRepo.getTermAttachments(termId)));
    } catch (err) { next(err); }
}
