import { generateDocument } from '../../../permitOS/src/utils/documentGenerator.js';

export function toolDocGen(args) {
  const { type, num, inputs, results } = args || {};
  if (!type || num === undefined || num === null) return { error: 'type (air/water) and num are required' };

  try {
    const doc = generateDocument(type, parseInt(num), inputs, results);
    if (!doc) return { error: `Document ${type}_${num} could not be generated — invalid type or number` };
    return {
      docNum: doc.docNum,
      title: doc.title,
      sections: doc.sections.length,
      wordCount: doc.sections.reduce((s, sec) => s + sec.body.split(/\s+/).length, 0),
      content: doc.sections.map(sec => `## ${sec.heading}\n\n${sec.body}`).join('\n\n'),
    };
  } catch (err) {
    return { error: `Document generation failed: ${err.message}` };
  }
}

export const docGenTool = {
  name: 'document_generator',
  description: 'Generate a specific permit document (air or water) with site-specific content and citations',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['air', 'water'], description: 'Document type' },
      num: { type: 'number', description: 'Document number (1-16 for air, 1-10 for water)' },
      inputs: { type: 'object', description: 'Site inputs object' },
      results: { type: 'object', description: 'PTE calculation results object' },
    },
    required: ['type', 'num'],
  },
  handler: toolDocGen,
};