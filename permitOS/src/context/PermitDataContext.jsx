import React, { createContext, useContext, useState } from 'react';

const PermitDataContext = createContext(null);

export const defaultInputs = {
  siteName: 'BigWatt AI Campus - Site A',
  client: 'BigWatt Digital',
  state: 'Tennessee',
  county: 'Davidson County',
  address: '1200 Industrial Blvd, Nashville, TN 37201',
  lat: '36.1627',
  lon: '-86.7816',
  turbineType: 'Gas Turbine (DLN, modern)',
  turbines: 8,
  mwPerTurbine: 25,
  hours: 6000,
  heatRate: 8.5,
  noxFactor: 0.015,
  coFactor: 0.035,
  brickSavings: 20,
  gensetCount: 12,
  gensetHP: 2000,
  gensetHours: 100,
  coolingMGD: 2.8,
  blowdownPct: 20,
  waterMGD: 1.2,
  datacenterMW: 133,
  pueTarget: 1.35,
  phases: 3,
  codTarget: '2026-Q3',
  siteAcres: 45,
  stackHeight: 65,
  nearestReceptorFt: 1200,
  nonAttainment: false,
  hasOnSiteGeneration: true,
  hasWaterUse: true,
  hasNewConstruction: true,
  hasGridInterconnection: true,
  projectScenario: 'greenfield',
};

export function PermitDataProvider({ children }) {
  const [inputs, setInputs] = useState(defaultInputs);
  const [results, setResults] = useState(null);
  return (
    <PermitDataContext.Provider value={{ inputs, setInputs, results, setResults }}>
      {children}
    </PermitDataContext.Provider>
  );
}

export function usePermitData() {
  const ctx = useContext(PermitDataContext);
  if (!ctx) throw new Error('usePermitData must be used within PermitDataProvider');
  return ctx;
}