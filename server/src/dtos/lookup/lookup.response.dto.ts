import type {
    BrandOption,
    ContactOption,
    CountryOption,
    CurrencyOption,
    FreightOption,
    ItemCategoryOption,
    ItemGroupOption,
    LocationOption,
    OrderTermOption,
    PermitTypeOption,
    SalesPersonOption,
    SubLocationOption,
    UOMOption,
    VendorBrandFormVendorOption,
    VendorOption,
    AttachmentRecord,
} from '#src/types/lookup.types.js';

export type BrandsResponseDTO = BrandOption[];
export type ItemGroupsResponseDTO = ItemGroupOption[];
export type UOMsResponseDTO = UOMOption[];
export type CurrenciesResponseDTO = CurrencyOption[];
export type OrderTermsResponseDTO = OrderTermOption[];
export type LocationsResponseDTO = LocationOption[];
export type SubLocationsResponseDTO = SubLocationOption[];
export type PermitTypesResponseDTO = PermitTypeOption[];
export type VendorsResponseDTO = VendorOption[];
export type VendorsForVendorBrandFormResponseDTO = VendorBrandFormVendorOption[];
export type ContactsResponseDTO = ContactOption[];
export type FreightTypesResponseDTO = FreightOption[];
export type SalesPersonsResponseDTO = SalesPersonOption[];
export type CountriesResponseDTO = CountryOption[];
export type ItemCategoriesResponseDTO = ItemCategoryOption[];
export type ItemAttachmentsResponseDTO = AttachmentRecord[];
export type TermAttachmentsResponseDTO = AttachmentRecord[];

export interface ItemFormLookupsResponseDTO {
    brands: BrandOption[];
    itemGroups: ItemGroupOption[];
    uoms: UOMOption[];
    countries: CountryOption[];
    permitTypes: PermitTypeOption[];
    itemCategories: ItemCategoryOption[];
}

export interface TermFormLookupsResponseDTO {
    vendors: VendorOption[];
    orderTerms: OrderTermOption[];
    locations: LocationOption[];
    subLocations: SubLocationOption[];
    currencies: CurrencyOption[];
    freightTypes: FreightOption[];
    salesPersons: SalesPersonOption[];
    uoms: UOMOption[];
}
