import { Button, SectionHeader, cn } from '../../common/atoms';
import { isExactItemIdentityMatch, type SearchBeforeCreateState } from '../hooks';

interface SearchBeforeCreatePanelProps {
  currentBrand: string;
  currentMfrCatalogNo: string;
  searchBeforeCreate: SearchBeforeCreateState;
  hasIdentityInput: boolean;
  hasSearchReview: boolean;
  onRecheckExistingItems: () => void;
  onOpenExistingItem: (itemId: number) => void;
  onAcknowledgeNewItemCandidate: () => void;
}

const getSearchStatusLabel = (status: SearchBeforeCreateState['status']): string => (
  status === 'searching'
    ? 'Checking existing items...'
    : status === 'exact-match'
      ? 'Existing item available'
      : status === 'possible-match'
        ? 'Similar items found'
        : status === 'no-match'
          ? 'Ready for draft item'
          : status === 'error'
            ? 'Search unavailable'
            : 'Waiting for identity input'
);

const getSearchStatusClass = (status: SearchBeforeCreateState['status']): string => (
  status === 'exact-match'
    ? 'bg-blue-100 text-blue-700'
    : status === 'possible-match'
      ? 'bg-amber-100 text-amber-700'
      : status === 'no-match'
        ? 'bg-green-100 text-green-700'
        : status === 'error'
          ? 'bg-red-50 text-red-600'
          : status === 'searching'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-600'
);

export function SearchBeforeCreatePanel({
  currentBrand,
  currentMfrCatalogNo,
  searchBeforeCreate,
  hasIdentityInput,
  hasSearchReview,
  onRecheckExistingItems,
  onOpenExistingItem,
  onAcknowledgeNewItemCandidate,
}: SearchBeforeCreatePanelProps) {
  const searchStatusLabel = getSearchStatusLabel(searchBeforeCreate.status);
  const searchStatusClass = getSearchStatusClass(searchBeforeCreate.status);

  return (
    <div className="mb-6">
      <SectionHeader title="Search Before Create" />
      <div className="rounded-b-md border border-t-0 border-gray-200 bg-[#F8FBFF] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              Start with <span className="font-semibold">Mfr Brand</span> and <span className="font-semibold">Mfr Catalog No</span>.
              The system will suggest existing items you can reuse, but this check does not block saving a new item.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 text-gray-600 shadow-sm ring-1 ring-gray-200">
                Mfr Brand: <span className="font-semibold text-gray-800">{currentBrand || '-'}</span>
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-gray-600 shadow-sm ring-1 ring-gray-200">
                Mfr Catalog No: <span className="font-semibold text-gray-800">{currentMfrCatalogNo || '-'}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', searchStatusClass)}>
              {searchStatusLabel}
            </span>
            {hasIdentityInput && (
              <Button
                type="button"
                variant="neutral"
                size="sm"
                onClick={onRecheckExistingItems}
                disabled={searchBeforeCreate.status === 'searching'}
              >
                Recheck
              </Button>
            )}
          </div>
        </div>

        {!hasIdentityInput && (
          <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
            Fill in both identity fields first. Search-before-create will start automatically once both fields are available.
          </div>
        )}

        {searchBeforeCreate.status === 'error' && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {searchBeforeCreate.errorMessage}
          </div>
        )}

        {(searchBeforeCreate.status === 'exact-match' || searchBeforeCreate.status === 'possible-match') && (
          <div className="mt-4 space-y-3">
            <div className={cn(
              'rounded-md border px-4 py-3 text-sm',
              searchBeforeCreate.status === 'exact-match'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            )}>
              {searchBeforeCreate.status === 'exact-match'
                ? 'An existing item already matches this identity. You can open and use that item, or continue saving this new item if it is intentionally different.'
                : 'The system found similar items. Review them as suggestions, or continue saving this new item if none of them are the same item.'}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {searchBeforeCreate.items.map((item) => (
                <div key={item.ItemID} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.ItemCode || `Item #${item.ItemID}`}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.U_Brand || '-'} / {item.U_Calalogno || '-'}
                      </p>
                    </div>
                    {isExactItemIdentityMatch(item, currentBrand, currentMfrCatalogNo) && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                        Exact
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-gray-700">{item.ItemDescription || '-'}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>UOM: {item.InvntryUom || '-'}</span>
                    <span>Updated By: {item.Updatedby || '-'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenExistingItem(Number(item.ItemID))}
                    >
                      Open Item
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {searchBeforeCreate.status === 'possible-match' && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-white px-4 py-3">
                <p className="text-sm text-gray-700">
                  If none of the candidates are the same item, you can keep this as a new draft item.
                </p>
                <Button
                  type="button"
                  variant="warning"
                  size="sm"
                  onClick={onAcknowledgeNewItemCandidate}
                >
                  Mark Reviewed
                </Button>
              </div>
            )}
          </div>
        )}

        {searchBeforeCreate.status === 'no-match' && (
          <div className="mt-4 flex flex-col gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-green-800">No existing item found for this identity.</p>
              <p className="mt-1 text-sm text-green-700">
                You can continue as a new draft item.
              </p>
            </div>
            <Button
              type="button"
              variant="success"
              size="sm"
              onClick={onAcknowledgeNewItemCandidate}
            >
              Mark Reviewed
            </Button>
          </div>
        )}

        {hasSearchReview && (searchBeforeCreate.status === 'no-match' || searchBeforeCreate.status === 'possible-match') && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Search result marked reviewed. You can continue filling the draft item form and save when ready.
          </div>
        )}
      </div>
    </div>
  );
}
