'use client';

import { useState } from 'react';
import { AlertTriangle, Info, Play } from 'lucide-react';

const AXON_PLACEHOLDER_LINES = [
  {
    axonLineId: 'AXON-L001',
    supplier: 'Mock Supplier A',
    brand: 'DUMMY Brand X',
    mfrCatalogNo: 'CAT-DUMMY-001',
    description: 'Mock Part Description A (Obvious Placeholder)',
    qty: 10,
    unitPrice: 100,
    currency: 'USD',
    costMark: 'LINE_TOTAL',
  },
  {
    axonLineId: 'AXON-L002',
    supplier: 'Mock Supplier A',
    brand: 'DUMMY Brand Y',
    mfrCatalogNo: 'CAT-DUMMY-002',
    description: 'Mock Part Description B (Obvious Placeholder)',
    qty: 25,
    unitPrice: 15.5,
    currency: 'USD',
    costMark: 'HEADER_TOTAL',
  },
  {
    axonLineId: 'AXON-L003',
    supplier: 'Mock Supplier B',
    brand: 'DUMMY Brand Z',
    mfrCatalogNo: 'CAT-DUMMY-003',
    description: 'Mock Part Description C (Obvious Placeholder)',
    qty: 5,
    unitPrice: 250,
    currency: 'EUR',
    costMark: 'LINE_TOTAL',
  },
] as const;

export function AxonAwardedIntake() {
  const [chainId, setChainId] = useState('AIX-DUMMY-12345');
  const [sourceRevision, setSourceRevision] = useState('REV-DUMMY-01');

  return (
    <div className="page-stack bulk-cost-supplier-page">
      <section className="panel supplier-search-panel">
        <div className="supplier-selection-copy">
          <div>
            <p className="eyebrow">AXON Awarded Intake</p>
            <h2>Import AXON Awarded comparison result into Cost Workspace</h2>
          </div>
        </div>

        <div className="axon-intake-alert">
          <Info size={18} className="axon-intake-alert-icon" aria-hidden="true" />
          <div>
            <strong>Integration Policy:</strong> AXON owns the RFQ supplier comparison and Award decisions.
            This screen will only read line items marked as <code>Award = Y</code> from Pi-Jo&apos;s final SQL view,
            then clone those awarded supplier rows into a PartCatalog Cost Workspace run.
          </div>
        </div>

        <div className="supplier-search-bar axon-intake-form-row">
          <div className="axon-intake-field axon-intake-field--chain">
            <label htmlFor="axon-chain-id" className="axon-intake-label">
              ChainId / AIX ID <span aria-hidden="true">*</span>
            </label>
            <input
              id="axon-chain-id"
              type="text"
              className="supplier-search-input"
              value={chainId}
              onChange={(event) => setChainId(event.target.value)}
              placeholder="e.g. AIX-12345"
            />
          </div>

          <div className="axon-intake-field axon-intake-field--revision">
            <label htmlFor="axon-source-revision" className="axon-intake-label">
              Source Revision (Optional)
            </label>
            <input
              id="axon-source-revision"
              type="text"
              className="supplier-search-input"
              value={sourceRevision}
              onChange={(event) => setSourceRevision(event.target.value)}
              placeholder="e.g. REV-01"
            />
          </div>

          <div className="axon-intake-field axon-intake-field--count">
            <span className="axon-intake-label">Supplier / Line Count</span>
            <div className="axon-intake-count">-- suppliers / -- lines</div>
          </div>

          <div className="axon-intake-actions">
            <button
              type="button"
              className="primary-button compact-btn"
              disabled
              title="Waiting for AXON final awarded SQL view contract"
            >
              <Play size={14} aria-hidden="true" />
              Load Awarded Rows
            </button>
            <span className="axon-intake-blocker">
              <AlertTriangle size={12} aria-hidden="true" />
              Waiting for AXON final awarded SQL view contract
            </span>
          </div>
        </div>
      </section>

      <section className="panel bulk-cost-table-panel">
        <div className="axon-intake-panel-header">
          <h3>AXON Awarded Preview (Not Connected)</h3>
          <span className="run-status-badge run-status-badge--draft axon-intake-placeholder-badge">
            Placeholder Shell
          </span>
        </div>

        <div className="axon-intake-summary-grid">
          <div className="axon-intake-card">
            <div className="axon-intake-card-label">CHAIN ID</div>
            <div className="axon-intake-card-value axon-intake-card-value--strong">{chainId || '-'}</div>
          </div>
          <div className="axon-intake-card">
            <div className="axon-intake-card-label">CUSTOMER / RFQ</div>
            <div className="axon-intake-card-value">Mock Customer Co., Ltd. / RFQ-2026-DUMMY</div>
          </div>
          <div className="axon-intake-card">
            <div className="axon-intake-card-label">AWARDED SUPPLIER GROUPS</div>
            <div className="axon-intake-card-value">Mock Supplier A (Won 2 lines), Mock Supplier B (Won 1 line)</div>
          </div>
          <div className="axon-intake-card">
            <div className="axon-intake-card-label">COST MARKERS</div>
            <div className="axon-intake-card-value">HEADER_TOTAL (Freight), LINE_TOTAL (PKH)</div>
          </div>
        </div>

        <div className="table-scroll supplier-table-scroll allocation-list-scroll">
          <table className="prototype-table allocation-list-table axon-intake-table">
            <thead>
              <tr>
                <th className="center-cell axon-intake-line-id-col">AXON Line ID</th>
                <th>Supplier</th>
                <th>Brand</th>
                <th>Mfr Catalog No</th>
                <th>Description</th>
                <th className="center-cell axon-intake-qty-col">Qty</th>
                <th className="numeric-cell axon-intake-price-col">Unit Price</th>
                <th className="center-cell axon-intake-currency-col">Currency</th>
                <th className="center-cell axon-intake-cost-mark-col">Cost Mark</th>
                <th className="center-cell axon-intake-action-col">Import Action</th>
              </tr>
            </thead>
            <tbody>
              {AXON_PLACEHOLDER_LINES.map((line) => (
                <tr key={line.axonLineId} className="axon-intake-placeholder-row">
                  <td className="center-cell strong-cell">{line.axonLineId}</td>
                  <td>{line.supplier}</td>
                  <td>{line.brand}</td>
                  <td>{line.mfrCatalogNo}</td>
                  <td>{line.description}</td>
                  <td className="center-cell">{line.qty}</td>
                  <td className="numeric-cell">{line.unitPrice.toFixed(2)}</td>
                  <td className="center-cell">{line.currency}</td>
                  <td className="center-cell">
                    <span className={`axon-cost-marker axon-cost-marker--${line.costMark === 'LINE_TOTAL' ? 'line' : 'header'}`}>
                      {line.costMark}
                    </span>
                  </td>
                  <td className="center-cell">
                    <input type="checkbox" disabled checked readOnly aria-label={`Placeholder import ${line.axonLineId}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="axon-intake-footer">
          <div className="axon-intake-actions">
            <button type="button" className="primary-button" disabled>
              Import into Cost Workspace
            </button>
            <span className="axon-intake-footer-note">
              Imports awarded rows into a blank Cost Workspace. Disabled until the AXON SQL view contract is approved.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
