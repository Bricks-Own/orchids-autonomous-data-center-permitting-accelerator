// ─── Enhanced Document Generator ──────────────────────────────────────────────
// Wraps the frontend document generator with RAG-backed citations,
// compliance validation, and enriched regulatory content.

import { generateDocument } from '../../../permitOS/src/utils/documentGenerator.js';
import { searchRegulations } from '../rag/vectorStore.js';
import { validateDocument } from '../validation/complianceValidator.js';

// ─── Regulation Citation Database ────────────────────────────────────────────
// Pre-computed citation links for each document type
const REGULATION_TEXTS = {
  'air_1': {
    citations: [
      '40 CFR § 51.166 — PSD Applicability Requirements',
      '40 CFR § 52.21 — Federal PSD Program',
      'State Air Agency Preconstruction Permit Application Requirements',
    ],
  },
  'air_2': {
    citations: [
      '40 CFR § 51.166(b)(2) — Emission Unit Definition',
      '40 CFR § 60 Subpart KKKK — Turbine NSPS Coverage',
      'EPA NSR Workshop Manual — Emission Unit Inventory',
    ],
  },
  'air_3': {
    citations: [
      '40 CFR § 60 Subpart KKKK/KKKKa — Stationary Combustion Turbine NSPS',
      '40 CFR § 60 Subpart IIII — CI Engine NSPS',
      '40 CFR § 60 Subpart JJJJ — SI Engine NSPS',
      '40 CFR § 63 Subpart ZZZZ — RICE NESHAP',
    ],
  },
  'air_4': {
    citations: [
      'EPA AP-42 Section 3.1 — Stationary Gas Turbines',
      '40 CFR § 51.165 — NSR Thresholds',
      '40 CFR § 51.166 — PSD Major Source Thresholds',
      '40 CFR § 52.21(b) — PSD Significant Emission Rates',
    ],
  },
  'air_5': {
    citations: [
      '40 CFR § 51.166(b)(48) — Synthetic Minor Definition',
      'EPA Memo: Enforceability of Emission Limits (March 2020)',
      '40 CFR § 70.3 — Title V Major Source Threshold',
    ],
  },
  'air_6': {
    citations: [
      '40 CFR § 51.166 — PSD Applicability Flowchart',
      '40 CFR § 51.165 — NSR Nonattainment Applicability',
      'EPA PSD/NSR Applicability Guidance',
    ],
  },
  'air_7': {
    citations: [
      'CAA § 165(a)(4) — BACT Requirement',
      '40 CFR § 51.166(j) — BACT Analysis Requirements',
      'EPA RBLC Database — Recent BACT Determinations',
      'EPA BACT Cost Methodology Guidance (2022)',
    ],
  },
  'air_8': {
    citations: [
      '40 CFR § 60.4300-60.4420 — Subpart KKKK Full Text',
      '40 CFR § 60.4400-60.4420 — Subpart KKKKa Full Text',
      'EPA NSPS Compliance Timeline for Stationary Turbines',
    ],
  },
  'air_9': {
    citations: [
      '40 CFR § 63.6080-63.6145 — Subpart YYYY Full Text',
      'EPA NESHAP Compliance Guidance for Combustion Turbines',
      '40 CFR § 63 Subpart A — General Provisions',
    ],
  },
  'air_10': {
    citations: [
      '40 CFR § 60.4200-60.4219 — Subpart IIII (CI Engines)',
      '40 CFR § 60.4230-60.4243 — Subpart JJJJ (SI Engines)',
      '40 CFR § 63.6580-63.6675 — Subpart ZZZZ (RICE NESHAP)',
      'EPA Emergency Demand Response Rule (September 2021)',
    ],
  },
  'air_11': {
    citations: [
      '40 CFR § 60.7 — SSM General Provisions',
      '40 CFR § 64.1-64.10 — Compliance Assurance Monitoring',
      'EPA CAM Technical Guidance Document',
    ],
  },
  'air_12': {
    citations: [
      '40 CFR Part 51 Appendix W — Guideline on Air Quality Models',
      'EPA AERMOD Implementation Guide (Version 23132)',
      'EPA Meteorological Monitoring Guidance (EPA-454/R-99-005)',
    ],
  },
  'air_13': {
    citations: [
      '40 CFR Part 51 Appendix W — Model Evaluation',
      '40 CFR § 51.166(k) — Air Quality Impact Analysis',
      '40 CFR § 52.21(m) — PSD Increment Analysis',
    ],
  },
  'air_14': {
    citations: [
      '40 CFR § 98 Subpart C — GHGRP Stationary Combustion',
      '40 CFR § 98.30 — GHGRP Definitions and Methodology',
      'EPA eGGRT Reporting System Guidance',
      'EPA GHGRP Subpart C Calculation Methodology (Tier 2)',
    ],
  },
  'air_15': {
    citations: [
      '40 CFR § 70.6 — Title V Permit Content',
      '40 CFR § 64.3 — CAM Plan Requirements',
      '40 CFR § 60.7 — NSPS Recordkeeping and Reporting',
      '40 CFR § 63.10 — NESHAP Recordkeeping',
    ],
  },
  'air_16': {
    citations: [
      'EO 14096 — Revitalizing Our Nations Commitment to Environmental Justice',
      'EPA EJScreen Technical Documentation (Version 2.3)',
      'CAA § 165(a)(2) — Public Participation',
    ],
  },
  'water_1': {
    citations: [
      '40 CFR § 122.21(g) — NPDES Application Data',
      'EPA Water Balance Methodology Guidance',
    ],
  },
  'water_2': {
    citations: [
      '40 CFR § 122.21 — NPDES Permit Application Requirements',
      '40 CFR § 122.44 — Technology-Based Effluent Limits',
      'CWA § 402 — NPDES Statutory Authority',
    ],
  },
  'water_3': {
    citations: [
      '40 CFR § 122.44 — Effluent Limitations',
      '40 CFR § 403.5 — Pretreatment Standards',
      'EPA Cooling Tower Blowdown Guidance',
    ],
  },
  'water_4': {
    citations: [
      '40 CFR § 122.26 — Industrial Stormwater Requirements',
      'EPA MSGP (2022) — Sector-Specific Requirements',
      'EPA SWPPP Guidance for Industrial Facilities',
    ],
  },
  'water_5': {
    citations: [
      'EPA Construction General Permit (2022)',
      '40 CFR § 122.26(b)(14)(x) — Construction Stormwater',
      'EPA Sediment and Erosion Control Guidance',
    ],
  },
  'water_6': {
    citations: [
      '40 CFR § 125 Subpart J — Cooling Water Intake Structures',
      'CWA § 316(b) — Cooling Water Intake Requirements',
      'EPA 316(b) Phase II/III Rule Implementation Guidance',
    ],
  },
  'water_7': {
    citations: [
      '40 CFR § 112.1 — SPCC Applicability',
      '40 CFR § 112.7 — SPCC Plan Content',
      '40 CFR § 112.8 — SPCC Aboveground Storage Tanks',
      'EPA SPCC Guidance for Regional Inspectors',
    ],
  },
  'water_8': {
    citations: [
      '40 CFR § 403.5 — General Pretreatment Standards',
      '40 CFR § 403.12 — SIU Reporting Requirements',
      'Local POTW Sewer Use Ordinance Requirements',
    ],
  },
  'water_9': {
    citations: [
      'CWA § 404 — Dredge and Fill Permit Program',
      'CWA § 401 — Water Quality Certification',
      'Sackett v. EPA (2023) — WOTUS Definition',
      'USACE NWP 39 — Commercial/Institutional Development',
    ],
  },
  'water_10': {
    citations: [
      'CWA § 303 — Water Quality Standards',
      'State Water Conservation Requirements',
      'EPA WaterSense Guidance for Commercial Facilities',
    ],
  },
};

// ─── Enrich a document with RAG-backed content ──────────────────────────────
function enrichWithRAG(text, docKey) {
  const enrichment = [];
  const regInfo = REGULATION_TEXTS[docKey];
  if (!regInfo) return { enriched: text, citations: [] };

  const citations = [...regInfo.citations];

  // Add RAG-backed regulatory context
  for (const citation of regInfo.citations) {
    const searchTerm = citation.split('—')[0].trim();
    const results = searchRegulations(searchTerm, {
      category: docKey.startsWith('water') ? 'water' : 'air',
      limit: 2,
      minScore: 0.05,
    });

    if (results.length > 0) {
      for (const r of results.slice(0, 1)) {
        const snippet = r.text.split('\n')[0].substring(0, 200);
        if (snippet.length > 50) {
          enrichment.push({
            citation: citation,
            regulation_text: snippet,
            relevance: Math.round(r.score * 100),
          });
        }
      }
    }
  }

  return { enriched: text, citations, enrichment };
}

// ─── Generate Enhanced Document ──────────────────────────────────────────────
export function generateEnhancedDocument(docType, docNum, inputs, results) {
  const docKey = `${docType}_${docNum}`;

  // Generate the base document
  const baseDoc = generateDocument(docType, docNum, inputs, results);
  if (!baseDoc) return null;

  // Enrich each section with RAG-backed citations
  const enrichedSections = baseDoc.sections.map(section => {
    const enriched = enrichWithRAG(section.body, docKey);
    return {
      heading: section.heading,
      body: section.body,
      citations: enriched.citations,
      regulationContext: enriched.enrichment,
    };
  });

  // Run compliance validation
  const validation = validateDocument(docKey, inputs, results);

  // Create regulatory authority header
  const authority = getRegulatoryAuthority(docKey, inputs);

  return {
    title: baseDoc.title,
    docNum: baseDoc.docNum,
    regulatoryAuthority: authority,
    sections: enrichedSections,
    citations: REGULATION_TEXTS[docKey]?.citations || [],
    compliance: {
      status: validation.overallStatus,
      checks: validation.checks,
      passed: validation.passed,
      failed: validation.failed,
      warnings: validation.warnings,
      details: validation.validations,
    },
    wordCount: enrichedSections.reduce((s, sec) => s + sec.body.split(/\s+/).length, 0),
  };
}

// ─── Get Regulatory Authority ────────────────────────────────────────────────
function getRegulatoryAuthority(docKey, inputs) {
  const airAuthority = {
    name: `${inputs?.state || 'State'} Department of Environmental Protection`,
    division: 'Division of Air Pollution Control',
    jurisdiction: `${inputs?.state || 'State'} Air Quality Act and Clean Air Act (42 U.S.C. § 7401 et seq.)`,
  };

  const waterAuthority = {
    name: `${inputs?.state || 'State'} Department of Environmental Protection`,
    division: 'Division of Water Resources / Water Quality Control',
    jurisdiction: `${inputs?.state || 'State'} Water Quality Act and Clean Water Act (33 U.S.C. § 1251 et seq.)`,
  };

  if (docKey.startsWith('water')) return waterAuthority;
  return airAuthority;
}

// ─── Generate All Enhanced Documents ─────────────────────────────────────────
export function generateAllEnhanced(inputs, results) {
  const types = [
    { type: 'air', count: 16 },
    { type: 'water', count: 10 },
  ];

  const docs = [];
  for (const { type, count } of types) {
    for (let num = 1; num <= count; num++) {
      const doc = generateEnhancedDocument(type, num, inputs, results);
      if (doc) docs.push(doc);
    }
  }

  return docs;
}