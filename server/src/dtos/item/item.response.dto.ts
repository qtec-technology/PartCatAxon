import type { Item } from '#src/types/item.types.js';

export type ItemListResponseDTO = Item[];
export type ItemByIdResponseDTO = Item;

export interface ItemCreateResponseDTO {
    ItemID: number;
    ItemCode: string;
}

export interface ItemDuplicateCheckResponseDTO {
    isDuplicated: boolean;
}

export interface ItemUOMResponseDTO {
    uom: string | null;
}

export interface ItemTermCountResponseDTO {
    count: number;
}
