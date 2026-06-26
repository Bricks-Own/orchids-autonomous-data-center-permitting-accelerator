import React, { useState, useEffect } from 'react';
import { agencySubmit, listAgencySubmissions, createAuditLogEntry } from '../utils/api';

const AGENCIES = [
  'EPA Region 4',
  'State Air Agency',
  'State Water Board',
  'Local POTW',
  'USACE (404)',
  'Local Zoning Board',
];

const DOC_CATEGORIES = [
  {
    label: 'Air Documents',
    docs: [
      { key: 'air_1', name: 'Project Description & Site Process Flow' },
      { key: 'air_2', name: 'Emission Unit Inventory' },
      { key: 'air_3', name: 'Fuel System & Tank Inventory' },
      { key: 'air_4', name: 'PTE Workbook & Methodology' },
      { key: 'air_5', name: 'Controlled PTE & Enforceable Limit Memo' },
      { key: 'air_6', name: 'PSD / NSR Applicability Determination' },
      { key: 'air_7', name: 'BACT / LAER Technology Review' },
      { key: 'air_8', name: 'NSPS Subpart KKKK Compliance Matrix' },
      { key: 'air_9', name: 'NESHAP Subpart YYYY Compliance' },
      { key: 'air_10', name: 'Engine Rule Matrix (IIII/JJJJ/ZZZZ)' },
      { key: 'air_11', name: 'SSM Emissions Plan' },
      { key: 'air_12', name: 'AERMOD Modeling Protocol' },
      { key: 'air_13', name: 'NAAQS / PSD Increment Report' },
      { key: 'air_14', name: 'GHG & Decarbonization Analysis' },
      { key: 'air_15', name: 'Monitoring, Recordkeeping & Compliance Plan' },
      { key: 'air_16', name: 'Environmental Justice Package' },
    ],
  },
  {
    label: 'Water Documents',
    docs: [
      { key: 'water_1', name: 'Water Balance & Utility Flow Diagram' },
      { key: 'water_2', name: 'NPDES Applicability Determination' },
      { key: 'water_3', name: 'Cooling Tower Blowdown Characterization' },
      { key: 'water_4', name: 'Industrial Stormwater NOI + SWPPP' },
      { key: 'water_5', name: 'Construction Stormwater NOI + E&S Plan' },
      { key: 'water_6', name: '316(b) Cooling Water Intake Screen' },
      { key: 'water_7', name: 'SPCC Plan' },
      { key: 'water_8', name: 'POTW Discharge Support Package' },
      { key: 'water_9', name: 'Wetlands / WOTUS Screening' },
      { key: 'water_10', name: 'Water Conservation / ZLD Memo' },
    ],
  },
  {
    label: 'Compliance Reports',
    docs: [
      { key: 'compliance_nox', name: 'NOx Annual Compliance Report' },
      { key: 'compliance_co', name: 'CO Annual Compliance Report' },
      { key: 'compliance_ghg', name: 'GHG Annual Report (GHGRP)' },
      { key: 'compliance_title_v', name: 'Title V Compliance Certification' },
    ],
  },
];

export default function AgencySubmission({ inputs, results, siteId, onNotify }) {
  const [step, setStep] = useState('select'); // select | review | done
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDoc, setSelectedDoc] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('');
  const [docNum, setDocNum] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyView, setHistoryView] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await listAgencySubmissions();
      setHistory(data.submissions || []);
    } catch {
      // History not critical
    }
    setHistoryLoading(false);
  };

  const selectedDocName = () => {
    for (const cat of DOC_CATEGORIES) {
      const found = cat.docs.find(d => d.key === selectedDoc);
      if (found) return found.name;
    }
    return selectedDoc;
  };

  const handleSelect = () => {
    if (!selectedDoc || !selectedAgency) return;
    setStep('review');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await createAuditLogEntry(siteId, 'agency_submission', {
        docType: selectedDoc,
        docNum: docNum || selectedDoc,
        agency: selectedAgency,
      });
      const data = await agencySubmit(siteId, selectedDoc, docNum || selectedDoc, selectedAgency, notes);
      setLastSubmission(data.submission);
      setStep('done');
      onNotify('Agency submission completed successfully.');
      loadHistory();
    } catch (err) {
      onNotify(`Submission failed: ${err.message}`);
    }
    setSubmitting(false);
  };

  const handleReset = () => {
    setStep('select');
    setSelectedCategory('');
    setSelectedDoc('');
    setSelectedAgency('');
    setDocNum('');
    setNotes('');
    setLastSubmission(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-300">Auto-Agency Submission Tool</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Submit permit documents and compliance reports directly to regulatory agencies.
              Each submission receives a unique tracking ID for your permit record.
            </p>
          </div>
          <div className="flex gap-2">
            {!historyView ? (
              <button onClick={() => setHistoryView(true)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 border border-gray-700 transition-colors">
                View Submission History
              </button>
            ) : (
              <button onClick={() => setHistoryView(false)}
                className="text-xs bg-amber-800 hover:bg-amber-700 text-amber-300 rounded-lg px-3 py-1.5 border border-amber-700 transition-colors">
                New Submission
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submission History */}
      {historyView && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400">Submission History</h4>
          {historyLoading ? (
            <div className="text-xs text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-gray-600 bg-gray-900/40 border border-gray-800 rounded-xl p-6 text-center">
              No submissions yet. Use the form above to submit your first document.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(sub => (
                <div key={sub.id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-green-400">{sub.tracking_id}</span>
                      <p className="text-xs text-gray-300 mt-1">{sub.doc_type} &mdash; {sub.agency}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{sub.doc_num}{sub.notes ? ` · ${sub.notes}` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs bg-green-900/30 text-green-400 border border-green-700/40 rounded-full px-2 py-0.5">
                        {sub.status}
                      </span>
                      <p className="text-xs text-gray-600 mt-1">{sub.submitted_at ? new Date(sub.submitted_at + 'Z').toLocaleDateString() : ''}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Select */}
      {!historyView && step === 'select' && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Document Category / Selection */}
          <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-400 mb-3">1. Select Document</p>
            <div className="space-y-2">
              {DOC_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === cat.label ? '' : cat.label)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors
                      ${selectedCategory === cat.label ? 'bg-indigo-800/30 border-indigo-600 text-indigo-200' : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-gray-200'}`}
                  >
                    {cat.label}
                  </button>
                  {selectedCategory === cat.label && (
                    <div className="mt-1 ml-2 space-y-1">
                      {cat.docs.map(d => (
                        <button key={d.key}
                          onClick={() => { setSelectedDoc(d.key); setDocNum(d.key); }}
                          className={`w-full text-left text-xs px-3 py-1.5 rounded-lg border transition-colors
                            ${selectedDoc === d.key ? 'bg-indigo-700/40 border-indigo-500 text-indigo-200' : 'bg-gray-800/20 border-gray-700/40 text-gray-500 hover:text-gray-300'}`}>
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agency Selection */}
          <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-400 mb-3">2. Select Agency</p>
            <div className="space-y-1.5">
              {AGENCIES.map(a => (
                <button key={a}
                  onClick={() => setSelectedAgency(a)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors
                    ${selectedAgency === a ? 'bg-amber-800/30 border-amber-600 text-amber-200' : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-gray-200'}`}>
                  {a}
                </button>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="text-xs text-gray-500 mb-1 block">Submission Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note for the submission record..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <button
              onClick={handleSelect}
              disabled={!selectedDoc || !selectedAgency}
              className="mt-4 w-full bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-600 text-white text-xs rounded-xl px-4 py-2.5 font-semibold transition-colors"
            >
              Review & Submit
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {!historyView && step === 'review' && (
        <div className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-6 space-y-5 max-w-xl">
          <h4 className="text-sm font-semibold text-white">Step 2: Review Submission</h4>

          <div className="space-y-3">
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
              <span className="text-xs text-gray-500 block mb-1">Document</span>
              <span className="text-xs text-gray-200 font-medium">{selectedDocName()}</span>
              <span className="text-xs text-gray-600 ml-2">({docNum})</span>
            </div>
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
              <span className="text-xs text-gray-500 block mb-1">Agency</span>
              <span className="text-xs text-gray-200 font-medium">{selectedAgency}</span>
            </div>
            {notes && (
              <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3">
                <span className="text-xs text-gray-500 block mb-1">Notes</span>
                <span className="text-xs text-gray-300">{notes}</span>
              </div>
            )}
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-3">
              <span className="text-xs text-amber-400 font-semibold block mb-1">Pre-Submission Checklist</span>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>✓ Document reviewed by PE of record</li>
                <li>✓ All exhibits attached and cross-referenced</li>
                <li>✓ Fee calculation verified (if applicable)</li>
                <li>✓ Electronic format meets agency requirements</li>
                <li>✓ Copy retained in Brick document record</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('select')}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl px-4 py-2.5 border border-gray-700 transition-colors">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-600 text-white text-xs rounded-xl px-4 py-2.5 font-semibold transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit to Agency'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {!historyView && step === 'done' && lastSubmission && (
        <div className="max-w-xl">
          <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-8 text-center space-y-4">
            <div className="text-4xl">&#10003;</div>
            <h4 className="text-base font-semibold text-green-400">Submission Complete</h4>
            <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-4 inline-block">
              <p className="text-xs text-gray-500 mb-1">Tracking ID</p>
              <p className="text-lg font-bold text-white font-mono">{lastSubmission.trackingId}</p>
            </div>
            <p className="text-xs text-gray-400">
              Document <strong className="text-gray-300">{selectedDocName()}</strong> submitted to{' '}
              <strong className="text-gray-300">{lastSubmission.agency}</strong>
            </p>
            <p className="text-xs text-gray-500">
              Submitted: {new Date(lastSubmission.submittedAt).toLocaleString()}
            </p>
            <p className="text-xs text-gray-600">
              Retain the Tracking ID for your permit record and agency correspondence.
            </p>
            <button onClick={handleReset}
              className="bg-amber-700 hover:bg-amber-600 text-white text-xs rounded-xl px-6 py-2.5 font-semibold transition-colors">
              Submit Another Document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}