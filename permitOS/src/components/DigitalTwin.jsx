import React, { useState, useEffect, useRef } from 'react';
import { simulate24h, THRESHOLDS } from '../utils/calculations';
import { usePermitData } from '../context/PermitDataContext';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar
} from 'recharts';

function MiniChart({ data, keyBaseline, keyOptimized, color, label, unit }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bVals = data.map(d => d[keyBaseline]);
    const oVals = data.map(d => d[keyOptimized]);
    const max = Math.max(...bVals, ...oVals) * 1.1;
    const min = Math.min(...bVals, ...oVals) * 0.9;
    const scaleY = (v) => h - ((v - min) / (max - min)) * h;
    const scaleX = (i) => (i / (data.length - 1)) * w;

    // Fill area under baseline
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(bVals[0]));
    bVals.forEach((v, i) => ctx.lineTo(scaleX(i), scaleY(v)));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = 'rgba(239,68,68,0.08)';
    ctx.fill();

    // Baseline line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(239,68,68,0.6)'; ctx.lineWidth = 1.5;
    bVals.forEach((v, i) => { if (i === 0) ctx.moveTo(scaleX(i), scaleY(v)); else ctx.lineTo(scaleX(i), scaleY(v)); });
    ctx.stroke();

    // Optimized fill
    ctx.beginPath();
    ctx.moveTo(scaleX(0), scaleY(oVals[0]));
    oVals.forEach((v, i) => ctx.lineTo(scaleX(i), scaleY(v)));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.fillStyle = `rgba(99,102,241,0.15)`;
    ctx.fill();

    // Optimized line
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    oVals.forEach((v, i) => { if (i === 0) ctx.moveTo(scaleX(i), scaleY(v)); else ctx.lineTo(scaleX(i), scaleY(v)); });
    ctx.stroke();
  }, [data, keyBaseline, keyOptimized, color]);

  return (
    <div className="bg-card/40 border border-border/40  p-4">
      <div className="text-xs text-muted-foreground mb-2 font-medium">{label}</div>
      <canvas ref={canvasRef} width={220} height={80} className="w-full" />
      <div className="flex gap-3 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5 bg-red-400/60"></div> Baseline
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-0.5" style={{ backgroundColor: color }}></div> Brick-Optimized
        </div>
      </div>
    </div>
  );
}

export default function DigitalTwin() {
  const { inputs, results } = usePermitData();
  const [hour, setHour] = useState(12);
  const [simData, setSimData] = useState(null);

  const run = () => {
    if (!results) return;
    const data = simulate24h({
      totalMW: results.totalMW,
      brickSavings: inputs.brickSavings,
      heatRate: inputs.heatRate,
      noxFactor: inputs.noxFactor,
      coolingMGD: inputs.coolingMGD,
      datacenterMW: inputs.datacenterMW,
      pueTarget: inputs.pueTarget,
      hours: inputs.hours,
    });
    setSimData(data);
  };

  const current = simData?.[hour];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className=" border border-amber-700/30 bg-amber-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Permit-Linked Digital Twin Simulator</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time simulation of turbine dispatch, cooling load, water use, and emissions — all within permit compliance envelopes.
              This is not a BAS dashboard. Every output is linked to a permit condition.
            </p>
          </div>
          <button onClick={run} disabled={!results}
            className={`px-5 py-2.5  text-sm font-semibold transition-all flex items-center gap-2
              ${!results ? 'bg-amber-800/40 text-destructive/50 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
            ▶ Run 24-Hour Simulation
          </button>
        </div>
      </div>

      {!results && (
        <div className="text-center py-16 text-muted-foreground/70">
          <div className="text-4xl mb-3">⚡</div>
          <p>Run Site Intake screening first to enable simulation.</p>
        </div>
      )}

      {results && !simData && (
        <div className="text-center py-16 border border-border/40  bg-card/20">
          <div className="text-4xl mb-3">⚡</div>
          <p className="text-muted-foreground text-sm mb-4">Click "Run 24-Hour Simulation" to see the permit-linked digital twin in action.</p>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-xs text-muted-foreground/70">
            <div className="bg-muted/40  p-3">Turbine dispatch profile</div>
            <div className="bg-muted/40  p-3">NOx/CO hourly emissions</div>
            <div className="bg-muted/40  p-3">Water use / blowdown</div>
          </div>
        </div>
      )}

      {simData && (
        <>
          {/* Hour scrubber */}
          <div className=" border border-border/40 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-foreground/80">Hour-by-Hour Permit Compliance View</h3>
              <span className="text-primary font-bold text-sm">{String(hour).padStart(2,'0')}:00</span>
            </div>
            <input
              type="range" min={0} max={23} step={1} value={hour}
              onChange={e => setHour(parseInt(e.target.value))}
              className="w-full accent-primary mb-4"
            />
            {current && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Turbine Output (Baseline)', value: `${current.baseline_mw} MW`, color: 'text-destructive' },
                  { label: 'Turbine Output (Brick)', value: `${current.optimized_mw} MW`, color: 'text-primary' },
                  { label: 'NOx Emissions (Baseline)', value: `${current.baseline_nox} lb/hr`, color: 'text-destructive' },
                  { label: 'NOx Emissions (Brick)', value: `${current.optimized_nox} lb/hr`, color: 'text-primary' },
                  { label: 'Cooling Load (Baseline)', value: `${current.cooling_mw} MW`, color: 'text-orange-400' },
                  { label: 'Cooling Load (Brick)', value: `${current.cooling_optimized} MW`, color: 'text-blue-400' },
                  { label: 'Water Use (Baseline)', value: `${current.water_gpm} GPM`, color: 'text-blue-400' },
                  { label: 'Water Use (Brick)', value: `${current.water_optimized} GPM`, color: 'text-primary' },
                ].map(m => (
                  <div key={m.label} className="bg-muted/40  p-3">
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className={`text-lg font-bold mt-0.5 ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recharts main views */}
          <div className=" border border-border/40 bg-card/40 p-5">
            <h3 className="text-base font-semibold text-foreground/80 mb-4">24-Hour Turbine Load & Emissions Profile</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={simData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="brickGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  tickFormatter={h => `${String(h).padStart(2,'0')}:00`} />
                <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} unit=" MW" />
                <Tooltip
                  contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }}
                  labelFormatter={h => `Hour ${String(h).padStart(2,'0')}:00`}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="baseline_mw" name="Baseline MW" stroke="var(--color-chart-4)" fill="url(#baseGrad)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="optimized_mw" name="Brick-Controlled MW" stroke="var(--color-chart-1)" fill="url(#brickGrad)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="battery_dispatch" name="Battery Dispatch (MW)" stroke="var(--color-chart-3)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* NOx Emissions */}
            <div className=" border border-border/40 bg-card/40 p-5">
              <h3 className="text-base font-semibold text-foreground/80 mb-4">Hourly NOx Emissions — Permit Compliance</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={simData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={h => `${h}h`} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} unit=" lb/h" />
                  <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="baseline_nox" name="Baseline NOx" stroke="var(--color-chart-4)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="optimized_nox" name="Brick NOx" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Water Use */}
            <div className=" border border-border/40 bg-card/40 p-5">
              <h3 className="text-base font-semibold text-foreground/80 mb-4">Hourly Water Use — Cooling Tower</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={simData.filter((_, i) => i % 2 === 0)} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={h => `${h}h`} />
                  <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} unit=" GPM" />
                  <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="water_gpm" name="Baseline GPM" fill="var(--muted-foreground)" radius={[2,2,0,0]} />
                  <Bar dataKey="water_optimized" name="Brick GPM" fill="var(--color-chart-2)" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mini chart grid (canvas-based) */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniChart data={simData} keyBaseline="baseline_mw" keyOptimized="optimized_mw"
              color="#818cf8" label="Turbine Load (MW)" unit="MW" />
            <MiniChart data={simData} keyBaseline="baseline_nox" keyOptimized="optimized_nox"
              color="#4ade80" label="NOx Emissions (lb/hr)" unit="lb/hr" />
            <MiniChart data={simData} keyBaseline="cooling_mw" keyOptimized="cooling_optimized"
              color="#38bdf8" label="Cooling Load (MW)" unit="MW" />
            <MiniChart data={simData} keyBaseline="water_gpm" keyOptimized="water_optimized"
              color="#34d399" label="Water Use (GPM)" unit="GPM" />
          </div>

          {/* Model disclaimer */}
          <p className="text-xs text-muted-foreground italic text-center">
            Modeled from typical data center/turbine operating patterns and site parameters — not live equipment telemetry.
          </p>

          {/* Permit compliance envelope */}
          <div className=" border border-border/40 bg-card/40 p-5">
            <h3 className="text-base font-semibold text-foreground/80 mb-4">Permit Compliance Envelope — Live Status</h3>
            <div className="space-y-3">
              {[
                {
                  label: 'Annual NOx Budget',
                  baseline: results.baseline.nox,
                  controlled: results.controlled.nox,
                  limit: results.thresholdAnalysis?.nox?.controllingThreshold || THRESHOLDS.nox.psd,
                  unit: 'tpy',
                  compliance: results.controlled.nox < (results.thresholdAnalysis?.nox?.controllingThreshold || THRESHOLDS.nox.psd),
                },
                {
                  label: 'Annual CO Budget',
                  baseline: results.baseline.co,
                  controlled: results.controlled.co,
                  limit: THRESHOLDS.co.psd,
                  unit: 'tpy',
                  compliance: results.controlled.co < THRESHOLDS.co.psd,
                },
                {
                  label: 'GHG (CO₂e) — GHGRP',
                  baseline: results.baseline.co2e,
                  controlled: results.controlled.co2e,
                  limit: THRESHOLDS.co2e.ghgrp,
                  unit: 'tpy',
                  compliance: results.controlled.co2e < THRESHOLDS.co2e.ghgrp,
                },
                {
                  label: 'Water Use (Annual)',
                  baseline: results.water.annualWaterMG,
                  controlled: results.water.optimizedWater,
                  limit: results.water.annualWaterMG * 1.2,
                  unit: 'MG/yr',
                  compliance: results.water.optimizedWater < results.water.annualWaterMG * 1.2,
                },
              ].map(item => {
                const pct = (item.controlled / item.limit) * 100;
                return (
                  <div key={item.label} className="bg-muted/30  p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground/80">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          Baseline: <span className="text-destructive">{item.baseline.toFixed(1)} {item.unit}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Controlled: <span className="text-primary">{item.controlled.toFixed(1)} {item.unit}</span>
                        </span>
                        <span className={`text-xs px-2.5 py-0.5  border ${item.compliance ? 'bg-primary/10 border-green-700/40 text-primary' : 'bg-destructive/10 border-red-700/40 text-destructive'}`}>
                          {item.compliance ? '✓ Compliant' : '⚠ Exceeds'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-muted/40  h-2">
                      <div
                        className={`h-2  transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground/70">0</span>
                      <span className="text-xs text-muted-foreground/70">{pct.toFixed(0)}% of {item.limit.toLocaleString()} {item.unit} limit</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Battery dispatch */}
          <div className=" border border-primary/30 bg-primary/10 p-5">
            <h3 className="text-base font-semibold text-primary mb-3">Battery / Thermal Storage Dispatch — Permit Value</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-card/40  p-4">
                <div className="text-xs text-muted-foreground mb-2">Peak Battery Dispatch</div>
                <div className="text-2xl font-bold text-primary">
                  {Math.max(...simData.map(d => d.battery_dispatch)).toFixed(1)} MW
                </div>
                <div className="text-xs text-muted-foreground/70 mt-1">Smooths turbine starts → reduces SSM emissions</div>
              </div>
              <div className="bg-card/40  p-4">
                <div className="text-xs text-muted-foreground mb-2">Startup Events Avoided</div>
                <div className="text-2xl font-bold text-primary">
                  {Math.floor(inputs.brickSavings * 0.8)} events/yr
                </div>
                <div className="text-xs text-muted-foreground/70 mt-1">Lower SSM emissions → stronger permit record</div>
              </div>
              <div className="bg-card/40  p-4">
                <div className="text-xs text-muted-foreground mb-2">NOx Saved (Brick vs. Baseline)</div>
                <div className="text-2xl font-bold text-primary">
                  {results.avoided.nox.toFixed(1)} tpy
                </div>
                <div className="text-xs text-muted-foreground/70 mt-1">Creates buffer below permit NOx cap</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
