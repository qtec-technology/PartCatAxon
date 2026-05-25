import type { RefObject } from 'react';
import { Controller, type Control, type UseFormRegister } from 'react-hook-form';
import { InlineSelect } from '../../../common/InlineSelect';
import { Input, SectionHeader, TextArea, cn } from '../../common/atoms';
import type { LookupOption } from '../../../../services/lookup.api';
import type { ItemData } from '../../../../types/item_types';
import type { ItemFormElementIds } from '../item.utils';

interface ItemLeftColumnProps {
  control: Control<ItemData>;
  register: UseFormRegister<ItemData>;
  isNew: boolean;
  isReadOnly: boolean;
  initialData?: ItemData;
  itemGroups: LookupOption[];
  itemCategories: LookupOption[];
  uoms: LookupOption[];
  countries: LookupOption[];
  itemIds: ItemFormElementIds;
  brandRef: RefObject<HTMLDivElement | null>;
  brandInput: string;
  showBrandDropdown: boolean;
  filteredBrands: LookupOption[];
  setBrandInput: (value: string) => void;
  setShowBrandDropdown: (value: boolean) => void;
}

export function ItemLeftColumn({
  control,
  register,
  isNew,
  isReadOnly,
  initialData,
  itemGroups,
  itemCategories,
  uoms,
  countries,
  itemIds,
  brandRef,
  brandInput,
  showBrandDropdown,
  filteredBrands,
  setBrandInput,
  setShowBrandDropdown,
}: ItemLeftColumnProps) {
  return (
    <div className="flex flex-col min-w-0">
      <SectionHeader title="Item Information" />
      <div className="flex-1 p-4 border border-gray-200 border-t-0 rounded-b-md bg-white">

        <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <div className="mb-3 w-full">
            <label htmlFor="itemGroup" className="block text-xs font-bold text-gray-700 mb-1">
              Item Group
              <span className="text-[#C12B2B] ml-1">*</span>
            </label>
            <Controller
              name="itemGroup"
              control={control}
              rules={{ required: 'Item Group is required' }}
              render={({ field }) => (
                <InlineSelect
                  id="itemGroup"
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={isReadOnly}
                  placeholder="Please select"
                  allowClear
                  className="w-full !h-[30px] !px-2 !py-1 border-gray-300 bg-white text-sm disabled:opacity-100 disabled:bg-[#F5F5F5] disabled:text-gray-500"
                  options={itemGroups.map((option) => ({
                    value: String(option.value || '').trim(),
                    label: String(option.label || '').trim(),
                  }))}
                />
              )}
            />
          </div>
          <Input
            label="Catalog No"
            fullWidth
            disabled
            value={isNew ? '(Auto-generated)' : (initialData?.catalogNo || 'PFG000001')}
            className="bg-gray-100 text-gray-500 italic"
          />
        </div>

        <Input
          label="B1 Item No"
          fullWidth
          disabled
          value={isNew ? '(Auto-generated)' : (initialData?.b1ItemNo || '')}
          className="bg-gray-100 text-gray-500 italic"
        />

        <div className="mb-3 w-full">
          <label htmlFor={itemIds.mfrBrand} className="block text-xs font-bold text-gray-700 mb-1">
            Mfr Brand
            <span className="text-[#C12B2B] ml-1">*</span>
          </label>
          <Controller
            name="mfrBrand"
            control={control}
            rules={{ required: 'Mfr Brand is required' }}
            render={({ field, fieldState: { error } }) => (
              <div className="relative" ref={brandRef}>
                <input
                  id={itemIds.mfrBrand}
                  name="mfrBrand"
                  type="text"
                  className={cn(
                    "w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0]",
                    isReadOnly && "bg-[#F5F5F5] text-gray-500",
                    error && "border-[#C12B2B]"
                  )}
                  placeholder="Select or type brand..."
                  value={brandInput}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    setBrandInput(e.target.value);
                    setShowBrandDropdown(true);
                    if (!e.target.value) field.onChange('');
                  }}
                  onFocus={() => {
                    if (!isReadOnly) setShowBrandDropdown(true);
                  }}
                />

                {showBrandDropdown && !isReadOnly && (
                  <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto bg-white border border-[#A0C0E0] rounded-md shadow-lg">
                    {filteredBrands.map((b) => (
                      <div
                        key={b.value}
                        className={cn(
                          "px-2 py-1.5 text-xs cursor-pointer hover:bg-[#E8F0F8]",
                          field.value === b.value && "bg-[#D4E7F7] font-semibold"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          field.onChange(b.value);
                          setBrandInput(b.label);
                          setShowBrandDropdown(false);
                        }}
                      >
                        {b.label}
                      </div>
                    ))}
                    {filteredBrands.length === 0 && (
                      <div className="px-2 py-2 text-xs text-gray-400 text-center">No brand found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          />
        </div>

        <Input
          label="Mfr Catalog No"
          required
          fullWidth
          maxLength={150}
          disabled={isReadOnly}
          {...register('mfrCatalogNo', { required: 'Catalog No is required', maxLength: { value: 150, message: 'Max 150 characters' } })}
        />

        <TextArea
          label="Item Description"
          required
          rows={3}
          maxLength={100}
          disabled={isReadOnly}
          {...register('itemDescription', { required: 'Description is required', maxLength: { value: 100, message: 'Max 100 characters' } })}
        />

        <div className="mb-3 w-full">
          <label htmlFor="itemCategory" className="block text-xs font-bold text-gray-700 mb-1">
            Item Category
          </label>
          <Controller
            name="itemCategory"
            control={control}
            render={({ field }) => (
              <InlineSelect
                id="itemCategory"
                value={field.value || ''}
                onValueChange={field.onChange}
                disabled={isReadOnly}
                placeholder="Please select"
                className="w-full h-9 border-gray-300 bg-white text-sm disabled:opacity-100 disabled:bg-[#F5F5F5] disabled:text-gray-500"
                options={itemCategories.map((option) => ({
                  value: String(option.value || '').trim(),
                  label: String(option.label || '').trim(),
                }))}
              />
            )}
          />
        </div>

        <Input
          label="Cust Stock Code"
          fullWidth
          maxLength={100}
          disabled={isReadOnly}
          {...register('customerStockCode')}
        />

        <div className="mb-3 w-full">
          <label htmlFor="stockUOM" className="block text-xs font-bold text-gray-700 mb-1">
            Stock UOM
            <span className="text-[#C12B2B] ml-1">*</span>
          </label>
          <Controller
            name="stockUOM"
            control={control}
            rules={{ required: 'UOM is required' }}
            render={({ field }) => (
              <InlineSelect
                id="stockUOM"
                value={field.value || ''}
                onValueChange={field.onChange}
                disabled={isReadOnly}
                placeholder="Please select"
                allowClear
                className="w-full h-9 border-gray-300 bg-white text-sm disabled:opacity-100 disabled:bg-[#F5F5F5] disabled:text-gray-500"
                options={uoms.map((option) => ({
                  value: String(option.value || '').trim(),
                  label: String(option.label || '').trim(),
                }))}
              />
            )}
          />
        </div>

        <div className="mb-3 w-full">
          <label htmlFor="countryOfOrigin" className="block text-xs font-bold text-gray-700 mb-1">
            Country of Origin
          </label>
          <Controller
            name="countryOfOrigin"
            control={control}
            render={({ field }) => (
              <InlineSelect
                id="countryOfOrigin"
                value={field.value || ''}
                onValueChange={field.onChange}
                disabled={isReadOnly}
                placeholder="Please Select"
                className="w-full h-9 border-gray-300 bg-white text-sm disabled:opacity-100 disabled:bg-[#F5F5F5] disabled:text-gray-500"
                options={countries.map((option) => ({
                  value: String(option.value || '').trim(),
                  label: String(option.label || '').trim(),
                }))}
              />
            )}
          />
        </div>

        <Input label="ECCN" fullWidth maxLength={50} disabled={isReadOnly} {...register('eccn')} />
        <Input label="UNSPSC" fullWidth maxLength={10} disabled={isReadOnly} {...register('unspsc')} />
        <Input label="e-Procurement Code" fullWidth maxLength={10} disabled={isReadOnly} {...register('eProcurementCode')} />

        <TextArea label="Special Requirement" rows={3} maxLength={254} disabled={isReadOnly} {...register('specialRequirement')} />

        <TextArea label="REMARK" rows={6} maxLength={254} disabled={isReadOnly} {...register('remark')} />
      </div>
    </div>
  );
}
