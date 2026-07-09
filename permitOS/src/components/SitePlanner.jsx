import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calcPTE } from '../utils/calculations';
import { US_STATES, STATE_BOUNDING_BOXES, STATES_ATTAINMENT } from '../data/permitData';
import 'leaflet/dist/leaflet.css';

// ─── Leaflet Map Component ──────────────────────────────────────────────────
// Reverse geocode lat/lon to US state using bounding boxes
function getStateFromCoords(lat, lon) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum)) return null;
  for (const [state, [minLat, maxLat, minLon, maxLon]] of Object.entries(STATE_BOUNDING_BOXES)) {
    if (latNum >= minLat && latNum <= maxLat && lonNum >= minLon && lonNum <= maxLon) {
      return state;
    }
  }
  return null;
}

function SiteMap({ lat, lon, onLatLonChange, onBoundaryChange, siteAcres }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const rectangleRef = useRef(null);
  const [leaflet, setLeaflet] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLayer, setMapLayer] = useState('street');

  useEffect(() => {
    import('leaflet').then(L => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setLeaflet(L);
    });
  }, []);

  // Initialize map once leaflet is loaded
  useEffect(() => {
    if (!leaflet || mapInstanceRef.current) return;

    const map = leaflet.map(mapRef.current, {
      center: [parseFloat(lat) || 36.1627, parseFloat(lon) || -86.7816],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });

    // Street layer (OpenStreetMap)
    const streetLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
      className: 'map-tiles',
    });

    // Satellite layer (ESRI World Imagery — free, no API key needed)
    const satelliteLayer = leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://esri.com">ESRI</a>',
      className: 'map-tiles',
    });

    // Add layer control
    const baseLayers = {
      'Street Map': streetLayer,
      'Satellite': satelliteLayer,
    };

    leaflet.control.layers(baseLayers, null, {
      position: 'topright',
      collapsed: false,
    }).addTo(map);

    // Start with street layer
    streetLayer.addTo(map);

    // Add scale control
    leaflet.control.scale({
      position: 'bottomleft',
      metric: true,
      imperial: true,
    }).addTo(map);

    // Add marker
    const marker = leaflet.marker([parseFloat(lat) || 36.1627, parseFloat(lon) || -86.7816], {
      draggable: true,
    }).addTo(map);

    marker.on('dragend', function() {
      const pos = this.getLatLng();
      const newLat = pos.lat.toFixed(4);
      const newLon = pos.lng.toFixed(4);
      onLatLonChange(newLat, newLon);
    });

    markerRef.current = marker;

    // Show coordinates on map click
    map.on('click', function(e) {
      const newLat = e.latlng.lat.toFixed(4);
      const newLon = e.latlng.lng.toFixed(4);
      onLatLonChange(newLat, newLon);
    });

    mapInstanceRef.current = map;
    updateBoundary(leaflet, map, parseFloat(lat) || 36.1627, parseFloat(lon) || -86.7816);
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leaflet]);

  // Update marker position when lat/lon changes externally
  useEffect(() => {
    if (!leaflet || !markerRef.current || !mapReady) return;
    markerRef.current.setLatLng([parseFloat(lat), parseFloat(lon)]);
    mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], mapInstanceRef.current.getZoom());
    updateBoundary(leaflet, mapInstanceRef.current, parseFloat(lat), parseFloat(lon));
  }, [lat, lon, mapReady]);

  // Helper to draw/update site boundary rectangle
  const updateBoundary = (L, map, latVal, lonVal) => {
    if (rectangleRef.current) {
      map.removeLayer(rectangleRef.current);
    }

    const acres = Math.max(1, siteAcres || 45);
    const sideDeg = Math.sqrt(acres) * 0.00036;

    const bounds = [
      [latVal - sideDeg, lonVal - sideDeg],
      [latVal + sideDeg, lonVal + sideDeg],
    ];

    const rect = L.rectangle(bounds, {
      color: '#6366f1',
      weight: 2,
      fillColor: '#6366f1',
      fillOpacity: 0.12,
      dashArray: '5, 5',
    }).addTo(map);

    rectangleRef.current = rect;

    // Fit map to show the boundary
    const padding = Math.max(sideDeg * 3, 0.003);
    map.fitBounds([
      [latVal - sideDeg - padding, lonVal - sideDeg - padding],
      [latVal + sideDeg + padding, lonVal + sideDeg + padding],
    ], { padding: [20, 20] });

    if (onBoundaryChange) {
      onBoundaryChange(acres);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/40 relative">
      <div ref={mapRef} style={{ height: '420px', width: '100%' }} />
      {!leaflet && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500 text-sm z-[1000]">
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Loading map tiles...
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Scenario Test ────────────────────────────────────────────────────
function ScenarioTest({ inputs, onApply, onNavigateToIntake }) {
  const [params, setParams] = useState({ ...inputs });
  const [results, setResults] = useState(null);

  const updateParam = (key, value) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    try {
      const calc = calcPTE(updated);
      setResults(calc);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    try {
      const calc = calcPTE(params);
      setResults(calc);
    } catch { /* ignore */ }
  }, []);

  // Sync local params when external inputs change (e.g., location preset click)
  useEffect(() => {
    setParams(prev => {
      // Only update if values actually differ
      if (JSON.stringify(prev) === JSON.stringify(inputs)) return prev;
      return { ...inputs };
    });
  }, [inputs]);

  const sliders = [
    { key: 'turbines', label: 'Gas Turbines', min: 1, max: 20, step: 1, unit: '' },
    { key: 'mwPerTurbine', label: 'MW per Turbine', min: 5, max: 100, step: 1, unit: 'MW' },
    { key: 'hours', label: 'Operating Hours/yr', min: 500, max: 8760, step: 100, unit: 'hr' },
    { key: 'brickSavings', label: 'Brick Savings', min: 0, max: 30, step: 1, unit: '%' },
    { key: 'gensetCount', label: 'Backup Gensets', min: 0, max: 40, step: 1, unit: '' },
    { key: 'gensetHours', label: 'Genset Hours/yr', min: 0, max: 500, step: 10, unit: 'hr' },
  ];

  const criticalPollutants = [
    { key: 'nox', label: 'NOx', threshold: 100, color: 'text-red-400' },
    { key: 'co', label: 'CO', threshold: 100, color: 'text-orange-400' },
    { key: 'pm25', label: 'PM2.5', threshold: 100, color: 'text-blue-400' },
    { key: 'voc', label: 'VOC', threshold: 100, color: 'text-violet-400' },
    { key: 'co2e', label: 'CO2e', threshold: 25000, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {sliders.map(s => (
          <div key={s.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">{s.label}</label>
              <span className="text-xs font-semibold text-indigo-400 font-mono">{params[s.key]}{s.unit && <span className="text-gray-500"> {s.unit}</span>}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              onChange={e => updateParam(s.key, parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 rounded-full appearance-none bg-gray-700 cursor-pointer"
            />
          </div>
        ))}
      </div>

      {results && (
        <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-gray-400 mb-3">Instant PTE Results (tpy)</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {criticalPollutants.map(p => {
              const val = results.controlled?.[p.key] || 0;
              const pct = (val / p.threshold) * 100;
              return (
                <div key={p.key} className="bg-gray-800/40 rounded-lg p-2 text-center">
                  <div className={`text-xs font-semibold ${p.color}`}>{p.label}</div>
                  <div className="text-lg font-bold text-white font-mono">{val.toFixed(1)}</div>
                  <div className="mt-1 bg-gray-700 rounded-full h-1">
                    <div className={`h-1 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className={`text-xs mt-0.5 ${pct >= 100 ? 'text-red-400' : 'text-green-400'}`}>
                    {pct.toFixed(0)}% of {p.threshold}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {results.pathway?.requiresPSD && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/40">PSD Major Source</span>
            )}
            {results.pathway?.syntheticMinorViable && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/40">Synthetic Minor Viable</span>
            )}
            {results.pathway?.requiresTitleV && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/40">Title V Required</span>
            )}
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
              {results.totalMW} MW · {(results.baseline?.nox || 0).toFixed(1)} tpy NOx baseline
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => { onApply(params); onNavigateToIntake && onNavigateToIntake(); }}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        Apply Parameters to Site Intake
      </button>
    </div>
  );
}

// ─── Main SitePlanner Component ────────────────────────────────────────────
export default function SitePlanner({ inputs, setInputs, setActiveTab }) {
  const [lat, setLat] = useState(inputs.lat || '36.1627');
  const [lon, setLon] = useState(inputs.lon || '-86.7816');
  const [siteAcres, setSiteAcres] = useState(inputs.siteAcres || 45);
  const [selectedState, setSelectedState] = useState(inputs.state || 'Tennessee');
  const [showScenario, setShowScenario] = useState(false);

  const handleLatLonChange = (newLat, newLon) => {
    setLat(newLat);
    setLon(newLon);
    // Auto-detect state from coordinates
    const detected = getStateFromCoords(newLat, newLon);
    setInputs(prev => {
      const updates = { lat: newLat, lon: newLon };
      if (detected) {
        updates.state = detected;
        // Auto-set nonattainment flags if state has nonattainment
        const status = STATES_ATTAINMENT[detected] || '';
        const isNon = status.includes('Nonattainment');
        updates.nonAttainment = isNon;
        if (isNon) {
          updates.nonAttainNOx = true;
          updates.nonAttainPM25 = true;
          updates.nonAttainOzone = true;
        }
      }
      return { ...prev, ...updates };
    });
    if (detected) setSelectedState(detected);
  };

  const handleBoundaryChange = (acres) => {
    setSiteAcres(acres);
    setInputs(prev => ({ ...prev, siteAcres: acres }));
  };

  const handleApplyScenario = (scenarioParams) => {
    setInputs(prev => ({ ...prev, ...scenarioParams }));
  };

  const handleAcresManualInput = (val) => {
    const acres = parseFloat(val) || 1;
    setSiteAcres(acres);
    setInputs(prev => ({ ...prev, siteAcres: acres }));
  };

  const locationPresets = [
    { label: 'BigWatt HQ — Nashville, TN', state: 'Tennessee', lat: '36.1627', lon: '-86.7816', acres: 50 },
    { label: 'Ashburn, VA (Data Center Alley)', state: 'Virginia', lat: '39.0438', lon: '-77.4874', acres: 35 },
    { label: 'Phoenix, AZ (Edge)', state: 'Arizona', lat: '33.4484', lon: '-112.0740', acres: 22 },
    { label: 'Dallas, TX (Hyperscale)', state: 'Texas', lat: '32.7767', lon: '-96.7970', acres: 200 },
    { label: 'Silicon Valley, CA', state: 'California', lat: '37.3861', lon: '-122.0839', acres: 35 },
    { label: 'Columbus, OH (AWS Region)', state: 'Ohio', lat: '39.9612', lon: '-82.9988', acres: 80 },
    { label: 'Atlanta, GA (Edge)', state: 'Georgia', lat: '33.7490', lon: '-84.3880', acres: 22 },
    { label: 'Northern Virginia (AWS/US East)', state: 'Virginia', lat: '38.8339', lon: '-77.3373', acres: 150 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Site Planner — BigWatt Digital Test Bed</h2>
            <p className="text-xs text-gray-500">Explore site configurations on an interactive map with street/satellite views, scale controls, and draggable markers. Toggle between OpenStreetMap road map and high-res ESRI satellite imagery.</p>
          </div>
          <button
            onClick={() => setActiveTab('intake')}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700/60 transition-colors"
          >
            &rarr; Open Full Site Intake
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left Column: Map */}
        <div className="lg:col-span-3 space-y-4">
          {/* Location Presets */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">Quick Location Presets</h3>
            <div className="flex flex-wrap gap-1.5">
              {locationPresets.map(p => (
                <button
                  key={p.label}
                  onClick={() => {
                    setSelectedState(p.state);
                    setLat(p.lat);
                    setLon(p.lon);
                    setSiteAcres(p.acres);
                    setInputs(prev => ({
                      ...prev,
                      state: p.state,
                      lat: p.lat,
                      lon: p.lon,
                      siteAcres: p.acres,
                    }));
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    selectedState === p.state && lat === p.lat
                      ? 'bg-indigo-900/40 border-indigo-700/40 text-indigo-300'
                      : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Map */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400">Site Boundary Map</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs bg-gray-800/60 rounded-lg px-2 py-1">
                  <span className="text-indigo-400 font-medium">Street/Satellite</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-gray-500">Layer toggle (top-right)</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-500">Lat:</span>
                  <input
                    type="text"
                    value={lat}
                    onChange={e => handleLatLonChange(e.target.value, lon)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300 font-mono text-xs"
                  />
                  <span className="text-gray-500">Lon:</span>
                  <input
                    type="text"
                    value={lon}
                    onChange={e => handleLatLonChange(lat, e.target.value)}
                    className="w-20 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            <SiteMap
              lat={lat}
              lon={lon}
              siteAcres={siteAcres}
              onLatLonChange={handleLatLonChange}
              onBoundaryChange={handleBoundaryChange}
            />
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Site Area (acres):</label>
                <input
                  type="number"
                  value={siteAcres}
                  onChange={e => handleAcresManualInput(e.target.value)}
                  min={1}
                  max={500}
                  className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 font-mono text-sm"
                />
                <span className="text-xs text-gray-600">(~{Math.round(siteAcres * 0.4047)} ha)</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>State: <span className="text-gray-400 font-medium">{selectedState}</span></span>
                <span className="text-gray-700">|</span>
                <span className="text-gray-500">
                  <span className="text-indigo-400">{locationPresets.find(p => p.state === selectedState && p.lat === lat)?.label || selectedState}</span>
                </span>
                <span className="text-gray-500">Drag marker / click map to reposition</span>
              </div>
            </div>
          </div>

          {/* Site Details Summary */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">Current Site Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Turbines', value: `${inputs.turbines} \u00d7 ${inputs.mwPerTurbine} MW` },
                { label: 'Annual Hours', value: `${inputs.hours.toLocaleString()} hr/yr` },
                { label: 'Brick Savings', value: `${inputs.brickSavings}%` },
                { label: 'Gensets', value: `${inputs.gensetCount} @ ${inputs.gensetHours} hr/yr` },
                { label: 'Site Area', value: `${siteAcres} acres` },
                { label: 'Data Center Load', value: `${inputs.datacenterMW} MW` },
                { label: 'PUE Target', value: inputs.pueTarget },
                { label: 'Stack Height', value: `${inputs.stackHeight} ft` },
              ].map(item => (
                <div key={item.label} className="bg-gray-800/40 rounded-lg p-2.5">
                  <div className="text-gray-500 mb-0.5">{item.label}</div>
                  <div className="text-gray-200 font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowScenario(!showScenario)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
              >
                {showScenario ? 'Hide Scenario Test' : 'Quick Scenario Test'}
              </button>
              <button
                onClick={() => { const detected = getStateFromCoords(lat, lon); const stateToUse = detected || selectedState; setInputs(prev => ({ ...prev, state: stateToUse, lat, lon, siteAcres })); setActiveTab('intake'); }}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg font-semibold transition-all"
              >
                Send to Site Intake
              </button>
            </div>
          </div>

          {/* Scenario Test Panel */}
          {showScenario && (
            <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 p-5">
              <h3 className="text-sm font-semibold text-violet-300 mb-4">Quick Scenario Test</h3>
              <p className="text-xs text-gray-500 mb-4">Adjust sliders to see instant PTE and pathway changes. Apply to sync with Site Intake.</p>
              <ScenarioTest inputs={inputs} onApply={handleApplyScenario} onNavigateToIntake={() => setActiveTab('intake')} />
            </div>
          )}
        </div>

        {/* Right Column: Scenario Explorer */}
        <div className="lg:col-span-2 space-y-4">
          {/* Scenario Explorer */}
          <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-indigo-300">Scenario Explorer</h3>
                <p className="text-xs text-gray-500 mt-0.5">Click any scenario to instantly see emissions, pathway, and compliance impact</p>
              </div>
              <button
                onClick={() => setShowScenario(!showScenario)}
                className={`text-xs ${showScenario ? 'bg-violet-600 hover:bg-violet-500' : 'bg-gray-700 hover:bg-gray-600'} text-white px-3 py-1.5 rounded-lg font-semibold transition-all`}
              >
                {showScenario ? 'Hide Sliders' : 'Custom Sliders'}
              </button>
            </div>

            {/* Scenario Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: 'Edge Site (Small)',
                  badge: 'SMALL',
                  badgeColor: 'bg-green-900/30 text-green-400 border-green-800/40',
                  icon: '📡',
                  desc: 'Distributed edge node, minimal footprint',
                  params: { turbines: 4, mwPerTurbine: 15, hours: 4000, brickSavings: 20, gensetCount: 6, gensetHours: 100, datacenterMW: 40, siteAcres: 22, buildingSqFt: 5000, stories: 1, occupancyType: 'Business (B)', fireSuppression: 'Pre-action sprinkler', emergencyPowerConfig: '2N', powerSourceType: 'Grid-only', interconnectionVoltage: 69, transformerCapacity: 70 },
                  highlight: 'Fastest permit path',
                  highlightColor: 'text-green-400',
                  metrics: { mw: 60, nox: '19.8', psd: 'No', title5: 'No' },
                },
                {
                  title: 'Colocation Expansion',
                  badge: 'MID',
                  badgeColor: 'bg-blue-900/30 text-blue-400 border-blue-800/40',
                  icon: '🏢',
                  desc: 'Existing campus expansion, moderate scale',
                  params: { turbines: 8, mwPerTurbine: 25, hours: 6000, brickSavings: 15, gensetCount: 12, gensetHours: 150, datacenterMW: 133, siteAcres: 50, buildingSqFt: 16000, stories: 2, occupancyType: 'Business (B)', fireSuppression: 'Pre-action sprinkler', emergencyPowerConfig: 'N+1', powerSourceType: 'Hybrid (Grid + On-site)', interconnectionVoltage: 138, transformerCapacity: 230 },
                  highlight: 'Synthetic minor viable',
                  highlightColor: 'text-amber-400',
                  metrics: { mw: 200, nox: '52.8', psd: 'No', title5: 'Yes' },
                },
                {
                  title: 'Hyperscale Campus',
                  badge: 'LARGE',
                  badgeColor: 'bg-red-900/30 text-red-400 border-red-800/40',
                  icon: '🏗️',
                  desc: 'Full hyperscale buildout, major source',
                  params: { turbines: 16, mwPerTurbine: 50, hours: 7000, brickSavings: 25, gensetCount: 24, gensetHours: 100, datacenterMW: 533, siteAcres: 200, buildingSqFt: 65000, stories: 5, occupancyType: 'Business (B)', fireSuppression: 'Hybrid (pre-action + clean agent)', emergencyPowerConfig: '2N', powerSourceType: 'Hybrid (Grid + On-site)', interconnectionVoltage: 345, transformerCapacity: 920 },
                  highlight: 'PSD major source',
                  highlightColor: 'text-red-400',
                  metrics: { mw: 800, nox: '186.7', psd: 'Yes', title5: 'Yes' },
                },
                {
                  title: 'CA Nonattainment',
                  badge: 'CA',
                  badgeColor: 'bg-amber-900/30 text-amber-400 border-amber-800/40',
                  icon: '🌴',
                  desc: 'California site with NNSR/LAER requirements',
                  params: { turbines: 6, mwPerTurbine: 20, hours: 5000, brickSavings: 30, gensetCount: 8, gensetHours: 80, datacenterMW: 80, siteAcres: 35, state: 'California', lat: '37.3861', lon: '-122.0839', nonAttainment: true, nonAttainNOx: true, nonAttainPM25: true, nonAttainOzone: true, buildingSqFt: 10000, stories: 2, occupancyType: 'Business (B)', fireSuppression: 'Clean agent (FM-200/Novec)', emergencyPowerConfig: 'N+1', powerSourceType: 'Hybrid (Grid + On-site)', interconnectionVoltage: 69, transformerCapacity: 138 },
                  highlight: 'LAER + offsets needed',
                  highlightColor: 'text-amber-400',
                  metrics: { mw: 120, nox: '28.3', psd: 'No', title5: 'Yes' },
                },
              ].map(scenario => (
                <div key={scenario.title}
                  onClick={() => {
                    const s = scenario.params;
                    // Use a flag to indicate scenario loaded state
                    setInputs(prev => ({ ...prev, ...s, _scenario: scenario.title }));
                    if (s.lat) setLat(s.lat);
                    if (s.lon) setLon(s.lon);
                    if (s.siteAcres) setSiteAcres(s.siteAcres);
                    if (s.state) { setSelectedState(s.state); setInputs(prev => ({ ...prev, state: s.state })); }
                  }}
                  className={`rounded-xl border p-4 cursor-pointer transition-all duration-200
                    ${inputs._scenario === scenario.title 
                      ? 'border-indigo-500 bg-indigo-900/20 shadow-lg shadow-indigo-900/20' 
                      : 'border-gray-700/40 bg-gray-900/40 hover:border-indigo-700/40 hover:bg-gray-900/60'}`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{scenario.icon}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-200">{scenario.title}</h4>
                        <p className="text-[10px] text-gray-500">{scenario.desc}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${scenario.badgeColor}`}>{scenario.badge}</span>
                  </div>

                  {/* Metric badges */}
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    <div className="bg-gray-800/60 rounded-lg p-1.5 text-center">
                      <div className="text-[10px] text-gray-500">Capacity</div>
                      <div className="text-xs font-bold text-gray-200">{scenario.metrics.mw} MW</div>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-1.5 text-center">
                      <div className="text-[10px] text-gray-500">NOx</div>
                      <div className="text-xs font-bold text-gray-200">{scenario.metrics.nox} tpy</div>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-1.5 text-center">
                      <div className="text-[10px] text-gray-500">PSD</div>
                      <div className={`text-xs font-bold ${scenario.metrics.psd === 'Yes' ? 'text-red-400' : 'text-green-400'}`}>{scenario.metrics.psd}</div>
                    </div>
                    <div className="bg-gray-800/60 rounded-lg p-1.5 text-center">
                      <div className="text-[10px] text-gray-500">Title V</div>
                      <div className={`text-xs font-bold ${scenario.metrics.title5 === 'Yes' ? 'text-amber-400' : 'text-green-400'}`}>{scenario.metrics.title5}</div>
                    </div>
                  </div>

                  {/* Highlight & action */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-medium ${scenario.highlightColor}`}>{scenario.highlight}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const s = scenario.params;
                        setInputs(prev => ({ ...prev, ...s, _scenario: scenario.title }));
                        if (s.lat) setLat(s.lat);
                        if (s.lon) setLon(s.lon);
                        if (s.siteAcres) setSiteAcres(s.siteAcres);
                        if (s.state) { setSelectedState(s.state); setInputs(prev => ({ ...prev, state: s.state })); }
                        setActiveTab('intake');
                      }}
                      className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-lg font-medium transition-all"
                    >
                      Apply → Intake
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Scenario summary note */}
            <div className="mt-3 text-center">
              <span className="text-[10px] text-gray-600">
                Click any card to preview its impact on the map and metrics. 
                <span className="text-indigo-500"> Apply &rarr; Intake</span> to run full screening.
              </span>
            </div>
          </div>

          {/* Custom Scenario Sliders (togglable) */}
          {showScenario && (
            <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 p-5">
              <h3 className="text-sm font-semibold text-violet-300 mb-4">Custom Scenario Builder</h3>
              <p className="text-xs text-gray-500 mb-4">Fine-tune parameters manually and see instant PTE results. Apply to sync with Site Intake.</p>
              <ScenarioTest inputs={inputs} onApply={handleApplyScenario} onNavigateToIntake={() => setActiveTab('intake')} />
            </div>
          )}

          {/* Quick Map Reference */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
            <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
              <span>Quick Reference</span>
              <span className="text-[10px] text-gray-600 font-normal">Map controls &amp; site info</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800/40 rounded-lg p-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0 opacity-60"></span>
                <span className="text-gray-400">Drag marker / click map to reposition</span>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2 flex items-center gap-2">
                <div className="w-4 h-2 border border-indigo-400 border-dashed rounded flex-shrink-0"></div>
                <span className="text-gray-400">Boundary auto-scaled to acreage</span>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-blue-500 flex-shrink-0"></span>
                <span className="text-gray-400">Toggle Street / Satellite (top-right)</span>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2 flex items-center gap-2">
                <span className="text-gray-500 font-mono text-[10px]">+/-</span>
                <span className="text-gray-400">Zoom controls &amp; mouse wheel</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-600">
              <span>Current: <span className="text-gray-400 font-medium">{inputs.turbines}&times;{inputs.mwPerTurbine}MW</span></span>
              <span className="text-gray-700">|</span>
              <span>State: <span className="text-gray-400">{selectedState}</span></span>
              <span className="text-gray-700">|</span>
              <span>Acres: <span className="text-gray-400">{siteAcres}</span></span>
            </div>
          </div>
        </div></div>
    </div>
  );
}