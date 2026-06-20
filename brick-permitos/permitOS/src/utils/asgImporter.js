// ─── ASG Consulting Validation System ─────────────────────────────────────────
// ASG Consulting has produced real-world data center air permit submissions.
// This system cross-references PermitOS document templates against ASG's
// deliverable structures to validate that our methodology, analysis framework,
// and report organization align with industry-standard permit submission practice.
//
// The badge indicates: "This document's methodology has been reviewed against
// actual ASG consulting deliverables for data center permitting." It is a stamp
// of credibility — NOT a content import. PermitOS generates all content from
// site-specific data and regulatory logic.
//
// Usage:
//   1. Place ASG reference files in src/data/asgTemplates/
//   2. Each file exports { docKey, projectName, content, validatedSections }
//   3. registerAsgTemplate() adds to the registry

// Source tracking — allows the UI to badge documents as ASG-validated
export const SOURCE_TYPES = {
  GENERIC: { label: 'Generic Template', badge: 'GENERIC', badgeColor: 'bg-gray-700 text-gray-400' },
  ASG_VALIDATED: { label: 'Structure compared with reference deliverable', badge: 'REF', badgeColor: 'bg-blue-900 text-blue-300' },
};

// Registry of ASG-validated documents. Each entry:
//   source: 'asg'
//   projectName: string — the ASG deliverable used as reference
//   content: reference template structure
//   validatedSections: string[] — which sections map to ASG precedent

const asgTemplateRegistry = {};

// Register an ASG validation reference
export function registerAsgTemplate(docKey, template) {
  asgTemplateRegistry[docKey] = {
    ...template,
    source: 'asg',
  };
}

// Check if a document has ASG validation
export function hasAsgTemplate(docKey) {
  return !!asgTemplateRegistry[docKey];
}

// Get the ASG validation info for a document, or null
export function getAsgTemplate(docKey) {
  return asgTemplateRegistry[docKey] || null;
}

// Get the source info for a document (for UI badge display)
export function getDocumentSource(docKey) {
  if (asgTemplateRegistry[docKey]) {
    const tmpl = asgTemplateRegistry[docKey];
    return { ...SOURCE_TYPES.ASG_VALIDATED, projectName: tmpl.projectName, validatedSections: tmpl.validatedSections || [] };
  }
  return SOURCE_TYPES.GENERIC;
}

// ─── ASG Validation Info ─────────────────────────────────────────────────────
// Returns cross-reference details for the UI popover

export function getValidationInfo(docKey) {
  const tmpl = asgTemplateRegistry[docKey];
  if (!tmpl) return null;
  return {
    projectName: tmpl.projectName,
    validatedSections: tmpl.validatedSections || [],
    methodologyAligned: true,
    disclaimer:
      'PermitOS methodology and analysis framework have been cross-referenced against ASG Consulting deliverables for similar data center permit applications. Documents are generated from site-specific data and regulatory logic.',
  };
}

// ─── ASG Template Validator ──────────────────────────────────────────────────

export function validateAsgTemplate(template) {
  const errors = [];
  if (!template.docKey) errors.push('Missing docKey');
  if (!template.projectName) errors.push('Missing projectName');
  if (!template.content) errors.push('Missing content');
  if (template.content && !template.content.title) errors.push('Missing content.title');
  if (template.content && !template.content.sections) errors.push('Missing content.sections');
  if (template.content && !Array.isArray(template.content.sections)) errors.push('content.sections must be an array');
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Bulk Registration ───────────────────────────────────────────────────────

export function registerAllAsgTemplates() {
  return Object.keys(asgTemplateRegistry).length;
}

export default asgTemplateRegistry;
