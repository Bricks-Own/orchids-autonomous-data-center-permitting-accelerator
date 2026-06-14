import React, { useState } from 'react';
import Header from './components/Header';
import Overview from './components/Overview';
import SiteIntake from './components/SiteIntake';
import AirPermitAI from './components/AirPermitAI';
import WaterPermitAI from './components/WaterPermitAI';
import MilestoneTimeline from './components/MilestoneTimeline';
import DocumentFactory from './components/DocumentFactory';
import DigitalTwin from './components/DigitalTwin';
import ComplianceOS from './components/ComplianceOS';
import RegulatorCopilot from './components/RegulatorCopilot';
import ExecutiveSummary from './components/ExecutiveSummary';

export const defaultInputs = {
  siteName: 'BigWatt AI Campus — Site A',
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
  brickSavings: 14,
  gensetCount: 12,
  gensetHP: 2000,
  gensetHours: 200,
  coolingMGD: 2.8,
  blowdownPct: 20,
  waterMGD: 1.2,
  datacenterMW: 160,
  pueTarget: 1.35,
  phases: 3,
  codTarget: '2026-Q3',
  siteAcres: 45,
  stackHeight: 65,
  nearestReceptorFt: 1200,
  nonAttainment: false,
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [inputs, setInputs] = useState(defaultInputs);
  const [results, setResults] = useState(null);
  const [selectedDocKey, setSelectedDocKey] = useState(null);

  const handleNavigateDoc = (key) => {
    setSelectedDocKey(key);
    setActiveTab('docs');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':    return <Overview setActiveTab={setActiveTab} />;
      case 'intake':      return <SiteIntake inputs={inputs} setInputs={setInputs} results={results} setResults={setResults} setActiveTab={setActiveTab} />;
      case 'air':         return <AirPermitAI results={results} inputs={inputs} />;
      case 'water':       return <WaterPermitAI results={results} inputs={inputs} />;
      case 'milestones':  return <MilestoneTimeline results={results} inputs={inputs} />;
      case 'docs':        return <DocumentFactory results={results} inputs={inputs} selectedDocKey={selectedDocKey} onClearSelection={() => setSelectedDocKey(null)} />;
      case 'simulation':  return <DigitalTwin results={results} inputs={inputs} />;
      case 'compliance':  return <ComplianceOS results={results} inputs={inputs} onNavigateDoc={handleNavigateDoc} />;
      case 'copilot':     return <RegulatorCopilot results={results} inputs={inputs} />;
      case 'executive':   return <ExecutiveSummary results={results} inputs={inputs} setActiveTab={setActiveTab} />;
      default:            return <Overview setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} results={results} />
      <main className="max-w-[1400px] mx-auto">
        {renderTab()}
      </main>
    </div>
  );
}

export default App;
