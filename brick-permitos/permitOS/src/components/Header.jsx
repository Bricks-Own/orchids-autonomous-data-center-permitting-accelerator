import React, { useState } from 'react';

export default function Header({ activeTab, setActiveTab, results, onLogout, demoMode = false }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasResults = !!results;

  const tabs = [
    { id: 'overview',    label: 'Platform Overview',   icon: '🏛',  group: 'start' },
    { id: 'executive',   label: 'Executive Summary',   icon: '📊',  group: 'start' },
    { id: 'intake',      label: 'Site Intake',          icon: '📋',  group: 'work' },
    { id: 'air',         label: 'Air Permit AI',        icon: '💨',  group: 'work' },
    { id: 'water',       label: 'Water Permit AI',      icon: '💧',  group: 'work' },
    { id: 'milestones',  label: 'Milestone Timeline',   icon: '📅',  group: 'work' },
    { id: 'docs',        label: 'Document Factory',     icon: '📄',  group: 'work' },
    { id: 'simulation',  label: 'Digital Twin',         icon: '⚡',  group: 'advanced' },
    { id: 'compliance',  label: 'Compliance OS',        icon: '🛡',  group: 'advanced' },
    { id: 'copilot',     label: 'Response Assistant',    icon: '🤖',  group: 'advanced' },
  ];

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
          <span className={`${demoMode ? 'bg-amber-900/30 text-amber-300 border-amber-800/60' : 'bg-green-900/40 text-green-400 border-green-800/60'} text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${demoMode ? 'bg-amber-400' : 'bg-green-400 animate-pulse'}`}></span>
            {demoMode ? 'Demo Workspace' : 'Connected'}
          </span>
          <span className="bg-indigo-900/40 text-indigo-300 text-xs px-2.5 py-1 rounded-full border border-indigo-800/60 hidden sm:block">
            EPA Regulatory Framework
          </span>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800/40 hover:bg-gray-800 rounded-lg px-2.5 py-1.5 border border-gray-700/60 transition-colors flex items-center gap-1"
              title={demoMode ? 'Exit demo workspace' : 'Sign out'}
            >
              {demoMode ? 'Exit Demo' : 'Logout'}
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
          <span>{mobileOpen ? '▲' : '▼'}</span>
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
