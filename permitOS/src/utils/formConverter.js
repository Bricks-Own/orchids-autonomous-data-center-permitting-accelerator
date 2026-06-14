// ─── State Form Conversion Engine ─────────────────────────────────────────────
// Adapts generic document output to state-specific formats, certifications,
// agency names, portal requirements, and regulatory cross-references.
// Called by generateDocument() after template generation.

import { getStateFormat, DEFAULT_STATE_FORMAT } from '../data/stateFormats';
import {
  getStateOverrides,
  getStateDocReplacement,
  getStateSubmissionRequirements,
} from '../data/stateForms/registry';

// ─── Placeholder Replacement Map ──────────────────────────────────────────────
// Standard placeholder tokens found in documentGenerator.js templates.
// Formatted as: what to replace -> function(stateFormat) that returns replacement.

const PLACEHOLDER_RESOLVERS = {
  '[State Agency]': (fmt) => fmt.airAgency,
  '[state agency]': (fmt) => fmt.airAgency,
  '[State Agency_Name]': (fmt) => fmt.airAgency,
  '[POTW authority]': (fmt) => `${fmt.waterAgency} — POTW/Industrial Pretreatment Division`,
  '[POTW authority name and address]': (fmt) => `${fmt.waterAgency} — Industrial Pretreatment Program, [local POTW name and address]`,
  '[Receiving water name]': (fmt) => `[Site-specific receiving water — consult USGS topo map or state GIS for ${fmt.airAgencyAbbr} jurisdiction]`,
  '[Receiving water name/ditch]': (fmt) => `[Site-specific — determine from site drainage survey; ${fmt.airAgencyAbbr} jurisdiction]`,
  '[USACE District]': (fmt) => fmt.usaceDistrict,
  '[Name from USGS 7.5-minute topo or state GIS]': (fmt) => `[Name from USGS 7.5-minute topo or state GIS — ${fmt.airAgencyAbbr} jurisdiction]`,
  '[State Agency — Permit Section]': (fmt) => `${fmt.airAgency} — Permit Review Section`,
  '[State Air Agency - Permit Section]': (fmt) => `${fmt.airAgency} — Permit Review Section`,
  '[state agency]': (fmt) => fmt.airAgency,
  '[State agency]': (fmt) => fmt.airAgency,
  '[name of water quality agency]': (fmt) => fmt.waterAgency,
  '[Local sewer authority name and address]': (fmt) => `[Local sewer authority — ${fmt.waterAgency} jurisdiction]`,
  '[Sewer manhole ID / GPS coordinates]': (fmt) => `[Site-specific manhole ID / GPS coordinates — report to ${fmt.waterAgency}]`,
  '[Surface water/POTW]': (fmt) => `[Surface water / ${fmt.waterAgency} POTW — confirm discharge pathway]`,
  '[check Federal Register for current date cutoff]': (fmt) => `[Check Federal Register for current cutoff date — consult ${fmt.airAgencyAbbr} for effective date]`,
};

// Complete list of document sections where placeholder replacement is needed
export function replacePlaceholders(text, stateFormat) {
  if (!text || !stateFormat) return text || '';
  let result = text;
  for (const [placeholder, resolver] of Object.entries(PLACEHOLDER_RESOLVERS)) {
    if (result.includes(placeholder)) {
      result = result.replaceAll(placeholder, resolver(stateFormat));
    }
  }
  return result;
}

// ─── State Certification Application ──────────────────────────────────────────
// Appends state-specific certifications and disclaimers to document content.

function appendStateCertifications(sections, state, stateFormat, docKey) {
  if (!stateFormat || state === 'Alaska' || state === 'Hawaii') return sections;

  const overrides = getStateOverrides(state);
  const isAir = docKey.startsWith('air');
  const certKey = isAir ? 'air' : 'water';

  // Get state-specific certification text
  const stateCert = overrides?._certifications?.[certKey];
  const formatCert = stateFormat.certifications?.[certKey];

  if (!stateCert && !formatCert) return sections;

  const certText = stateCert || formatCert;

  // Append certification section
  return [
    ...sections,
    {
      heading: `${stateFormat.airAgencyAbbr.toUpperCase()} — STATE-SPECIFIC CERTIFICATION`,
      body: certText,
    },
    {
      heading: 'REGULATORY CROSS-REFERENCE',
      body: `Primary state regulation: ${stateFormat.crossReference}\nPermitting portal: ${stateFormat.airPortal || 'State electronic permitting system'}\nPublic notice period: ${stateFormat.publicNoticeDays} days`,
    },
  ];
}

// ─── Form Adaptation ──────────────────────────────────────────────────────────
// Adapts the document structure for state-specific format requirements.

function adaptFormFormat(sections, state, docKey, stateFormat) {
  const replacement = getStateDocReplacement(state, docKey);
  if (!replacement) return sections;

  // Document-level format adaptation — for now, add a note
  return [
    ...sections,
    {
      heading: 'STATE-SPECIFIC FORM NOTE',
      body: `This document corresponds to: ${replacement.format}\n${replacement.description}\n\nThis document has been adapted for the ${stateFormat.airAgencyAbbr} permitting format. Verify specific form requirements with the agency before submission.`,
    },
  ];
}

// ─── Portal & Submission Info ─────────────────────────────────────────────────

function appendSubmissionInfo(sections, state, stateFormat) {
  const reqs = getStateSubmissionRequirements(state);
  if (!reqs) return sections;

  return [
    ...sections,
    {
      heading: 'SUBMISSION REQUIREMENTS',
      body: `Electronic submission: ${reqs.electronicSubmission}\nRequired forms: ${reqs.requiredForms.join(', ')}\nFee schedule: ${reqs.feeSchedule}\nExpected timeline: ${reqs.timeline}`,
    },
  ];
}

// ─── Main Conversion Function ─────────────────────────────────────────────────

export function convertForState(docContent, state, docKey, inputs, results) {
  if (!docContent || !state) return docContent;

  const stateFormat = getStateFormat(state);

  // 1. Replace all placeholders in all section bodies
  const adaptedSections = docContent.sections.map((section) => ({
    ...section,
    body: replacePlaceholders(section.body, stateFormat),
  }));

  // 2. Append state-specific certification
  const withCert = appendStateCertifications(adaptedSections, state, stateFormat, docKey);

  // 3. Adapt form format if state has specific formats
  const withForm = adaptFormFormat(withCert, state, docKey, stateFormat);

  // 4. Append portal/submission info
  const withPortal = appendSubmissionInfo(withForm, state, stateFormat);

  return {
    ...docContent,
    sections: withPortal,
    formatInstructions: {
      agency: stateFormat.airAgency,
      portal: stateFormat.airPortal,
      formFormat: stateFormat.airFormFormat,
      requiresCEQA: stateFormat.requiresCEQA || false,
      requiresScoping: stateFormat.requiresScoping || false,
      publicNoticeDays: stateFormat.publicNoticeDays,
    },
    formFormat: stateFormat.airFormFormat,
    submissionPortal: stateFormat.airPortal,
  };
}

// ─── Direct Utility ──────────────────────────────────────────────────────────

export function getStateLabel(state) {
  const fmt = getStateFormat(state);
  if (fmt === DEFAULT_STATE_FORMAT) return state;
  return `${state} — ${fmt.airAgencyAbbr}`;
}

export function getAgencyName(state) {
  const fmt = getStateFormat(state);
  return fmt.airAgency;
}

export function getPortalName(state) {
  const fmt = getStateFormat(state);
  return fmt.airPortal;
}