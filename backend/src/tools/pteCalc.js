import { calcPTE } from '../../../permitOS/src/utils/calculations.js';

export function toolPTECalculator(args) {
  const inputs = args?.inputs;
  if (!inputs) return { error: 'Inputs are required (turbines, mwPerTurbine, hours, heatRate, noxFactor, etc.)' };

  try {
    const results = calcPTE(inputs);
    return {
      totalMW: results.totalMW,
      annualMMBtu: results.annualMMBtu,
      baseline: results.baseline,
      controlled: results.controlled,
      avoided: results.avoided,
      pathway: results.pathway,
      water: results.water,
      genset: results.genset,
    };
  } catch (err) {
    return { error: `PTE calculation failed: ${err.message}` };
  }
}

export const pteCalcTool = {
  name: 'pte_calculator',
  description: 'Calculate Potential to Emit (PTE) for a data center site given equipment parameters',
  parameters: {
    type: 'object',
    properties: {
      inputs: {
        type: 'object',
        description: 'Site equipment parameters',
        properties: {
          turbines: { type: 'number' }, mwPerTurbine: { type: 'number' },
          hours: { type: 'number' }, heatRate: { type: 'number' },
          noxFactor: { type: 'number' }, coFactor: { type: 'number' },
          brickSavings: { type: 'number' },
          gensetCount: { type: 'number' }, gensetHP: { type: 'number' }, gensetHours: { type: 'number' },
          coolingMGD: { type: 'number' }, blowdownPct: { type: 'number' }, waterMGD: { type: 'number' },
        },
        required: ['turbines', 'mwPerTurbine', 'hours', 'heatRate'],
      },
    },
    required: ['inputs'],
  },
  handler: toolPTECalculator,
};