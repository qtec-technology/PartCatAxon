import type { Item } from '#src/types/item.types.js';
import type { AutoCompleteItem, FTSResult } from '#src/types/search.types.js';

export type SearchFTSResponseDTO = FTSResult[];
export type SearchFTSBrandsResponseDTO = string[];
export type SearchFTSAutocompleteResponseDTO = AutoCompleteItem[];
export type SearchStandardResponseDTO = Item[];

export interface SearchPartNoSuggestionDTO {
    U_Brand: string;
    U_Calalogno: string;
}

export type SearchPartNoResponseDTO = SearchPartNoSuggestionDTO[];
