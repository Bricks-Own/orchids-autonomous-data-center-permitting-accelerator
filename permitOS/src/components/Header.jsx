import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import {
  Compass, ChartBar, MapPin, Clipboard, Wind, Drop, Building, Lightning,
  CalendarCheck, FileText, Cube, ShieldCheck, Robot, Books, Wrench,
  CaretDown, CaretUp, SignOut, ShieldCheck as ShieldLogo
} from '@phosphor-icons/react';

const tabIcons = {
  overview: Compass,
  executive: ChartBar,
  siteplanner: MapPin,
  intake: Clipboard,
  air: Wind,
  water: Drop,
  building: Building,
  power: Lightning,
  milestones: CalendarCheck,
  docs: FileText,
  simulation: Cube,
  compliance: ShieldCheck,
  copilot: Robot,
  knowledge: Books,
  construction: Wrench,
};

export default function Header({ activeTab, setActiveTab, results, inputs, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasResults = !!results;
  const permitTypes = inputs?.permitTypesNeeded || ['air', 'water', 'building', 'power'];

  const allTabs = [
    { id: 'overview',    label: 'Platform Overview',   icon: 'overview',    group: 'start' },
    { id: 'executive',   label: 'Executive Summary',   icon: 'executive',   group: 'start' },
    { id: 'siteplanner', label: 'Site Planner',         icon: 'siteplanner', group: 'start' },
    { id: 'intake',      label: 'Site Intake',          icon: 'intake',      group: 'work' },
    { id: 'air',         label: 'Air Permit AI',        icon: 'air',         group: 'work', permitKey: 'air' },
    { id: 'water',       label: 'Water Permit AI',      icon: 'water',       group: 'work', permitKey: 'water' },
    { id: 'building',    label: 'Building Permitting',    icon: 'building',  group: 'work', permitKey: 'building' },
    { id: 'power',       label: 'Power Permitting',       icon: 'power',     group: 'work', permitKey: 'power' },
    { id: 'milestones',  label: 'Milestone Timeline',   icon: 'milestones',  group: 'work' },
    { id: 'docs',        label: 'Document Factory',     icon: 'docs',        group: 'work' },
    { id: 'simulation',  label: 'Digital Twin',         icon: 'simulation',  group: 'advanced' },
    { id: 'compliance',  label: 'Compliance OS',        icon: 'compliance',  group: 'advanced' },
    { id: 'copilot',     label: 'Regulator Copilot',    icon: 'copilot',     group: 'advanced' },
    { id: 'knowledge',   label: 'Knowledge Hub',        icon: 'knowledge',   group: 'advanced' },
    { id: 'construction', label: 'Construction Platform', icon: 'construction', group: 'advanced' },
  ];

  const tabs = allTabs.filter(t => {
    if (!t.permitKey) return true;
    return permitTypes.includes(t.permitKey);
  });

  const renderIcon = (iconKey, className = 'w-3.5 h-3.5') => {
    const Icon = tabIcons[iconKey];
    return Icon ? <Icon className={className} weight="duotone" /> : null;
  };

  return (
    <div className="bg-background border-b border-border sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary flex items-center justify-center">
            <ShieldLogo className="w-4 h-4 text-primary-foreground" weight="duotone" />
          </div>
          <div>
            <span className="text-foreground font-semibold text-sm font-heading">Brick PermitOS</span>
            <span className="text-muted-foreground text-xs ml-2 hidden md:inline">— Data Center Permitting Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasResults && (
            <Badge variant="secondary" className="gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Site Loaded
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live Demo
          </Badge>
          <Badge variant="secondary" className="hidden sm:flex">
            EPA Regulatory Framework
          </Badge>
          {onLogout && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="gap-1">
                  <SignOut className="w-3 h-3" weight="duotone" />
                  Logout
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onLogout} variant="destructive">
                  <SignOut className="w-3.5 h-3.5" weight="duotone" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {/* Tab nav — desktop */}
      <div className="hidden md:flex overflow-x-auto scrollbar-none px-2">
        {['start', 'work', 'advanced'].map(group => (
          <React.Fragment key={group}>
            {tabs.filter(t => t.group === group).map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold tracking-wider whitespace-nowrap border-b-2 transition-all uppercase
                  ${activeTab === t.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }`}
              >
                {renderIcon(t.icon)}
                {t.label}
              </button>
            ))}
            {group !== 'advanced' && (
              <Separator orientation="vertical" className="my-1.5 mx-1 h-6" />
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Mobile tab nav */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            {renderIcon(tabs.find(t => t.id === activeTab)?.icon)}
            {tabs.find(t => t.id === activeTab)?.label}
          </span>
          {mobileOpen ? <CaretUp className="w-3 h-3" weight="duotone" /> : <CaretDown className="w-3 h-3" weight="duotone" />}
        </button>
        {mobileOpen && (
          <div className="bg-card border-t border-border grid grid-cols-2 gap-1 p-2">
            {tabs.map(t => (
              <button key={t.id}
                onClick={() => { setActiveTab(t.id); setMobileOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs transition-all text-left uppercase tracking-wider
                  ${activeTab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                {renderIcon(t.icon)}
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}