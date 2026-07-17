import React, { useState, useMemo, useRef, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color helpers ─────────────────────────────────────────────────────────
const STATUS_COLORS = {
  complete: '#22c55e',    // green-500
  in_progress: '#d97706', // amber-500
  not_started: '#4b5563', // gray-600
};

function getStatus(pct) {
  if (pct >= 100) return 'complete';
  if (pct > 0) return 'in_progress';
  return 'not_started';
}

function getColor(pct) {
  return STATUS_COLORS[getStatus(pct)];
}

// ─── Building Block ────────────────────────────────────────────────────────
function Building({ position, size, color, label, hovered, onHover, onClick }) {
  const ref = useRef();
  return (
    <group position={position}>
      <mesh
        ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); onHover(label); }}
        onPointerOut={() => onHover(null)}
        onClick={onClick}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.1}
          emissive={color}
          emissiveIntensity={hovered === label ? 0.3 : 0.05}
        />
      </mesh>
      {/* Label sprite */}
      <Html position={[0, size[1] / 2 + 0.6, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-xs font-medium text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded whitespace-nowrap border border-border/50">
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── Cooling Tower (cylinder) ─────────────────────────────────────────────
function CoolingTower({ position, height, radius, color, label, hovered, onHover, onClick }) {
  return (
    <group position={position}>
      <mesh onPointerOver={(e) => { e.stopPropagation(); onHover(label); }} onPointerOut={() => onHover(null)} onClick={onClick}>
        <cylinderGeometry args={[radius * 0.6, radius, height, 16]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.05} />
      </mesh>
      <mesh position={[0, height / 2 + 0.1, 0]}>
        <cylinderGeometry args={[radius * 0.7, radius * 0.7, 0.1, 16]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <Html position={[0, height + 0.5, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-xs font-medium text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded whitespace-nowrap border border-border/50">
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── Substation Equipment ─────────────────────────────────────────────────
function SubstationGear({ position, color, label, hovered, onHover, onClick }) {
  return (
    <group position={position}>
      {[0, 0.5, 1].map((x, i) => (
        <mesh
          key={i}
          position={[x - 0.5, 0.2, 0]}
          onPointerOver={(e) => { e.stopPropagation(); onHover(label); }}
          onPointerOut={() => onHover(null)}
          onClick={onClick}
        >
          <boxGeometry args={[0.2, 0.4, 0.3]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      <Html position={[0, 0.8, 0]} center style={{ pointerEvents: 'none' }}>
        <div className="text-xs font-medium text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded whitespace-nowrap border border-border/50">
          {label}
        </div>
      </Html>
    </group>
  );
}

// ─── 3D Scene ──────────────────────────────────────────────────────────────
function SiteScene({ milestoneDetails, progressPct, onHover, hovered, setSelectedPhase }) {
  if (!milestoneDetails || milestoneDetails.length === 0) {
    // Still show an empty site
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial color="#1f2937" roughness={0.9} />
        </mesh>
        <gridHelper args={[30, 20, '#374151', '#1f2937']} position={[0, 0, 0]} />
      </group>
    );
  }

  // Map milestones to structure colors
  const getPhase = (name) => milestoneDetails.find(m => m.name === name);
  const pct = (name) => getPhase(name)?.displayPct || 0;

  // Structure sizes adjusted by overall project scale
  const scale = 1;

  const dataHallColor = getColor(Math.round(
    (pct('Structural Steel Erection') +
     pct('Building Enclosure (Roof/Wall)') +
     pct('MEP Rough-In') +
     pct('Interior Finishes & Fitout')) / 4
  ));
  const turbineHallColor = getColor(Math.round(
    (pct('Electrical & Switchgear Installation') +
     pct('Structural Steel Erection')) / 2
  ));
  const coolingColor = getColor(pct('Cooling System Installation'));
  const substationColor = getColor(pct('Electrical & Switchgear Installation'));
  const adminColor = getColor(Math.round(
    (pct('Interior Finishes & Fitout') +
     pct('Building Enclosure (Roof/Wall)')) / 2
  ));
  const sitePrepColor = getColor(pct('Site Preparation & Demolition'));
  const fireColor = getColor(pct('Fire Protection & Life Safety'));
  const commissioningColor = getColor(pct('Commissioning & Testing'));

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>
      <gridHelper args={[30, 20, '#374151', '#1f2937']} position={[0, 0, 0]} />

      {/* Site preparation / grading ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[6, 7, 32]} />
        <meshStandardMaterial color={sitePrepColor} roughness={0.8} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Main Data Hall */}
      <Building
        position={[0, 0.6, 0]}
        size={[5 * scale, 1.2 * scale, 3 * scale]}
        color={dataHallColor}
        label="Main Data Hall"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Structural Steel Erection')}
      />

      {/* Turbine / Generator Hall */}
      <Building
        position={[-3.5, 0.35, 1]}
        size={[1.5 * scale, 0.7 * scale, 1.5 * scale]}
        color={turbineHallColor}
        label="Turbine Hall"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Electrical & Switchgear Installation')}
      />

      {/* Cooling Towers */}
      <CoolingTower
        position={[2.5, 0, -1.5]}
        height={1.0 * scale}
        radius={0.4 * scale}
        color={coolingColor}
        label="Cooling Towers"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Cooling System Installation')}
      />
      <CoolingTower
        position={[3.5, 0, -1.5]}
        height={0.8 * scale}
        radius={0.35 * scale}
        color={coolingColor}
        label="Cooling Towers"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Cooling System Installation')}
      />
      <CoolingTower
        position={[3.0, 0, -2.3]}
        height={0.6 * scale}
        radius={0.3 * scale}
        color={coolingColor}
        label="Cooling Towers"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Cooling System Installation')}
      />

      {/* Substation / Switchgear Yard */}
      <SubstationGear
        position={[-4, 0, -1.5]}
        color={substationColor}
        label="Substation"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Electrical & Switchgear Installation')}
      />

      {/* Admin Building */}
      <Building
        position={[4, 0.25, 2]}
        size={[1.2 * scale, 0.5 * scale, 0.8 * scale]}
        color={adminColor}
        label="Admin Building"
        hovered={hovered}
        onHover={onHover}
        onClick={() => setSelectedPhase('Interior Finishes & Fitout')}
      />

      {/* Fire Protection tank */}
      <mesh position={[-1.5, 0.15, -2.5]} onPointerOver={() => onHover('Fire Protection')} onPointerOut={() => onHover(null)} onClick={() => setSelectedPhase('Fire Protection & Life Safety')}>
        <cylinderGeometry args={[0.3, 0.3, 0.3, 8]} />
        <meshStandardMaterial color={fireColor} roughness={0.8} />
      </mesh>

      {/* Commissioning flag */}
      {commissioningColor === '#22c55e' && (
        <mesh position={[0, 2.5, 0]}>
          <coneGeometry args={[0.15, 0.3, 4]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Progress indicator ring on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[7.5, 8, 64]} />
        <meshStandardMaterial
          color="#22c55e"
          roughness={0.5}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
function SiteView3D({ data }) {
  const [hovered, setHovered] = useState(null);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [progressPct, setProgressPct] = useState(0);

  const milestoneDetails = data?.milestoneDetails || [];
  const milestones = milestoneDetails.length > 0
    ? milestoneDetails
    : [
        { name: 'Site Preparation & Demolition', phase: 1, pctComplete: 0, status: 'not_started' },
        { name: 'Foundations & Slab on Grade', phase: 2, pctComplete: 0, status: 'not_started' },
        { name: 'Structural Steel Erection', phase: 3, pctComplete: 0, status: 'not_started' },
        { name: 'Building Enclosure (Roof/Wall)', phase: 4, pctComplete: 0, status: 'not_started' },
        { name: 'MEP Rough-In', phase: 5, pctComplete: 0, status: 'not_started' },
        { name: 'Electrical & Switchgear Installation', phase: 6, pctComplete: 0, status: 'not_started' },
        { name: 'Cooling System Installation', phase: 7, pctComplete: 0, status: 'not_started' },
        { name: 'Fire Protection & Life Safety', phase: 8, pctComplete: 0, status: 'not_started' },
        { name: 'Interior Finishes & Fitout', phase: 9, pctComplete: 0, status: 'not_started' },
        { name: 'Commissioning & Testing', phase: 10, pctComplete: 0, status: 'not_started' },
      ];

  // Map structure hover/click labels to milestone names
  const LABEL_TO_MILESTONE = {
    'Main Data Hall': 'Structural Steel Erection',
    'Turbine Hall': 'Electrical & Switchgear Installation',
    'Cooling Towers': 'Cooling System Installation',
    'Substation': 'Electrical & Switchgear Installation',
    'Admin Building': 'Interior Finishes & Fitout',
    'Fire Protection': 'Fire Protection & Life Safety',
  };

  // Compute per-milestone display data at the current progressPct
  const displayMilestones = useMemo(() => {
    return milestones.map((m) => {
      const expectedPct = (m.phase / milestones.length) * 100;
      const prevExpected = ((m.phase - 1) / milestones.length) * 100;
      let displayPct;
      if (progressPct >= expectedPct) displayPct = 100;
      else if (progressPct <= prevExpected) displayPct = 0;
      else displayPct = Math.round(((progressPct - prevExpected) / (expectedPct - prevExpected)) * 100);
      return { ...m, displayPct };
    });
  }, [milestones, progressPct]);

  // Info for the selected/hovered phase — resolve label to milestone name
  const infoMilestone = (() => {
    const key = selectedPhase || hovered;
    if (!key) return null;
    const milestoneName = LABEL_TO_MILESTONE[key] || key;
    return displayMilestones.find(m => m.name === milestoneName);
  })();

  // Stable key for Canvas to prevent remounting on parent re-renders
  const canvasKey = 'siteview3d-canvas';

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: '480px' }}>
      {/* 3D Viewport — explicitly sized container */}
      <div className="flex-1  border border-border/40 bg-background/80 overflow-hidden" style={{ minHeight: '480px', height: '560px', position: 'relative' }}>
        <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          <Canvas
            key={canvasKey}
            camera={{ position: [12, 8, 10], fov: 45, near: 0.1, far: 100 }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => { gl.setClearColor('#030712'); }}
            style={{ width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 15, 10]} intensity={0.8} />
            <directionalLight position={[-5, 5, -5]} intensity={0.3} />
            <Suspense fallback={null}>
              <SiteScene
                milestoneDetails={displayMilestones}
                progressPct={progressPct}
                onHover={setHovered}
                hovered={hovered}
                setSelectedPhase={setSelectedPhase}
              />
            </Suspense>
            <OrbitControls
              enableDamping
              dampingFactor={0.15}
              minDistance={4}
              maxDistance={30}
              maxPolarAngle={Math.PI / 2.1}
            />
          </Canvas>
        </div>
      </div>

      {/* Side Panel */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Progress Slider */}
        <div className=" border border-border/40 bg-card/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Progress</span>
            <span className="text-sm font-bold text-primary">{progressPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progressPct}
            onChange={(e) => setProgressPct(parseInt(e.target.value))}
            className="w-full h-1.5 bg-muted  appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground/70 mt-1">
            <span>Start</span>
            <span>Today</span>
            <span>COD</span>
          </div>
        </div>

        {/* Phase Details */}
        <div className=" border border-border/40 bg-card/60 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">
            {infoMilestone ? infoMilestone.name : 'Phase Details'}
          </h3>
          {infoMilestone ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Phase</span>
                <span className="text-xs text-foreground/80">{infoMilestone.phase} / {milestones.length}</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Completion</span>
                  <span className="text-xs font-medium" style={{ color: getColor(infoMilestone.displayPct) }}>
                    {infoMilestone.displayPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted  overflow-hidden">
                  <div
                    className="h-full  transition-all duration-300"
                    style={{
                      width: `${infoMilestone.displayPct}%`,
                      backgroundColor: getColor(infoMilestone.displayPct),
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={`text-xs font-medium px-2 py-0.5  ${
                  infoMilestone.displayPct >= 100 ? 'text-primary bg-primary/10 border border-green-700/40' :
                  infoMilestone.displayPct > 0 ? 'text-destructive bg-amber-900/30 border border-amber-700/40' :
                  'text-muted-foreground bg-muted/30 border border-border/40'
                }`}>
                  {infoMilestone.displayPct >= 100 ? 'Complete' :
                   infoMilestone.displayPct > 0 ? 'In Progress' : 'Not Started'}
                </span>
              </div>
              {infoMilestone.varianceDays > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Schedule Variance</span>
                  <span className="text-xs text-destructive">-{infoMilestone.varianceDays}d</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Budget</span>
                <span className="text-xs text-foreground/80">${(infoMilestone.budget / 1e6).toFixed(1)}M</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/70">Hover or click a structure to see phase details</p>
          )}
        </div>

        {/* Milestone Overview */}
        <div className=" border border-border/40 bg-card/60 p-4 max-h-[280px] overflow-y-auto">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">All Phases</h3>
          <div className="space-y-1.5">
            {milestones.map((m, i) => {
              const displayM = displayMilestones[i];
              const color = getColor(displayM.displayPct);
              return (
                <div
                  key={m.name}
                  className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedPhase(m.name)}
                >
                  <span className="w-2 h-2  flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-muted-foreground flex-1 truncate">{m.name}</span>
                  <span className="text-xs font-medium text-muted-foreground">{displayM.displayPct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(SiteView3D);