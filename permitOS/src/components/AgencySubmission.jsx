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

const EPA_PORTALS = [
  { name: 'EPA CDX (Central Data Exchange)', url: 'https://cdx.epa.gov/', desc: 'CROMERRR-compliant submissions for NSPS, NESHAP, Title V, PSD applications' },
  { name: 'EPA e-GGRT (GHG Reporting)', url: 'https://ghgreporting.epa.gov/', desc: '40 CFR Part 98 annual GHG reports' },
  { name: 'EPA NetDMR (NPDES DMRs)', url: 'https://netdmr.epa.gov/', desc: 'Discharge Monitoring Report submissions' },
  { name: 'EPA NPDES eReporting', url: 'https://www.epa.gov/npdes/npdes-ereporting', desc: 'NPDES permit applications, NOIs, and compliance reports' },
  { name: 'EPA SPCC Plan Guidance', url: 'https://www.epa.gov/oil-spills-prevention-and-preparedness-spcc', desc: 'SPCC plan submission and management' },
  { name: 'TCEQ STEERS (Texas)', url: 'https://www.tceq.texas.gov/steers/', desc: 'Texas Commission on Environmental Quality e-filing' },
  { name: 'VA DEQ eFile (Virginia)', url: 'https://www.deq.virginia.gov/landing/efile', desc: 'Virginia DEQ online permitting' },
  { name: 'Ohio EPA eBusiness Center', url: 'https://www.epa.state.oh.us/obusinesscenter', desc: 'Ohio EPA electronic business center' },
  { name: 'GA EPD GEOS (Georgia)', url: 'https://geos.gaepd.org/', desc: 'Georgia EPD online permitting system' },
  { name: 'CARB (California)', url: 'https://www.arb.ca.gov/', desc: 'California Air Resources Board' },
  { name: 'EPA EJScreen', url: 'https://ejscreen.epa.gov/', desc: 'Environmental justice screening and mapping' },
  { name: 'eCFR (Electronic Code of Federal Regulations)', url: 'https://www.ecfr.gov/', desc: 'All 40 CFR regulatory text' },
  { name: 'EPA PAC (PSD/NSR Permitting)', url: 'https://www.epa.gov/caa-permitting/psd-and-nsr-permitting', desc: 'PSD and NSR permit application guidance' },
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
    if (!selectedDoc) return 'No document selected';
    for (const cat of DOC_CATEGORIES) {
      if (!cat.docs) continue;
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
      onNotify('Document saved as draft, ready to file.');
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
    <>
    
      {/* EPA Submission Portals */}
      <div className=" border border-blue-700/30 bg-blue-950/20 p-4 mb-4">
        <h3 className="text-sm font-semibold text-blue-300 mb-3">EPA Submission Portals</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Click any portal below to access the submission system for your permit documents.
          Tracking IDs are provided for your permit record and agency correspondence.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {EPA_PORTALS.map((p) => (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              key={p.url} className="flex flex-col bg-blue-900/20 border border-blue-800/30  p-3 hover:bg-blue-900/30 hover:border-blue-700/50 transition-colors group">
              <span className="text-xs font-medium text-blue-300 group-hover:text-blue-200 transition-colors">{p.name}</span>
              <span className="text-xs text-blue-600/60 group-hover:text-blue-500/80 mt-0.5">{p.url.replace('https://','')}</span>
              <span className="text-[10px] text-muted-foreground mt-1">{p.desc}</span>
            </a>
          ))}
        </div>
      </div>

<div className="space-y-4">
      {/* Header */}
      <div className=" border border-amber-700/30 bg-amber-950/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-amber-300">Agency Document Drafting Tool</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prepare permit documents and compliance reports in draft form for agency filing.
              Each draft receives a unique tracking ID for your permit record.
            </p>
          </div>
          <div className="flex gap-2">
            {!historyView ? (
              <button onClick={() => setHistoryView(true)}
                className="text-xs bg-muted hover:bg-muted-foreground/10 text-foreground/80  px-3 py-1.5 border border-border transition-colors">
                View Draft History
              </button>
            ) : (
              <button onClick={() => setHistoryView(false)}
                className="text-xs bg-amber-800 hover:bg-destructive text-amber-300  px-3 py-1.5 border border-amber-700 transition-colors">
                New Draft
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submission History */}
      {historyView && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground">Draft History</h4>
          {historyLoading ? (
            <div className="text-xs text-muted-foreground">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-muted-foreground/70 bg-card/40 border border-border  p-6 text-center">
              No drafts saved yet. Use the form above to save your first document draft.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(sub => (
                <div key={sub.id} className="bg-card/40 border border-border  p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold text-primary">{sub.tracking_id}</span>
                      <p className="text-xs text-foreground/80 mt-1">{sub.doc_type} &mdash; {sub.agency}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{sub.doc_num}{sub.notes ? ` · ${sub.notes}` : ''}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs bg-primary/10 text-primary border border-green-700/40  px-2 py-0.5">
                        {sub.status}
                      </span>
                      <p className="text-xs text-muted-foreground/70 mt-1">{sub.submitted_at ? new Date(sub.submitted_at + 'Z').toLocaleDateString() : ''}</p>
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
          <div className="bg-card/40 border border-border/40  p-4">
            <p className="text-xs font-semibold text-primary mb-3">1. Select Document</p>
            <div className="space-y-2">
              {DOC_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <button
                    onClick={() => setSelectedCategory(selectedCategory === cat.label ? '' : cat.label)}
                    className={`w-full text-left text-xs px-3 py-2  border transition-colors
                      ${selectedCategory === cat.label ? 'bg-primary/20 border-primary text-primary' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {cat.label}
                  </button>
                  {selectedCategory === cat.label && (
                    <div className="mt-1 ml-2 space-y-1">
                      {cat.docs.map(d => (
                        <button key={d.key}
                          onClick={() => { setSelectedDoc(d.key); setDocNum(d.key); }}
                          className={`w-full text-left text-xs px-3 py-1.5  border transition-colors
                            ${selectedDoc === d.key ? 'bg-primary/40 border-primary text-primary' : 'bg-muted/20 border-border/40 text-muted-foreground hover:text-foreground/80'}`}>
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
          <div className="bg-card/40 border border-border/40  p-4">
            <p className="text-xs font-semibold text-destructive mb-3">2. Select Agency</p>
            <div className="space-y-1.5">
              {AGENCIES.map(a => (
                <button key={a}
                  onClick={() => setSelectedAgency(a)}
                  className={`w-full text-left text-xs px-3 py-2  border transition-colors
                    ${selectedAgency === a ? 'bg-amber-800/30 border-amber-600 text-amber-200' : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'}`}>
                  {a}
                </button>
              ))}
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="text-xs text-muted-foreground mb-1 block">Submission Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add a note for the submission record..."
                rows={3}
                className="w-full bg-muted border border-border  px-3 py-2 text-xs text-foreground/80 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <button
              onClick={handleSelect}
              disabled={!selectedDoc || !selectedAgency}
              className="mt-4 w-full bg-destructive hover:bg-destructive/80 disabled:bg-muted disabled:text-muted-foreground/70 text-white text-xs  px-4 py-2.5 font-semibold transition-colors"
            >
              Review & Save Draft
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {!historyView && step === 'review' && (
        <div className="bg-card/40 border border-border/40  p-6 space-y-5 max-w-xl">
          <h4 className="text-sm font-semibold text-white">Step 2: Review & Save Draft</h4>

          <div className="space-y-3">
            <div className="bg-muted/40 border border-border/40  p-3">
              <span className="text-xs text-muted-foreground block mb-1">Document</span>
              <span className="text-xs text-foreground font-medium">{selectedDocName()}</span>
              <span className="text-xs text-muted-foreground/70 ml-2">({docNum})</span>
            </div>
            <div className="bg-muted/40 border border-border/40  p-3">
              <span className="text-xs text-muted-foreground block mb-1">Agency</span>
              <span className="text-xs text-foreground font-medium">{selectedAgency}</span>
            </div>
            {notes && (
              <div className="bg-muted/40 border border-border/40  p-3">
                <span className="text-xs text-muted-foreground block mb-1">Notes</span>
                <span className="text-xs text-foreground/80">{notes}</span>
              </div>
            )}
            <div className="bg-amber-950/20 border border-amber-800/30  p-3">
              <span className="text-xs text-destructive font-semibold block mb-1">Pre-Submission Checklist</span>
              <ul className="text-xs text-muted-foreground space-y-1">
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
              className="text-xs bg-muted hover:bg-muted-foreground/10 text-foreground/80  px-4 py-2.5 border border-border transition-colors">
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-primary hover:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground/70 text-white text-xs  px-4 py-2.5 font-semibold transition-colors"
            >
              {submitting ? 'Saving...' : 'Save as Draft (Ready to File)'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {!historyView && step === 'done' && lastSubmission && (
        <div className="max-w-xl">
          <div className="bg-green-900/20 border border-green-700/40  p-8 text-center space-y-4">
            <div className="text-4xl">&#10003;</div>
            <h4 className="text-base font-semibold text-primary">Draft Saved</h4>
            <div className="bg-card/60 border border-border/40  p-4 inline-block">
              <p className="text-xs text-muted-foreground mb-1">Tracking ID</p>
              <p className="text-lg font-bold text-white font-mono">{lastSubmission.trackingId}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Document <strong className="text-foreground/80">{selectedDocName()}</strong> saved as draft for{' '}
              <strong className="text-foreground/80">{lastSubmission.agency}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              Saved: {new Date(lastSubmission.submittedAt).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground/70">
              This draft is saved locally. Use the agency portal links above to file when ready.
            </p>
            <button onClick={handleReset}
              className="bg-destructive hover:bg-destructive/80 text-white text-xs  px-6 py-2.5 font-semibold transition-colors">
              Save Another Document Draft
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}