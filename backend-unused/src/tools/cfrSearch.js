import { searchRegulations } from '../rag/vectorStore.js';

export function toolCFRSearch(args) {
  const { query, category, limit = 8 } = args || {};
  if (!query) return { error: 'Query is required' };

  const results = searchRegulations(query, { category, limit });

  return {
    found: results.length,
    results: results.map(r => ({
      cfr: `${r.cfr_title} CFR Part ${r.cfr_part}${r.cfr_section ? ' ' + r.cfr_section : ''}`,
      category: r.subcategory || r.category,
      relevance: Math.round(r.score * 100),
      text: r.chunk_text.substring(0, 500) + (r.chunk_text.length > 500 ? '...' : ''),
    })),
  };
}

export const cfrSearchTool = {
  name: 'cfr_search',
  description: 'Search EPA CFR regulations relevant to air and water permitting for data centers',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query, e.g. "PSD major source threshold NOx"' },
      category: { type: 'string', enum: ['air', 'water'], description: 'Filter to air or water regulations' },
      limit: { type: 'number', description: 'Maximum results to return (default 8)' },
    },
    required: ['query'],
  },
  handler: toolCFRSearch,
};