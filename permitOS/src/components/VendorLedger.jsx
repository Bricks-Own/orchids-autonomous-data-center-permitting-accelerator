import React, { useState, useMemo } from 'react';

// ─── Vendor / Commitment Ledger ─────────────────────────────────────────────
// Editable Excel-like table with Cost/Schedule Category, Vendor Name,
// Original Commitment, Approved COs, Current Commitment (computed),
// Pending COs, Invoiced to Date, Paid to Date, AP Aging, and Per-Vendor EAC.
// Includes add/delete row, inline editing, column totals, and reconciliation.

const COST_CATEGORIES = [
  'Land',
  'Site Development',
  'Power & Utilities',
  'LLE & Material Procurement',
  'GC',
  'Fitout',
  'O&M',
];

// Generate deterministic default vendors from site inputs
function generateDefaultVendors(siteData) {
  const bac = siteData?.evm?.BAC || 200000000;
  const costCategories = siteData?.costCategories || [];

  // Map cost categories to the 7 ledger categories
  const categoryBudget = (ledgerCat) => {
    const mapping = {
      'Land': costCategories.find(c => c.name.includes('Land')),
      'Site Development': costCategories.find(c => c.name.includes('Site Dev')),
      'Power & Utilities': costCategories.find(c => c.name.includes('Power') || c.name.includes('Utilities')),
      'LLE & Material Procurement': costCategories.find(c => c.name.includes('Material') || c.name.includes('LLE')),
      'GC': costCategories.find(c => c.name.includes('GC') || c.name.includes('Contract')),
      'Fitout': costCategories.find(c => c.name.includes('Fitout') || c.name.includes('Finishes')),
      'O&M': costCategories.find(c => c.name.includes('Commission') || c.name.includes('Testing')),
    };
    const found = mapping[ledgerCat];
    return found ? found.budget : Math.round(bac * 0.03);
  };

  const vendorTemplates = {
    'Land': [
      { vendor: 'Cushman & Wakefield', pct: 0.5 },
      { vendor: 'CBRE Group', pct: 0.3 },
      { vendor: 'JLL', pct: 0.2 },
    ],
    'Site Development': [
      { vendor: 'Turner Construction', pct: 0.4 },
      { vendor: 'Clark Construction', pct: 0.35 },
      { vendor: 'Suffolk Construction', pct: 0.25 },
    ],
    'Power & Utilities': [
      { vendor: 'ABB Inc.', pct: 0.3 },
      { vendor: 'Siemens Energy', pct: 0.25 },
      { vendor: 'Schneider Electric', pct: 0.2 },
      { vendor: 'Eaton Corporation', pct: 0.15 },
      { vendor: 'GE Vernova', pct: 0.1 },
    ],
    'LLE & Material Procurement': [
      { vendor: 'Johnson Controls', pct: 0.3 },
      { vendor: 'Carrier Global', pct: 0.25 },
      { vendor: 'Daikin Applied', pct: 0.2 },
      { vendor: 'Trane Technologies', pct: 0.25 },
    ],
    'GC': [
      { vendor: 'DPR Construction', pct: 0.35 },
      { vendor: 'Whiting-Turner', pct: 0.25 },
      { vendor: 'Hensel Phelps', pct: 0.2 },
      { vendor: 'Gilbane Building Co.', pct: 0.2 },
    ],
    'Fitout': [
      { vendor: 'HITT Contracting', pct: 0.4 },
      { vendor: 'Structure Tone', pct: 0.35 },
      { vendor: 'Turner Fitout', pct: 0.25 },
    ],
    'O&M': [
      { vendor: 'JLL Operations', pct: 0.5 },
      { vendor: 'CBRE Facilities', pct: 0.3 },
      { vendor: 'Cushman O&M', pct: 0.2 },
    ],
  };

  const vendors = [];
  for (const [cat, templates] of Object.entries(vendorTemplates)) {
    const catBudget = categoryBudget(cat);
    for (const tpl of templates) {
      const origCommitment = Math.round(catBudget * tpl.pct * (0.8 + (vendors.length * 0.01)));
      const approvedCOs = Math.round(origCommitment * (0.02 + (vendors.length % 5) * 0.005));
      const pendingCOs = Math.round(origCommitment * 0.01 * (1 + (vendors.length % 3)));
      const invoiced = Math.round((origCommitment + approvedCOs) * 0.45);
      const paid = Math.round(invoiced * 0.85);
      const eac = Math.round(origCommitment + approvedCOs + pendingCOs + (origCommitment * 0.01));
      const apAging = Math.round(15 + (vendors.length % 20));
      vendors.push({
        id: `v-${vendors.length + 1}`,
        category: cat,
        vendor: tpl.vendor,
        originalCommitment: origCommitment,
        approvedCOs,
        currentCommitment: origCommitment + approvedCOs,
        pendingCOs,
        invoicedToDate: invoiced,
        paidToDate: paid,
        apAging,
        eac,
      });
    }
  }
  return vendors;
}

export default function VendorLedger({ data, onSave, savedVendors }) {
  const [vendors, setVendors] = useState(() => savedVendors || generateDefaultVendors(data));
  const [editingCell, setEditingCell] = useState(null);
  const [newRowCat, setNewRowCat] = useState(COST_CATEGORIES[0]);
  const [showRec, setShowRec] = useState(false);

  // ─── Computed totals ────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = {
      originalCommitment: 0,
      approvedCOs: 0,
      currentCommitment: 0,
      pendingCOs: 0,
      invoicedToDate: 0,
      paidToDate: 0,
      eac: 0,
    };
    for (const v of vendors) {
      t.originalCommitment += v.originalCommitment || 0;
      t.approvedCOs += v.approvedCOs || 0;
      t.currentCommitment += v.currentCommitment || 0;
      t.pendingCOs += v.pendingCOs || 0;
      t.invoicedToDate += v.invoicedToDate || 0;
      t.paidToDate += v.paidToDate || 0;
      t.eac += v.eac || 0;
    }
    return t;
  }, [vendors]);

  // Reconcile with project EAC
  const projectEAC = data?.evm?.EAC || 0;
  const reconciliationVariance = totals.eac - projectEAC;

  // ─── Cell editing ───────────────────────────────────────────────────────
  const updateCell = (id, field, value) => {
    setVendors(prev => prev.map(v => {
      if (v.id !== id) return v;
      const updated = { ...v, [field]: value };
      // Recompute current commitment
      if (field === 'originalCommitment' || field === 'approvedCOs') {
        updated.currentCommitment = (updated.originalCommitment || 0) + (updated.approvedCOs || 0);
      }
      return updated;
    }));
  };

  const handleCellBlur = () => setEditingCell(null);

  const handleCellKeyDown = (e, id, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // ─── Add / Delete row ───────────────────────────────────────────────────
  const addRow = () => {
    const newId = `v-${Date.now()}`;
    setVendors(prev => [...prev, {
      id: newId,
      category: newRowCat,
      vendor: 'New Vendor',
      originalCommitment: 0,
      approvedCOs: 0,
      currentCommitment: 0,
      pendingCOs: 0,
      invoicedToDate: 0,
      paidToDate: 0,
      apAging: 0,
      eac: 0,
    }]);
  };

  const deleteRow = (id) => {
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const handleSave = () => {
    if (onSave) onSave({ vendors });
  };

  const fmt = (v) => {
    if (typeof v !== 'number') return '—';
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + v.toLocaleString();
  };

  const inputStyle = "w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 text-right";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={newRowCat}
            onChange={e => setNewRowCat(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-300"
          >
            {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={addRow} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors">
            + Add Row
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Save Ledger
          </button>
          <button
            onClick={() => setShowRec(!showRec)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors"
          >
            {showRec ? 'Hide' : 'Show'} Reconciliation
          </button>
        </div>
      </div>

      {/* Reconciliation */}
      {showRec && (
        <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-3">
          <h4 className="text-xs font-semibold text-indigo-300 mb-2">Ledger Reconciliation</h4>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-900/60 rounded-lg p-2">
              <span className="text-gray-500">Ledger Total EAC</span>
              <div className="text-sm font-bold text-gray-200">{fmt(totals.eac)}</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-2">
              <span className="text-gray-500">Project EAC</span>
              <div className="text-sm font-bold text-gray-200">{fmt(projectEAC)}</div>
            </div>
            <div className="bg-gray-900/60 rounded-lg p-2">
              <span className="text-gray-500">Variance</span>
              <div className={`text-sm font-bold ${reconciliationVariance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(reconciliationVariance)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-700/40 bg-gray-900/40">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 bg-gray-950/50">
              <th className="text-left py-2.5 px-2 font-medium">Category</th>
              <th className="text-left py-2.5 px-2 font-medium min-w-[140px]">Vendor Name</th>
              <th className="text-right py-2.5 px-2 font-medium">Original Commitment</th>
              <th className="text-right py-2.5 px-2 font-medium">Approved COs</th>
              <th className="text-right py-2.5 px-2 font-medium text-indigo-400">Current Commitment</th>
              <th className="text-right py-2.5 px-2 font-medium">Pending COs</th>
              <th className="text-right py-2.5 px-2 font-medium">Invoiced to Date</th>
              <th className="text-right py-2.5 px-2 font-medium">Paid to Date</th>
              <th className="text-right py-2.5 px-2 font-medium">AP Aging (d)</th>
              <th className="text-right py-2.5 px-2 font-medium">Vendor EAC</th>
              <th className="py-2.5 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v, idx) => {
              const isEditing = (id, field) => editingCell === `${id}-${field}`;
              const startEdit = (id, field) => setEditingCell(`${id}-${field}`);
              const renderCell = (id, field, value, fmtFn = fmt) => (
                isEditing(id, field)
                  ? <input
                      type="number"
                      className={inputStyle}
                      value={value}
                      onChange={e => updateCell(id, field, parseFloat(e.target.value) || 0)}
                      onBlur={handleCellBlur}
                      onKeyDown={e => handleCellKeyDown(e, id, field)}
                      autoFocus
                    />
                  : <span
                      className="cursor-pointer hover:text-indigo-400 transition-colors"
                      onClick={() => startEdit(id, field)}
                    >{fmtFn(value)}</span>
              );
              return (
                <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="py-2 px-2">
                    <select
                      value={v.category}
                      onChange={e => updateCell(v.id, 'category', e.target.value)}
                      className="bg-transparent text-gray-300 text-xs border-none focus:outline-none"
                    >
                      {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      className="bg-transparent text-gray-200 text-xs border-none focus:outline-none focus:text-indigo-300 min-w-[120px]"
                      value={v.vendor}
                      onChange={e => updateCell(v.id, 'vendor', e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'originalCommitment', v.originalCommitment)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'approvedCOs', v.approvedCOs)}</td>
                  <td className="py-2 px-2 text-right text-indigo-400 font-semibold">{fmt(v.currentCommitment)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'pendingCOs', v.pendingCOs)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'invoicedToDate', v.invoicedToDate)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'paidToDate', v.paidToDate)}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'apAging', v.apAging, (v) => v + 'd')}</td>
                  <td className="py-2 px-2 text-right text-gray-300">{renderCell(v.id, 'eac', v.eac)}</td>
                  <td className="py-2 px-2">
                    <button onClick={() => deleteRow(v.id)} className="text-gray-600 hover:text-red-400 transition-colors text-xs">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals Footer */}
          <tfoot>
            <tr className="bg-gray-950/60 border-t border-gray-700">
              <td className="py-2.5 px-2 text-gray-400 font-semibold" colSpan={2}>Totals</td>
              <td className="py-2.5 px-2 text-right text-gray-200 font-semibold">{fmt(totals.originalCommitment)}</td>
              <td className="py-2.5 px-2 text-right text-gray-200 font-semibold">{fmt(totals.approvedCOs)}</td>
              <td className="py-2.5 px-2 text-right text-indigo-300 font-semibold">{fmt(totals.currentCommitment)}</td>
              <td className="py-2.5 px-2 text-right text-gray-200 font-semibold">{fmt(totals.pendingCOs)}</td>
              <td className="py-2.5 px-2 text-right text-gray-200 font-semibold">{fmt(totals.invoicedToDate)}</td>
              <td className="py-2.5 px-2 text-right text-gray-200 font-semibold">{fmt(totals.paidToDate)}</td>
              <td className="py-2.5 px-2 text-right text-gray-600">—</td>
              <td className="py-2.5 px-2 text-right text-gray-200 font-semibold">{fmt(totals.eac)}</td>
              <td className="py-2.5 px-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-gray-600">Current Commitment = Original + Approved COs (computed). Editable cells: click to edit, Enter to confirm, Esc to cancel.</p>
    </div>
  );
}