import { ArrowLeft, Edit, LogOut, Plus, Save, Trash2, X } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Badge, Button } from '../../common/atoms';

interface ItemFormHeaderProps {
  isNew: boolean;
  isView: boolean;
  isEdit: boolean;
  readOnlyMode: boolean;
  isPrinting: boolean;
  isDeletingItem: boolean;
  canDeleteItemRecord: boolean;
  disableSave: boolean;
  currentCatalogNo: string;
  termCount: number | null;
  itemId?: number;
  onExit: () => void;
  onCancel: () => void;
  onChangeMode: (mode: 'NEW' | 'VIEW' | 'EDIT') => void;
  onCreateTerm?: (itemId: number) => void;
  onPrint: () => void;
  onDeleteItem: () => void;
  onSaveClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
}

export function ItemFormHeader({
  isNew,
  isView,
  isEdit,
  readOnlyMode,
  isPrinting,
  isDeletingItem,
  canDeleteItemRecord,
  disableSave,
  currentCatalogNo,
  termCount,
  itemId: rawItemId,
  onExit,
  onCancel,
  onChangeMode,
  onCreateTerm,
  onPrint,
  onDeleteItem,
  onSaveClick,
}: ItemFormHeaderProps) {
  return (
    <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="shrink-0 whitespace-nowrap text-gray-600 hover:text-gray-900 print:hidden"
          >
            <ArrowLeft className="w-5 h-5 mr-1" /> Back to Search
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold leading-tight text-gray-800 whitespace-nowrap">
                {isNew ? 'ADD NEW ITEM' : `ITEM - ${currentCatalogNo || '-'}`}
              </h1>
              {!isNew && (
                <>
                  <Badge>{currentCatalogNo || '-'}</Badge>
                  {termCount !== null && <Badge className="bg-[#5AA02A]">{`Terms: ${termCount}`}</Badge>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end print:hidden">
          {isView && (
            <>

              <Button
                variant="danger"
                className="whitespace-nowrap"
                onClick={() => { void onDeleteItem(); }}
                disabled={readOnlyMode || isDeletingItem || !canDeleteItemRecord}
                title={
                  readOnlyMode
                    ? 'Read-only phase'
                    : !canDeleteItemRecord
                      ? 'Only owner, supervisor, or manager can delete this item'
                      : 'Delete item'
                }
              >
                <Trash2 className="w-4 h-4" /> {isDeletingItem ? 'DELETING...' : 'DELETE'}
              </Button>
              <Button
                variant="primary"
                className="whitespace-nowrap"
                onClick={() => {
                  const itemId = Number(rawItemId || 0);
                  if (Number.isFinite(itemId) && itemId > 0) {
                    onCreateTerm?.(itemId);
                  }
                }}
                disabled={readOnlyMode || !rawItemId || !onCreateTerm}
                title={readOnlyMode ? 'Read-only phase' : 'Add term'}
              >
                <Plus className="w-4 h-4" /> ADD TERM
              </Button>
              {!readOnlyMode && (
                <Button
                  variant="warning"
                  className="whitespace-nowrap"
                  onClick={() => onChangeMode('EDIT')}
                >
                  <Edit className="w-4 h-4" /> EDIT
                </Button>
              )}
            </>
          )}

          {(isNew || isEdit) && (
            <Button
              variant="success"
              className="whitespace-nowrap"
              onClick={onSaveClick}
              disabled={disableSave}
            >
              <Save className="w-4 h-4" /> SAVE
            </Button>
          )}

          {isEdit && (
            <Button variant="neutral" className="whitespace-nowrap" onClick={onCancel}>
              <X className="w-4 h-4" /> CANCEL
            </Button>
          )}

          <Button variant="neutral" className="whitespace-nowrap" onClick={onExit}>
            <LogOut className="w-4 h-4" /> EXIT
          </Button>
        </div>
      </div>
    </div>
  );
}
