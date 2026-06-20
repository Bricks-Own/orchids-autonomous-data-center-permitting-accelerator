import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
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
import { getAuthToken, logout } from './utils/api';

const WORKSPACE_KEY = 'permitos_demo_workspace';
const DEMO_MODE_KEY = 'permitos_demo_mode';

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
  const [authenticated, setAuthenticated] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [inputs, setInputs] = useState(defaultInputs);
  const [results, setResults] = useState(null);
  const [selectedDocKey, setSelectedDocKey] = useState(null);

  useEffect(() => {
    const token = getAuthToken();
    const storedDemoMode = localStorage.getItem(DEMO_MODE_KEY) === 'true';
    const storedWorkspace = localStorage.getItem(WORKSPACE_KEY);

    if (token) {
      setAuthenticated(true);
    } else if (storedDemoMode) {
      setDemoMode(true);
    }

    if (storedWorkspace) {
      try {
        const workspace = JSON.parse(storedWorkspace);
        if (workspace.inputs) setInputs({ ...defaultInputs, ...workspace.inputs });
        if (workspace.results) setResults(workspace.results);
      } catch {
        localStorage.removeItem(WORKSPACE_KEY);
      }
    }

    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked || (!authenticated && !demoMode)) return;
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ inputs, results }));
  }, [inputs, results, authenticated, demoMode, authChecked]);

  const handleAuth = () => {
    localStorage.removeItem(DEMO_MODE_KEY);
    setDemoMode(false);
    setAuthenticated(true);
  };

  const handleDemo = () => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    setDemoMode(true);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem(DEMO_MODE_KEY);
    setAuthenticated(false);
    setDemoMode(false);
  };

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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (!authenticated && !demoMode) {
    return <AuthModal onAuth={handleAuth} onDemo={handleDemo} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        results={results}
        onLogout={handleLogout}
        demoMode={demoMode}
      />
      <main className="max-w-[1400px] mx-auto">
        {renderTab()}
      </main>
    </div>
  );
}

export default App;
