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
import KnowledgeHub from './components/KnowledgeHub';
import SitePlanner from './components/SitePlanner';
import SiteAssistant from './components/SiteAssistant';
import BuildingPermitAI from './components/BuildingPermitAI';
import PowerPermitAI from './components/PowerPermitAI';
import ConstructionDashboard from './components/ConstructionDashboard';
import { isAuthenticated, getAuthToken, setAuthToken, logout, startTokenExpiryCheck, stopTokenExpiryCheck } from './utils/api';

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
  permitTypesNeeded: null,
};

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [inputs, setInputs] = useState(defaultInputs);
  const [results, setResults] = useState(null);
  const [selectedDocKey, setSelectedDocKey] = useState(null);

  useEffect(() => {
    // Check for existing token on mount
    const token = getAuthToken();
    if (token) {
      setAuthenticated(true);
    }
    setAuthChecked(true);

    // Start proactive token expiry check (every 60s)
    startTokenExpiryCheck();

    // Listen for session expiry events from api.js
    const handleSessionExpired = () => {
      setAuthenticated(false);
      setSessionExpiredMessage('Your session expired — please sign in again.');
    };
    window.addEventListener('permitos:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('permitos:session-expired', handleSessionExpired);
      stopTokenExpiryCheck();
    };
  }, []);

  const handleAuth = () => {
    setAuthenticated(true);
    setSessionExpiredMessage('');
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
  };

  const handleNavigateDoc = (key) => {
    setSelectedDocKey(key);
    setActiveTab('docs');
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':    return <Overview setActiveTab={setActiveTab} />;
      case 'siteplanner': return <SitePlanner inputs={inputs} setInputs={setInputs} setActiveTab={setActiveTab} />;
      case 'intake':      return <SiteIntake inputs={inputs} setInputs={setInputs} results={results} setResults={setResults} setActiveTab={setActiveTab} />;
      case 'air':         return <AirPermitAI results={results} inputs={inputs} />;
      case 'water':       return <WaterPermitAI results={results} inputs={inputs} />;
      case 'milestones':  return <MilestoneTimeline results={results} inputs={inputs} />;
      case 'docs':        return <DocumentFactory results={results} inputs={inputs} selectedDocKey={selectedDocKey} onClearSelection={() => setSelectedDocKey(null)} />;
      case 'simulation':  return <DigitalTwin results={results} inputs={inputs} />;
      case 'compliance':  return <ComplianceOS results={results} inputs={inputs} onNavigateDoc={handleNavigateDoc} />;
      case 'copilot':     return <RegulatorCopilot results={results} inputs={inputs} />;
      case 'executive':   return <ExecutiveSummary results={results} inputs={inputs} setActiveTab={setActiveTab} />;
      case 'knowledge':   return <KnowledgeHub inputs={inputs} results={results} />;
      case 'building':    return <BuildingPermitAI inputs={inputs} results={results} setActiveTab={setActiveTab} />;
      case 'power':       return <PowerPermitAI inputs={inputs} results={results} setActiveTab={setActiveTab} />;
      case 'construction': return <ConstructionDashboard inputs={inputs} results={results} setActiveTab={setActiveTab} />;
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

  if (!authenticated) {
    return <AuthModal onAuth={handleAuth} sessionExpiredMessage={sessionExpiredMessage} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} results={results} inputs={inputs} onLogout={handleLogout} />
      <main className="max-w-[1400px] mx-auto">
        {renderTab()}
      </main>
      <SiteAssistant inputs={inputs} results={results} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
