import { searchStateRules } from '../rag/vectorStore.js';
import { STATES_ATTAINMENT } from '../../../permitOS/src/data/permitData.js';

export function toolStateLookup(args) {
  const { state, query } = args || {};
  if (!state) return { error: 'State is required' };

  const attainment = STATES_ATTAINMENT[state] || 'Unknown';

  let rules = [];
  if (query) {
    rules = searchStateRules(state, query);
  } else {
    rules = searchStateRules(state, null, 20);
  }

  return {
    state,
    attainment_status: attainment,
    rules_found: rules.length,
    rules: rules.map(r => ({
      category: r.category,
      rule_name: r.rule_name,
      citation: r.citation,
      summary: r.rule_text.substring(0, 400) + (r.rule_text.length > 400 ? '...' : ''),
    })),
  };
}

export const stateLookupTool = {
  name: 'state_lookup',
  description: 'Look up state-specific environmental regulations and NAAQS attainment status',
  parameters: {
    type: 'object',
    properties: {
      state: { type: 'string', description: 'State name (e.g., "Virginia", "Texas", "Tennessee")' },
      query: { type: 'string', description: 'Optional search within state rules' },
    },
    required: ['state'],
  },
  handler: toolStateLookup,
};