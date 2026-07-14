import React, { useState } from 'react';

export default function Header({ activeTab, setActiveTab, results, inputs, onLogout }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasResults = !!results;
  const permitTypes = inputs?.permitTypesNeeded || ['air', 'water', 'building', 'power'];

  const allTabs = [
    { id: 'overview',    label: 'Platform Overview',   icon: '\u{1F3DB}',  group: 'start' },
    { id: 'executive',   label: 'Executive Summary',   icon: '\u{1F4CA}',  group: 'start' },
    { id: 'siteplanner', label: 'Site Planner',         icon: '\u{1F5FA}',  group: 'start' },
    { id: 'intake',      label: 'Site Intake',          icon: '\u{1F4CB}',  group: 'work' },
    { id: 'air',         label: 'Air Permit AI',        icon: '\u{1F4A8}',  group: 'work', permitKey: 'air' },
    { id: 'water',       label: 'Water Permit AI',      icon: '\u{1F4A7}',  group: 'work', permitKey: 'water' },
    { id: 'building',    label: 'Building Permitting',    icon: '\u{1F3D7}\uFE0F', group: 'work', permitKey: 'building' },
    { id: 'power',       label: 'Power Permitting',       icon: '\u26A1', group: 'work', permitKey: 'power' },
    { id: 'milestones',  label: 'Milestone Timeline',   icon: '\u{1F4C5}',  group: 'work' },
    { id: 'docs',        label: 'Document Factory',     icon: '\u{1F4C4}',  group: 'work' },
    { id: 'simulation',  label: 'Digital Twin',         icon: '\u26A1',  group: 'advanced' },
    { id: 'compliance',  label: 'Compliance OS',        icon: '\u{1F6E1}',  group: 'advanced' },
    { id: 'copilot',     label: 'Regulator Copilot',    icon: '\u{1F916}',  group: 'advanced' },
    { id: 'knowledge',   label: 'Knowledge Hub',        icon: '\u{1F4DA}',  group: 'advanced' },
    { id: 'construction', label: 'Construction Platform', icon: '\u{1F3D7}\uFE0F', group: 'advanced' },
  ];

  const tabs = allTabs.filter(t => {
    if (!t.permitKey) return true;
    return permitTypes.includes(t.permitKey);
  });

  return (
    <div className="bg-gray-950 border-b border-gray-800 sticky top-0 z-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <span className="text-white font-semibold text-sm">Brick PermitOS</span>
            <span className="text-gray-500 text-xs ml-2 hidden md:inline">— Data Center Permitting Intelligence</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasResults && (
            <span className="bg-green-900/40 text-green-400 text-xs px-2.5 py-1 rounded-full border border-green-800/60 hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              Site Loaded
            </span>
          )}
          <span className="bg-green-900/40 text-green-400 text-xs px-2.5 py-1 rounded-full border border-green-800/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            Live Demo
          </span>
          <span className="bg-indigo-900/40 text-indigo-300 text-xs px-2.5 py-1 rounded-full border border-indigo-800/60 hidden sm:block">
            EPA Regulatory Framework
          </span>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800/40 hover:bg-gray-800 rounded-lg px-2.5 py-1.5 border border-gray-700/60 transition-colors flex items-center gap-1"
              title="Sign out"
            >
              Logout
            </button>
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
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all
                  ${activeTab === t.id
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
            {group !== 'advanced' && (
              <div className="w-px bg-gray-800/60 my-1.5 mx-1 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Mobile tab nav */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-400"
        >
          <span className="flex items-center gap-2">
            <span>{tabs.find(t => t.id === activeTab)?.icon}</span>
            {tabs.find(t => t.id === activeTab)?.label}
          </span>
          <span>{mobileOpen ? '\u25B2' : '\u25BC'}</span>
        </button>
        {mobileOpen && (
          <div className="bg-gray-900 border-t border-gray-800 grid grid-cols-2 gap-1 p-2">
            {tabs.map(t => (
              <button key={t.id}
                onClick={() => { setActiveTab(t.id); setMobileOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs rounded-lg transition-all text-left
                  ${activeTab === t.id ? 'bg-indigo-700/40 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'}`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}