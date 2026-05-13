import { ExternalLink } from 'lucide-react';
import { Controller, type Control, type FieldPath, type UseFormRegister } from 'react-hook-form';
import { InlineSelect } from '../../../common/InlineSelect';
import { Button, SectionHeader, cn } from '../../common/atoms';
import type { LookupOption } from '../../../../services/lookup.api';
import type { FormMode, ItemData } from '../../../../types/item_types';
import { formatDateTimeDisplay, type ItemFormElementIds } from '../item.utils';

interface ItemRightColumnProps {
  control: Control<ItemData>;
  register: UseFormRegister<ItemData>;
  isReadOnly: boolean;
  permitRequired: boolean;
  permitTypes: LookupOption[];
  itemIds: ItemFormElementIds;
  hasReferenceUrl: boolean;
  handleOpenReferenceUrl: () => void;
  mode: FormMode;
  updatedByValue: string;
  updatedDateValue: string;
}

function CheckboxRow({
  label,
  name,
  control,
  isReadOnly,
  isRed = false,
  isGray = false,
}: {
  label: string;
  name: FieldPath<ItemData>;
  control: Control<ItemData>;
  isReadOnly: boolean;
  isRed?: boolean;
  isGray?: boolean;
}) {
  const checkboxId = `item-${String(name)}`;
  return (
    <div className="flex justify-end items-center gap-2 h-7">
      <span className={cn(
        "text-xs text-right",
        isRed ? "text-[#C12B2B] font-bold uppercase" : "",
        isGray ? "text-gray-400 uppercase" : "text-gray-700"
      )}>{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field: { value, ...fieldProps } }) => (
          <input
            id={checkboxId}
            type="checkbox"
            {...fieldProps}
            checked={!!value}
            disabled={isReadOnly}
            aria-label={label}
            className={cn(
              "h-4 w-4 rounded border-gray-400",
              "accent-[#2264A0]"
            )}
          />
        )}
      />
    </div>
  );
}

export function ItemRightColumn({
  control,
  register,
  isReadOnly,
  permitRequired,
  permitTypes,
  itemIds,
  hasReferenceUrl,
  handleOpenReferenceUrl,
  mode,
  updatedByValue,
  updatedDateValue,
}: ItemRightColumnProps) {
  return (
    <div className="col-span-12 lg:col-span-3 space-y-4">
      <SectionHeader title="Status & Flags" />
      <div className="p-4 border border-gray-200 border-t-0 rounded-b-md bg-[#F5F5F5]">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-2 gap-y-1">
          <CheckboxRow label="ACTIVE" name="active" control={control} isReadOnly={isReadOnly} isRed />
          <CheckboxRow label="MASTER FG" name="masterFG" control={control} isReadOnly={isReadOnly} isGray />

          <CheckboxRow label="Shelf Life Required?" name="shelfLifeRequired" control={control} isReadOnly={isReadOnly} />
          <CheckboxRow label="SDS Required?" name="sdsRequired" control={control} isReadOnly={isReadOnly} />

          <CheckboxRow label="Is Supplier Agreement?" name="vmi" control={control} isReadOnly={isReadOnly} />
          <CheckboxRow label="Certificate Required?" name="certificateRequired" control={control} isReadOnly={isReadOnly} />

          <CheckboxRow label="Is Cusomter BPA?" name="customerBPA" control={control} isReadOnly={isReadOnly} />
          <CheckboxRow label="Is e-Commerce Item?" name="eCommerce" control={control} isReadOnly={isReadOnly} />

          <CheckboxRow label="Is QTEC Stock?" name="isQTECStock" control={control} isReadOnly={isReadOnly} />
          <CheckboxRow label="Is B1 Item Master?" name="b1Item" control={control} isReadOnly={isReadOnly} />

          <CheckboxRow label="Serial Required?" name="serialRequired" control={control} isReadOnly={isReadOnly} />
          <CheckboxRow label="Is DG Item?" name="dgRequired" control={control} isReadOnly={isReadOnly} />

          <div></div>
          <CheckboxRow label="Permit Required?" name="permitRequired" control={control} isReadOnly={isReadOnly} />
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-1 xl:gap-2">
            <label htmlFor={itemIds.permitType} className="text-xs text-gray-500 text-left xl:text-right w-full xl:w-1/3">Permit Type</label>
            <div className="w-full xl:w-2/3">
              <Controller
                name="permitType"
                control={control}
                render={({ field }) => (
                  <InlineSelect
                    id={itemIds.permitType}
                    name="permitType"
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    disabled={isReadOnly || !permitRequired}
                    placeholder="Please select"
                    allowClear
                    size="sm"
                    className={cn(
                      "w-full h-8 border-gray-300 rounded text-sm",
                      !(isReadOnly || !permitRequired) && "bg-white",
                      (isReadOnly || !permitRequired) && "disabled:opacity-100 disabled:bg-[#F5F5F5] disabled:text-gray-500"
                    )}
                    options={permitTypes.map((option) => ({
                      value: String(option.value || '').trim(),
                      label: String(option.label || '').trim(),
                    }))}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-1 xl:gap-2">
            <label htmlFor={itemIds.hsCode} className="text-xs text-gray-500 text-left xl:text-right w-full xl:w-1/3">Harmonized Code</label>
            <div className="w-full xl:w-2/3">
              <input
                id={itemIds.hsCode}
                className={cn("w-full border border-gray-300 rounded px-2 py-1 text-sm h-8", !isReadOnly && "bg-white")}
                maxLength={10}
                disabled={isReadOnly}
                {...register('hsCode')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={itemIds.generalSpec} className="block text-xs font-bold text-gray-700 mb-1">General Spec.</label>
        <textarea
          id={itemIds.generalSpec}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500 resize-none h-[150px]"
          maxLength={4000}
          disabled={isReadOnly}
          {...register('generalSpec')}
        />
      </div>

      <div className="mt-3">
        <label htmlFor={itemIds.referenceUrl} className="block text-xs font-bold text-gray-700 mb-1">Reference URL</label>
        <div className="flex gap-2 items-center">
          <input
            id={itemIds.referenceUrl}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#2264A0] focus:ring-1 focus:ring-[#2264A0] disabled:bg-[#F5F5F5] disabled:text-gray-500"
            maxLength={2000}
            disabled={isReadOnly}
            {...register('referenceUrl')}
          />
          <Button
            type="button"
            variant="neutral"
            size="sm"
            onClick={handleOpenReferenceUrl}
            disabled={!hasReferenceUrl}
          >
            <ExternalLink className="w-4 h-4" /> Open
          </Button>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-gray-500 whitespace-nowrap">
            {mode === 'NEW' ? 'Being updated by:' : 'Last updated by:'}
          </p>
          <div className="flex flex-col gap-2 w-full min-w-0">
            <input
              id={itemIds.updatedBy}
              name="updatedByDisplay"
              type="text"
              readOnly
              value={updatedByValue}
              aria-label={mode === 'NEW' ? 'Being updated by' : 'Last updated by'}
              title={updatedByValue}
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-[#F5F5F5] text-gray-600 w-full min-w-0"
            />
            <input
              id={itemIds.updatedDate}
              name="updatedDateDisplay"
              type="text"
              readOnly
              value={formatDateTimeDisplay(updatedDateValue)}
              aria-label={mode === 'NEW' ? 'Being updated date' : 'Last updated date'}
              className="border border-gray-300 rounded px-2 py-1 text-xs sm:text-sm bg-[#F5F5F5] text-gray-600 w-full min-w-0 tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
