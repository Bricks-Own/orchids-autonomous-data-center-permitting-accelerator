import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calcPTE } from '../utils/calculations';
import { US_STATES } from '../data/permitData';

// ─── Leaflet Map Component ──────────────────────────────────────────────────
function SiteMap({ lat, lon, onLatLonChange, onBoundaryChange, siteAcres }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const rectangleRef = useRef(null);
  const [leaflet, setLeaflet] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Dynamically import leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default icon path for webpack/vite
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
      attributionControl: false,
    });

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add marker for site location
    const marker = leaflet.marker([parseFloat(lat) || 36.1627, parseFloat(lon) || -86.7816], {
      draggable: true,
    }).addTo(map);

    marker.on('dragend', function() {
      const pos = this.getLatLng();
      onLatLonChange(pos.lat.toFixed(4), pos.lng.toFixed(4));
    });

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // Draw initial boundary rectangle
    updateBoundary(leaflet, map, parseFloat(lat) || 36.1627, parseFloat(lon) || -86.7816);

    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leaflet, lat, lon]);

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

    // Approximate 45 acres as a ~1400ft x 1400ft square (0.0043 deg)
    // Scale from siteAcres if available
    const acres = Math.max(1, siteAcres || 45);
    const sideDeg = Math.sqrt(acres) * 0.00036; // rough conversion

    const bounds = [
      [latVal - sideDeg, lonVal - sideDeg],
      [latVal + sideDeg, lonVal + sideDeg],
    ];

    const rect = L.rectangle(bounds, {
      color: '#6366f1',
      weight: 2,
      fillColor: '#6366f1',
      fillOpacity: 0.1,
      dashArray: '5, 5',
    }).addTo(map);

    // Allow resize by dragging corners
    rect.editing = true;
    rectangleRef.current = rect;

    if (onBoundaryChange) {
      onBoundaryChange(acres);
    }
  };

  // Helper: rough lat-lng to area calculation
  const calcAcresFromBounds = useCallback((bounds) => {
    const [sw, ne] = bounds;
    const latDiff = Math.abs(ne[0] - sw[0]);
    const lngDiff = Math.abs(ne[1] - sw[1]);
    // 1 deg lat ≈ 69 mi, 1 deg lng ≈ 69*cos(lat) mi
    const latMi = latDiff * 69;
    const lngMi = lngDiff * 69 * Math.cos((parseFloat(lat) || 36) * Math.PI / 180);
    const sqMi = latMi * lngMi;
    return Math.round(sqMi * 640); // sq mi to acres
  }, [lat]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700/40">
      <div ref={mapRef} style={{ height: '400px', width: '100%', background: '#111827' }} />
      {!leaflet && (
        <div className="h-[400px] flex items-center justify-center bg-gray-900 text-gray-500 text-sm">
          Loading map...
        </div>
      )}
    </div>
  );
}

// ─── Quick Scenario Test ────────────────────────────────────────────────────
function ScenarioTest({ inputs, onApply }) {
  const [params, setParams] = useState({ ...inputs });
  const [results, setResults] = useState(null);

  const updateParam = (key, value) => {
    const updated = { ...params, [key]: value };
    setParams(updated);
    // Recalculate PTE instantly
    try {
      const calc = calcPTE(updated);
      setResults(calc);
    } catch { /* ignore calculation errors */ }
  };

  // Generate initial results
  useEffect(() => {
    try {
      const calc = calcPTE(params);
      setResults(calc);
    } catch { /* ignore */ }
  }, []);

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
      {/* Sliders */}
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

      {/* Instant PTE Results */}
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

          {/* Pathway summary */}
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

      {/* Apply button */}
      <button
        onClick={() => onApply(params)}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showScenario, setShowScenario] = useState(false);

  const handleLatLonChange = (newLat, newLon) => {
    setLat(newLat);
    setLon(newLon);
    setInputs(prev => ({ ...prev, lat: newLat, lon: newLon }));
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

  // Quick state / location presets for testing
  const locationPresets = [
    { label: 'BigWatt HQ — Nashville, TN', state: 'Tennessee', lat: '36.1627', lon: '-86.7816', acres: 45 },
    { label: 'Ashburn, VA (Data Center Alley)', state: 'Virginia', lat: '39.0438', lon: '-77.4874', acres: 35 },
    { label: 'Phoenix, AZ (Edge)', state: 'Arizona', lat: '33.4484', lon: '-112.0740', acres: 20 },
    { label: 'Dallas, TX (Hyperscale)', state: 'Texas', lat: '32.7767', lon: '-96.7970', acres: 80 },
    { label: 'Silicon Valley, CA', state: 'California', lat: '37.3861', lon: '-122.0839', acres: 15 },
    { label: 'Columbus, OH (AWS Region)', state: 'Ohio', lat: '39.9612', lon: '-82.9988', acres: 60 },
    { label: 'Atlanta, GA (Edge)', state: 'Georgia', lat: '33.7490', lon: '-84.3880', acres: 25 },
    { label: 'Northern Virginia (AWS/US East)', state: 'Virginia', lat: '38.8339', lon: '-77.3373', acres: 100 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Site Planner — BigWatt Digital Test Bed</h2>
            <p className="text-xs text-gray-500">Explore different site configurations, visualize boundaries on the map, and instantly test how parameters affect your permit pathway.</p>
          </div>
          <button
            onClick={() => setActiveTab('intake')}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700/60 transition-colors"
          >
            → Open Full Site Intake
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left Column: Map Controls */}
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
                <span className="text-xs text-gray-600">Drag marker to reposition site</span>
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
            <div className="mt-2 flex items-center justify-between">
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
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span>State: <span className="text-gray-400 font-medium">{selectedState}</span></span>
                <span>~{Math.round(siteAcres * 0.4047)} hectares</span>
              </div>
            </div>
          </div>

          {/* Site Details Summary */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">Current Site Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Turbines', value: `${inputs.turbines} × ${inputs.mwPerTurbine} MW` },
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
                onClick={() => { setInputs(prev => ({ ...prev, lat, lon, siteAcres })); setActiveTab('intake'); }}
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
              <ScenarioTest inputs={inputs} onApply={handleApplyScenario} />
            </div>
          )}
        </div>

        {/* Right Column: Info Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Test Use Cases */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
            <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">Test Scenarios</h3>
            <div className="space-y-3">
              {[
                {
                  title: 'Edge Site (Small)',
                  icon: 'Small',
                  desc: '4 turbines × 15 MW, 4000 hr/yr, 20% savings, 20 acres',
                  params: { turbines: 4, mwPerTurbine: 15, hours: 4000, brickSavings: 20, gensetCount: 6, gensetHours: 100, datacenterMW: 40, siteAcres: 20 },
                },
                {
                  title: 'Hyperscale Campus (Large)',
                  icon: 'Large',
                  desc: '16 turbines × 50 MW, 7000 hr/yr, 25% savings, 100 acres',
                  params: { turbines: 16, mwPerTurbine: 50, hours: 7000, brickSavings: 25, gensetCount: 24, gensetHours: 100, datacenterMW: 500, siteAcres: 100 },
                },
                {
                  title: 'Colocation Expansion',
                  icon: 'Mid',
                  desc: '8 turbines × 25 MW, 6000 hr/yr, 15% savings, 45 acres',
                  params: { turbines: 8, mwPerTurbine: 25, hours: 6000, brickSavings: 15, gensetCount: 12, gensetHours: 150, datacenterMW: 160, siteAcres: 45 },
                },
                {
                  title: 'California Nonattainment',
                  icon: 'CA',
                  desc: '6 turbines × 20 MW, 5000 hr/yr, 30% savings, CA location',
                  params: { turbines: 6, mwPerTurbine: 20, hours: 5000, brickSavings: 30, gensetCount: 8, gensetHours: 80, datacenterMW: 80, siteAcres: 15, state: 'California', nonAttainment: true, nonAttainNOx: true, nonAttainPM25: true, nonAttainOzone: true },
                },
              ].map(scenario => (
                <div key={scenario.title} className="border border-gray-700/40 rounded-lg p-3 hover:border-indigo-700/40 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-sm font-semibold text-gray-200">{scenario.title}</h4>
                    <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{scenario.icon}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{scenario.desc}</p>
                  <button
                    onClick={() => {
                      setInputs(prev => ({ ...prev, ...scenario.params }));
                      if (scenario.params.lat) { setLat(scenario.params.lat); }
                      if (scenario.params.lon) { setLon(scenario.params.lon); }
                      if (scenario.params.state) { setSelectedState(scenario.params.state); }
                      if (scenario.params.siteAcres) { setSiteAcres(scenario.params.siteAcres); }
                    }}
                    className="text-xs bg-indigo-900/40 hover:bg-indigo-800/40 text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-800/40 transition-colors"
                  >
                    Load Scenario
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">Quick Reference</h3>
            <div className="space-y-2 text-xs">
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <div className="text-gray-500 mb-1">PSD Threshold</div>
                <div className="text-gray-300 font-mono">100 tpy per criteria pollutant</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <div className="text-gray-500 mb-1">Typical Data Center Acreage</div>
                <div className="text-gray-300 font-mono">15-100 acres (varies by MW)</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <div className="text-gray-500 mb-1">1 acre ≈</div>
                <div className="text-gray-300 font-mono">43,560 sq ft · 0.4047 ha · ~208 ft × 208 ft</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <div className="text-gray-500 mb-1">Leaflet Map Layer</div>
                <div className="text-gray-300">OpenStreetMap (free, no API key)</div>
              </div>
              <div className="bg-gray-800/40 rounded-lg p-2.5">
                <div className="text-gray-500 mb-1">Google Maps Alternative</div>
                <div className="text-gray-300">Requires API key — contact BigWatt IT</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}