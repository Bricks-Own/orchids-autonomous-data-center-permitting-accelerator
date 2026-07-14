import React, { useEffect, useRef } from 'react';

function PrintableDoc({ doc, inputs, siteName }) {
  return (
    <div className="font-mono text-xs leading-relaxed">
      {/* Document Header */}
      <div className="border-b-2 border-border pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-lg font-bold text-foreground mb-1">{doc.title}</div>
            <div className="text-sm text-muted-foreground/70">Document No.: {doc.docNum}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-bold text-muted-foreground/50">BRICK PERMITOS™</div>
            <div>Permit Document</div>
            <div>{siteName}</div>
            <div className="mt-1 text-destructive font-semibold">DRAFT — PE REVIEW REQUIRED BEFORE FILING</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-4 text-xs text-muted-foreground/70 border-t pt-3">
          <div><span className="font-semibold">Facility:</span> {siteName}</div>
          <div><span className="font-semibold">Client:</span> {inputs?.client}</div>
          <div><span className="font-semibold">State:</span> {inputs?.state}</div>
        </div>
      </div>

      {/* Sections */}
      {doc.sections.map((sec, i) => (
        <div key={i} className="mb-6">
          <div className="font-bold text-foreground text-sm mb-2 bg-muted px-2 py-1 rounded">
            {sec.heading}
          </div>
          <pre className="whitespace-pre-wrap text-foreground/90 font-mono text-xs leading-relaxed pl-2">
            {sec.body}
          </pre>
        </div>
      ))}

      {/* Footer */}
      <div className="border-t-2 border-border pt-4 mt-8">
        <div className="grid grid-cols-2 gap-8 text-xs text-muted-foreground/70">
          <div>
            <div className="font-semibold mb-2">PE CERTIFICATION (required before submission):</div>
            <div className="border-b border-border mb-1 pb-6">Signature: _______________________</div>
            <div className="border-b border-border mb-1 pb-6">PE Name / License #: _______________________</div>
            <div className="border-b border-border pb-6">Date: _______________________</div>
          </div>
          <div>
            <div className="font-semibold mb-2">RESPONSIBLE OFFICIAL CERTIFICATION:</div>
            <div className="text-muted-foreground leading-relaxed">
              "I certify under penalty of law that this document and all attachments
              were prepared under my direction or supervision in accordance with a
              system designed to assure that qualified personnel properly gathered
              and evaluated the information submitted."
            </div>
            <div className="mt-2 border-b border-border pb-6">Signature: _______________________</div>
          </div>
        </div>
        <div className="text-center text-muted-foreground text-xs mt-4">
          Brick PermitOS™ — {new Date().toLocaleDateString()} — Document {doc.docNum} — DRAFT
        </div>
      </div>
    </div>
  );
}

export default function DocumentPreviewModal({ doc, inputs, onClose, onDownload, onNext, onPrev, docIndex, docTotal }) {
  const contentRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handlePrint = () => {
    const printContent = contentRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>${doc.title} — ${inputs?.siteName}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.5; color: #111; padding: 40px; }
            h1 { font-size: 16px; margin-bottom: 4px; }
            .section-heading { font-weight: bold; background: #f3f4f6; padding: 4px 8px; margin: 16px 0 8px; font-size: 12px; }
            pre { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 11px; padding-left: 8px; }
            .header-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; font-size: 11px; }
            .draft-warn { color: #dc2626; font-weight: bold; }
            @page { margin: 1in; }
            table { border-collapse: collapse; width: 100%; font-size: 10px; }
            td, th { border: 1px solid #ddd; padding: 4px 8px; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const handleDownloadText = () => {
    const text = doc.sections.map(s => `${'═'.repeat(80)}\n${s.heading}\n${'═'.repeat(80)}\n\n${s.body}\n\n`).join('');
    const full = `BRICK PERMITOS™ — AI-GENERATED PERMIT DOCUMENT\n${'═'.repeat(80)}\n${doc.title}\nDocument No.: ${doc.docNum}\nFacility: ${inputs?.siteName}\nClient: ${inputs?.client} | State: ${inputs?.state}\nGenerated: ${new Date().toLocaleDateString()}\n\n⚠ DRAFT — PROFESSIONAL ENGINEER REVIEW REQUIRED BEFORE SUBMISSION\n${'═'.repeat(80)}\n\n${text}`;
    const blob = new Blob([full], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.docNum}_${doc.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm">
      {/* Modal header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8  bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {doc.docNum?.split('-')[0] === 'AIR' ? '💨' : '💧'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{doc.title}</div>
            <div className="text-xs text-muted-foreground">{doc.docNum} · {inputs?.siteName}</div>
            {doc._validation && doc._validation.type !== 'generic' && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5  font-semibold tracking-wider bg-emerald-800 text-emerald-300">
                  ASG VALIDATED
                </span>
                <span className="text-[10px] text-emerald-400 truncate max-w-[200px]">
                  Methodology reviewed vs. {doc._validation.projectName}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {/* Nav arrows */}
          {onPrev && (
            <button onClick={onPrev} className="bg-muted hover:bg-muted-foreground/20 text-foreground/80  px-3 py-1.5 text-xs transition-colors">
              ← Prev
            </button>
          )}
          <span className="text-xs text-muted-foreground">{docIndex + 1} / {docTotal}</span>
          {onNext && (
            <button onClick={onNext} className="bg-muted hover:bg-muted-foreground/20 text-foreground/80  px-3 py-1.5 text-xs transition-colors">
              Next →
            </button>
          )}

          <div className="w-px bg-muted h-5 mx-1" />

          {/* Actions */}
          <button
            onClick={handlePrint}
            className="bg-primary hover:bg-primary text-white  px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5">
            🖨 Print
          </button>
          <button
            onClick={handleDownloadText}
            className="bg-primary hover:bg-primary/80 text-white  px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5">
            ⬇ Download
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              className="bg-blue-700 hover:bg-blue-600 text-white  px-3 py-1.5 text-xs transition-colors flex items-center gap-1.5">
              📤 Add to Package
            </button>
          )}

          <div className="w-px bg-muted h-5 mx-1" />
          <button onClick={onClose} className="bg-muted hover:bg-destructive text-foreground/80 hover:text-white  px-3 py-1.5 text-xs transition-colors">
            ✕ Close
          </button>
        </div>
      </div>

      {/* Draft warning banner */}
      <div className="bg-amber-900/60 border-b border-amber-700/60 px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <span className="text-destructive text-xs font-bold">⚠ DRAFT DOCUMENT</span>
        <span className="text-amber-300 text-xs">— Prepared from site-specific data. Review all calculated values, citations, and regulatory determinations. PE certification required before agency submission.</span>
      </div>

      {/* Table of contents */}
      <div className="flex flex-shrink-0 gap-1.5 px-4 py-2 bg-card/60 border-b border-border overflow-x-auto scrollbar-none">
        {doc.sections.map((sec, i) => (
          <button
            key={i}
            onClick={() => {
              const el = document.getElementById(`section-${i}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex-shrink-0 text-xs bg-muted hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground  px-2.5 py-1 transition-colors border border-border/50">
            {sec.heading.split('.')[0]}. {sec.heading.split('.').slice(1).join('.').trim().substring(0, 30) || sec.heading.substring(0, 30)}
          </button>
        ))}
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div ref={contentRef} className="max-w-4xl mx-auto py-10 px-10">
          {/* Document Header */}
          <div className="border-b-2 border-border pb-6 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-bold text-foreground mb-1 font-mono">{doc.title}</div>
                <div className="text-sm text-muted-foreground/70 font-mono">Document No.: {doc.docNum}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-indigo-800">BRICK PERMITOS™</div>
                <div className="text-xs text-muted-foreground">Permit Document</div>
                <div className="text-xs text-muted-foreground/70 mt-0.5">{inputs?.siteName}</div>
                <div className="text-xs font-bold text-destructive mt-1">DRAFT — PE REVIEW REQUIRED</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-4 text-xs text-muted-foreground/50 border-t border-border pt-3 font-mono">
              <div><span className="font-bold">Facility:</span><br/>{inputs?.siteName}</div>
              <div><span className="font-bold">Client:</span><br/>{inputs?.client}</div>
              <div><span className="font-bold">Jurisdiction:</span><br/>{inputs?.county}, {inputs?.state}</div>
              <div><span className="font-bold">Generated:</span><br/>{new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Sections */}
          {doc.sections.map((sec, i) => (
            <div key={i} id={`section-${i}`} className="mb-8 scroll-mt-4">
              <div className="font-bold text-foreground bg-muted border-l-4 border-primary px-3 py-2 mb-3 font-mono text-sm">
                {sec.heading}
              </div>
              <pre className="whitespace-pre-wrap text-foreground/90 font-mono text-xs leading-relaxed pl-4 border-l border-border">
                {sec.body}
              </pre>
            </div>
          ))}

          {/* PE Certification block */}
          <div className="border-t-2 border-border pt-8 mt-12 bg-card p-6 rounded">
            <div className="grid grid-cols-2 gap-8 text-xs text-muted-foreground/50 font-mono">
              <div>
                <div className="font-bold mb-3 text-sm">PROFESSIONAL ENGINEER CERTIFICATION</div>
                <div className="space-y-4">
                  <div className="border-b border-border pb-6">PE Name: _________________________________</div>
                  <div className="border-b border-border pb-6">PE License No. / State: __________________</div>
                  <div className="border-b border-border pb-6">Signature: _______________________________</div>
                  <div className="border-b border-border pb-6">Date: ___________________________________</div>
                  <div className="text-center text-muted-foreground text-xs mt-2">[PE SEAL AFFIXED HERE]</div>
                </div>
              </div>
              <div>
                <div className="font-bold mb-3 text-sm">RESPONSIBLE OFFICIAL CERTIFICATION</div>
                <div className="text-muted-foreground/70 text-xs leading-relaxed mb-4">
                  "I certify under penalty of law that this document and all attachments were prepared under my direction or supervision in accordance with a system designed to assure that qualified personnel properly gathered and evaluated the information submitted. Based on my inquiry of the person or persons who manage the system, or those persons directly responsible for gathering the information, the information submitted is, to the best of my knowledge and belief, true, accurate, and complete. I am aware that there are significant penalties for submitting false information, including the possibility of fine and imprisonment for knowing violations." (40 CFR § 122.22)
                </div>
                <div className="space-y-4">
                  <div className="border-b border-border pb-6">Name / Title: ____________________________</div>
                  <div className="border-b border-border pb-6">Signature: _______________________________</div>
                  <div className="border-b border-border pb-6">Date: ___________________________________</div>
                </div>
              </div>
            </div>
            <div className="text-center text-muted-foreground text-xs mt-6 border-t pt-3">
              BRICK PERMITOS™ | {doc.docNum} | {inputs?.siteName} | Generated: {new Date().toLocaleDateString()} | DRAFT — NOT FOR SUBMISSION WITHOUT PE REVIEW
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
