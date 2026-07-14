import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Wind, Drop, Buildings, Lightning, MapTrifold, Check } from '@phosphor-icons/react';

const PERMIT_TYPES = [
  {
    key: 'air',
    label: 'Air Permit',
    description: 'Emissions, PSD/NSR, BACT, Title V, NSPS, NESHAP',
    icon: Wind,
    accent: 'text-violet-400',
    ring: 'ring-violet-500/50',
    bgChecked: 'bg-violet-950/20',
  },
  {
    key: 'water',
    label: 'Water Permit',
    description: 'NPDES, SPCC, 316(b), stormwater, wetlands, POTW',
    icon: Drop,
    accent: 'text-sky-400',
    ring: 'ring-sky-500/50',
    bgChecked: 'bg-sky-950/20',
  },
  {
    key: 'building',
    label: 'Building Permit',
    description: 'IBC/IRC, fire suppression, occupancy, structural',
    icon: Buildings,
    accent: 'text-indigo-400',
    ring: 'ring-indigo-500/50',
    bgChecked: 'bg-indigo-950/20',
  },
  {
    key: 'power',
    label: 'Power / Interconnection',
    description: 'Grid interconnection, transformers, gensets, FERC',
    icon: Lightning,
    accent: 'text-amber-400',
    ring: 'ring-amber-500/50',
    bgChecked: 'bg-amber-950/20',
  },
];

export default function PermitSelectionModal({
  open,
  onClose,
  onConfirm,
  initialSelection = [],
  dismissable = true,
}) {
  const [selected, setSelected] = useState(
    initialSelection.length > 0 ? [...initialSelection] : ['air', 'water', 'building', 'power']
  );

  const toggle = (key) => {
    if (selected.includes(key) && selected.length <= 1) return;
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    onConfirm(selected);
  };

  const handleSitePlanner = () => {
    onConfirm(null, 'siteplanner');
  };

  return (
    <Dialog open={open} onClose={dismissable ? onClose : () => {}} className="relative z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold text-zinc-100">
              What are you working on?
            </DialogTitle>
            <p className="text-sm text-zinc-500 mt-1">
              Select the permits you're pursuing — the intake form will only show fields that are
              relevant. You can change this anytime.
            </p>
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 px-6 py-4">
            {PERMIT_TYPES.map((p) => {
              const isSelected = selected.includes(p.key);
              const Icon = p.icon;
              return (
                <button
                  key={p.key}
                  onClick={() => toggle(p.key)}
                  className={`relative flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all
                    ${
                      isSelected
                        ? `border-zinc-700 ${p.bgChecked} ring-1 ${p.ring}`
                        : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
                    }`}
                >
                  {/* Checkmark badge */}
                  {isSelected && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center">
                      <Check weight="bold" size={12} className="text-zinc-900" />
                    </span>
                  )}

                  {/* Icon */}
                  <Icon weight="duotone" size={24} className={p.accent} />

                  {/* Label */}
                  <span className="text-sm font-medium text-zinc-200">{p.label}</span>

                  {/* Description */}
                  <span className="text-xs text-zinc-500 leading-tight">{p.description}</span>
                </button>
              );
            })}
          </div>

          {/* Site Planner row */}
          <div className="px-6 pb-2">
            <button
              onClick={handleSitePlanner}
              className="w-full flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700 p-4 transition-all"
            >
              <span className="w-9 h-9 rounded-lg bg-emerald-950/40 border border-emerald-900/40 flex items-center justify-center">
                <MapTrifold weight="duotone" size={20} className="text-emerald-400" />
              </span>
              <div className="text-left">
                <span className="text-sm font-medium text-zinc-300">Not sure yet? Plan your site first</span>
                <p className="text-xs text-zinc-500">Skip permit selection and go to the Site Planner</p>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
            <span className="text-sm text-zinc-500">
              {selected.length} permit{selected.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleContinue}
              disabled={selected.length === 0}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  selected.length === 0
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-100 text-zinc-900 hover:bg-white'
                }`}
            >
              Continue
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}