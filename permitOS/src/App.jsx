import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import Overview from './components/Overview';
import SiteIntake from './components/SiteIntake';
import Permits from './components/Permits';
import MilestoneTimeline from './components/MilestoneTimeline';
import DocumentFactory from './components/DocumentFactory';
import DigitalTwin from './components/DigitalTwin';
import ComplianceOS from './components/ComplianceOS';
import RegulatorCopilot from './components/RegulatorCopilot';
import ExecutiveSummary from './components/ExecutiveSummary';
import KnowledgeHub from './components/KnowledgeHub';
import SitePlanner from './components/SitePlanner';
import SiteAssistant from './components/SiteAssistant';
import ConstructionDashboard from './components/ConstructionDashboard';
import { usePermitData } from './context/PermitDataContext';
import { isAuthenticated, getAuthToken, setAuthToken, logout, startTokenExpiryCheck, stopTokenExpiryCheck } from './utils/api';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from './components/ui/sidebar';
import {
  Compass, ChartBar, MapPin, Clipboard,
  CalendarCheck, FileText, Cube, ShieldCheck, Robot, Books, Wrench,
  SignOut, ShieldCheck as ShieldLogo, SidebarIcon as PanelLeft
} from '@phosphor-icons/react';


const tabIcons = {
  overview: Compass,
  executive: ChartBar,
  siteplanner: MapPin,
  intake: Clipboard,
  permits: ShieldCheck,
  milestones: CalendarCheck,
  docs: FileText,
  simulation: Cube,
  compliance: ShieldCheck,
  copilot: Robot,
  knowledge: Books,
  construction: Wrench,
};

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname === '/' ? 'overview' : location.pathname.slice(1);
  const setActiveTab = (tab) => navigate(tab === 'overview' ? '/' : `/${tab}`);
  const { inputs, results } = usePermitData();
  const [selectedDocKey, setSelectedDocKey] = useState(null);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      setAuthenticated(true);
    }
    setAuthChecked(true);

    startTokenExpiryCheck();

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

  const renderRoutes = () => (
    <Routes>
      <Route path="/" element={<Overview setActiveTab={setActiveTab} />} />
      <Route path="/siteplanner" element={<SitePlanner setActiveTab={setActiveTab} />} />
      <Route path="/intake" element={<SiteIntake setActiveTab={setActiveTab} />} />
      <Route path="/permits" element={<Permits setActiveTab={setActiveTab} />} />
      <Route path="/milestones" element={<MilestoneTimeline setActiveTab={setActiveTab} />} />
      <Route path="/docs" element={<DocumentFactory selectedDocKey={selectedDocKey} onClearSelection={() => setSelectedDocKey(null)} />} />
      <Route path="/simulation" element={<DigitalTwin />} />
      <Route path="/compliance" element={<ComplianceOS onNavigateDoc={handleNavigateDoc} />} />
      <Route path="/copilot" element={<RegulatorCopilot />} />
      <Route path="/executive" element={<ExecutiveSummary setActiveTab={setActiveTab} />} />
      <Route path="/knowledge" element={<KnowledgeHub />} />
      <Route path="/construction" element={<ConstructionDashboard setActiveTab={setActiveTab} />} />
    </Routes>
  );

  const renderSidebarNavItem = (tabId, label, onPress) => {
    const Icon = tabIcons[tabId];
    const isActive = activeTab === tabId;
    return (
      <SidebarMenuItem key={tabId}>
        <SidebarMenuButton isActive={isActive} onClick={() => { setActiveTab(tabId); onPress?.(); }}>
          {Icon && <Icon weight={isActive ? "fill" : "duotone"} />}
          <span className="truncate">{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthModal onAuth={handleAuth} sessionExpiredMessage={sessionExpiredMessage} />;
  }

  const permitTypes = [
    inputs?.hasOnSiteGeneration !== false && 'air',
    inputs?.hasWaterUse !== false && 'water',
    inputs?.hasNewConstruction !== false && 'building',
    inputs?.hasGridInterconnection !== false && 'power',
  ].filter(Boolean);

  const allTabs = [
    { id: 'overview',    label: 'Platform Overview',   group: 'start' },
    { id: 'executive',   label: 'Executive Summary',   group: 'start' },
    { id: 'siteplanner', label: 'Site Planner',         group: 'start' },
    { id: 'intake',      label: 'Site Intake',          group: 'work', permitKey: true },
    { id: 'permits',     label: 'Permits',              group: 'work', permitKey: true },
    { id: 'milestones',  label: 'Milestone Timeline',   group: 'work', permitKey: true },
    { id: 'docs',        label: 'Document Factory',     group: 'work', permitKey: true },
    { id: 'simulation',  label: 'Digital Twin',         group: 'advanced' },
    { id: 'compliance',  label: 'Compliance OS',        group: 'advanced' },
    { id: 'copilot',     label: 'Regulator Copilot',    group: 'advanced' },
    { id: 'knowledge',   label: 'Knowledge Hub',        group: 'advanced' },
    { id: 'construction', label: 'Construction Platform', group: 'advanced' },
  ];

  const filteredTabs = allTabs.filter(t => {
    if (t.permitKey === true) return true;
    if (!t.permitKey) return true;
    return permitTypes.includes(t.permitKey);
  });

  const groupedTabs = {
    start: filteredTabs.filter(t => t.group === 'start'),
    work: filteredTabs.filter(t => t.group === 'work'),
    advanced: filteredTabs.filter(t => t.group === 'advanced'),
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-svh w-full">
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarHeader className="group-data-[collapsible=icon]:px-0">
            <div className="flex items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
              <div className="w-9 h-9 bg-primary flex items-center justify-center shrink-0">
                <ShieldLogo className="w-5 h-5 text-primary-foreground" weight="duotone" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden flex-1">
                <span className="text-foreground font-semibold text-sm font-heading">Brick PermitOS</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Overview</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupedTabs.start.map(t => renderSidebarNavItem(t.id, t.label))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Permitting</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupedTabs.work.map(t => renderSidebarNavItem(t.id, t.label))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Advanced</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupedTabs.advanced.map(t => renderSidebarNavItem(t.id, t.label))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarFooterContent onLogout={handleLogout} />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="overflow-x-hidden">
          <Header activeTab={activeTab} onLogout={handleLogout} />
          <main className="max-w-[1400px] mx-auto w-full px-4 md:px-6">
            {renderRoutes()}
          </main>
          <SiteAssistant setActiveTab={setActiveTab} />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function SidebarFooterContent({ onLogout }) {
  const { toggleSidebar } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={toggleSidebar}>
          <PanelLeft weight="duotone" />
          <span>Collapse</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={onLogout}>
          <SignOut weight="duotone" />
          <span>Sign Out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export default App;