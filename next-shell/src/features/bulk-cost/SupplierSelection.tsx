'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { lookupApi, type VendorLookupOption } from '@/services/lookup.api';

interface SupplierSelectionProps {
  onSelectSupplier: (vendor: { code: string; name: string }) => void;
}

export function SupplierSelection({ onSelectSupplier }: SupplierSelectionProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<VendorLookupOption | null>(null);
  const [vendors, setVendors] = useState<VendorLookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    lookupApi.getTermVendors()
      .then((data) => {
        setVendors(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors.slice(0, 80);

    const starts: VendorLookupOption[] = [];
    const rest: VendorLookupOption[] = [];
    for (const vendor of vendors) {
      const code = vendor.cardCode.toLowerCase();
      const name = vendor.cardName.toLowerCase();
      if (code.startsWith(q) || name.startsWith(q)) starts.push(vendor);
      else if (code.includes(q) || name.includes(q)) rest.push(vendor);
    }
    return [...starts, ...rest].slice(0, 80);
  }, [query, vendors]);

  const handleSelect = useCallback((vendor: VendorLookupOption) => {
    setSelected(vendor);
    setQuery(`${vendor.cardCode} - ${vendor.cardName}`);
    setOpen(false);
  }, []);

  const handleOpen = useCallback(() => {
    if (!selected) return;
    onSelectSupplier({ code: selected.cardCode, name: selected.cardName });
  }, [onSelectSupplier, selected]);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setSelected(null);
    setOpen(true);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (!selected) setOpen(true);
  }, [selected]);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Enter') {
      if (filtered.length === 1) {
        handleSelect(filtered[0]);
        return;
      }
      if (selected) handleOpen();
    }
  }, [filtered, handleOpen, handleSelect, selected]);

  return (
    <div className="page-stack bulk-cost-supplier-page">
      <section className="panel supplier-search-panel">
        <div className="supplier-search-bar">
          <Search size={18} aria-hidden="true" />
          <div
            className="vendor-combobox bulk-cost-manual-vendor-combobox"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
          >
            <div className="vendor-combobox-input-wrap">
              {loading
                ? <Loader2 size={14} className="spin-icon vendor-combobox-icon" aria-hidden="true" />
                : <Search size={14} className="vendor-combobox-icon" aria-hidden="true" />
              }
              <input
                ref={inputRef}
                id="bulk-cost-manual-vendor-search"
                name="bulkCostManualVendorSearch"
                type="text"
                autoComplete="off"
                className="vendor-combobox-input supplier-search-input"
                value={query}
                placeholder={loading ? 'Loading suppliers...' : 'Search supplier code or name'}
                disabled={loading}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls="bulk-cost-vendor-list"
              />
              {query && (
                <button
                  type="button"
                  className="vendor-combobox-clear"
                  tabIndex={-1}
                  onClick={() => {
                    setQuery('');
                    setSelected(null);
                    setOpen(false);
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>

            {open && filtered.length > 0 && (
              <ul
                ref={listRef}
                id="bulk-cost-vendor-list"
                className="vendor-combobox-list"
                role="listbox"
              >
                {filtered.map((vendor) => (
                  <li
                    key={vendor.cardCode}
                    className={`vendor-combobox-option${selected?.cardCode === vendor.cardCode ? ' selected' : ''}`}
                    role="option"
                    aria-selected={selected?.cardCode === vendor.cardCode}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(vendor);
                    }}
                  >
                    <span className="vendor-code">{vendor.cardCode}</span>
                    <span className="vendor-name">{vendor.cardName}</span>
                  </li>
                ))}
              </ul>
            )}

            {open && !loading && filtered.length === 0 && (
              <div className="vendor-combobox-empty">No suppliers found</div>
            )}
          </div>

          <button
            type="button"
            className="primary-button compact-btn"
            disabled={!selected}
            onClick={handleOpen}
            title="Open a blank Bulk Cost workspace"
          >
            Open Workspace
          </button>
        </div>

        {loadError && (
          <div className="preview-empty">
            <p>Failed to load supplier master data.</p>
          </div>
        )}
      </section>
    </div>
  );
}
