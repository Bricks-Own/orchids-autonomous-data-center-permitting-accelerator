import React, { useState } from 'react';
import AirPermitAI from './AirPermitAI';
import WaterPermitAI from './WaterPermitAI';
import BuildingPermitAI from './BuildingPermitAI';
import PowerPermitAI from './PowerPermitAI';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Wind, Drop, Buildings, Lightning } from '@phosphor-icons/react';

const PERMIT_DEFS = {
  air: { label: 'Air Permit', icon: Wind, Component: AirPermitAI },
  water: { label: 'Water Permit', icon: Drop, Component: WaterPermitAI },
  building: { label: 'Building Permit', icon: Buildings, Component: BuildingPermitAI },
  power: { label: 'Power / Interconnection', icon: Lightning, Component: PowerPermitAI },
};

export default function Permits({ inputs, results, setActiveTab }) {
  const [selected, setSelected] = useState(null);

  if (!results) {
    return (
      <div className="px-10 py-8 max-w-[1180px] mx-auto">
        <Card><CardContent className="text-center py-16">
          <p className="text-lg font-semibold text-foreground mb-2">No permits generated yet</p>
          <p className="text-sm text-muted-foreground mb-6">Run Site Intake to generate the permits this site needs, or plan your project first if you're not sure what you need.</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => setActiveTab('intake')}>Generate via Site Intake</Button>
            <Button variant="outline" onClick={() => setActiveTab('siteplanner')}>Plan via Site Planner</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  const permitTypes = [
    (inputs?.hasOnSiteGeneration !== false || inputs?.turbines > 0 || inputs?.gensetCount > 0) && 'air',
    (inputs?.hasWaterUse !== false || inputs?.coolingMGD > 0 || inputs?.waterMGD > 0) && 'water',
    inputs?.hasNewConstruction !== false && 'building',
    inputs?.hasGridInterconnection !== false && 'power',
  ].filter(Boolean);

  if (selected) {
    const { Component, label } = PERMIT_DEFS[selected];
    return (
      <div className="px-10 py-8 max-w-[1180px] mx-auto space-y-4">
        <Button variant="outline" onClick={() => setSelected(null)}>&larr; Back to Permits</Button>
        <Component results={results} inputs={inputs} setActiveTab={setActiveTab} />
      </div>
    );
  }

  return (
    <div className="px-10 py-8 max-w-[1180px] mx-auto">
      <h1 className="text-4xl font-bold text-foreground mb-6">Permits</h1>
      <div className="grid grid-cols-2 gap-5">
        {permitTypes.map(key => {
          const { label, icon: Icon } = PERMIT_DEFS[key];
          return (
            <Card key={key} className="cursor-pointer hover:bg-card/80" onClick={() => setSelected(key)}>
              <CardContent className="flex items-center gap-3 py-6">
                <Icon weight="duotone" size={24} className="text-muted-foreground" />
                <span className="text-base font-semibold text-foreground">{label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}