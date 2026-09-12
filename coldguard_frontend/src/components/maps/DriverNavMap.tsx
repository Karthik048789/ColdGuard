'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

export interface RouteStep {
  instruction?: string;
  distance_m?: number;
  duration_seconds?: number;
  location?: { latitude: number; longitude: number };
}

export interface FacilityItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  city?: string;
  available_capacity?: number;
}

export interface NavMapProps {
  routeCoordinates: [number, number][]; // [[lng, lat], ...] from OSRM
  routeSteps?: RouteStep[];
  isNavigating: boolean;
  isEmergency?: boolean;
  currentStreet?: string;
  nextStep?: any;
  originCoord?: [number, number] | null; // [lng, lat]
  originName?: string;
  destinationCoord?: [number, number] | null; // [lng, lat]
  destinationName?: string;
  facilityCoord?: [number, number] | null; // [lng, lat]
  facilityName?: string;
  facilities?: FacilityItem[];
  onLocationUpdate?: (lng: number, lat: number, speed: number) => void;
  onArrival?: () => void;
  className?: string;
}

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const dLng = (lng2 - lng1) * toRad;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (Math.atan2(y, x) * toDeg + 360) % 360;
}

function getTurnIcon(instruction: string = ''): string {
  const lower = instruction.toLowerCase();
  if (lower.includes('slight right')) return '↗';
  if (lower.includes('slight left')) return '↖';
  if (lower.includes('sharp right')) return '↳';
  if (lower.includes('sharp left')) return '↲';
  if (lower.includes('right')) return '↱';
  if (lower.includes('left')) return '↰';
  if (lower.includes('arrive')) return '🏁';
  if (lower.includes('fork') || lower.includes('ramp')) return '↗';
  return '↑';
}

export default function DriverNavMap({
  routeCoordinates,
  routeSteps = [],
  isNavigating,
  isEmergency = false,
  currentStreet = 'NH 66 Panaji-Margao Hwy',
  originCoord,
  originName = 'Goa Medical College (GMC) Central Vault',
  destinationCoord,
  destinationName = 'South Goa District Hospital',
  facilityCoord,
  facilityName = 'Cold Storage Facility',
  facilities = [],
  onLocationUpdate,
  onArrival,
  className = 'w-full h-full',
}: NavMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  // Markers
  const puckMarkerRef = useRef<any>(null);
  const polylineCasingRef = useRef<any>(null);
  const polylineCoreRef = useRef<any>(null);

  // Camera mode
  const [cameraMode, setCameraMode] = useState<'drive' | 'overview'>('overview');
  const cameraModeRef = useRef<'drive' | 'overview'>('overview');
  cameraModeRef.current = cameraMode;

  // Animation & simulation refs
  const animIdRef = useRef<number | null>(null);
  const routeIndexRef = useRef<number>(0);
  const routeCoordsRef = useRef<[number, number][]>(routeCoordinates);
  routeCoordsRef.current = routeCoordinates;
  const routeStepsRef = useRef<RouteStep[]>(routeSteps);
  routeStepsRef.current = routeSteps;

  const isNavigatingRef = useRef<boolean>(isNavigating);
  isNavigatingRef.current = isNavigating;
  const isEmergencyRef = useRef<boolean>(isEmergency);
  isEmergencyRef.current = isEmergency;
  const onArrivalRef = useRef<(() => void) | undefined>(onArrival);
  onArrivalRef.current = onArrival;
  const onLocationUpdateRef = useRef<((lng: number, lat: number, speed: number) => void) | undefined>(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;

  // Live HUD Navigation State
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [remainingKm, setRemainingKm] = useState<string>('18.0');
  const [etaMinutes, setEtaMinutes] = useState<number>(18);
  const [activeStepText, setActiveStepText] = useState<string>('Depart onto NH 66');
  const [activeStepDist, setActiveStepDist] = useState<string>('750 m');
  const [activeTurnIcon, setActiveTurnIcon] = useState<string>('↑');

  // Fit overview bounds
  const fitOverview = useCallback(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    const coords = routeCoordsRef.current;
    if (coords && coords.length > 0) {
      const latLngs = coords.map((c) => [c[1], c[0]]);
      const bounds = L.latLngBounds(latLngs as any);

      if (originCoord) bounds.extend([originCoord[1], originCoord[0]]);
      if (destinationCoord) bounds.extend([destinationCoord[1], destinationCoord[0]]);

      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [originCoord, destinationCoord]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !containerRef.current) return;

      LRef.current = L;

      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });

      const initialLat = routeCoordinates.length > 0 ? routeCoordinates[0][1] : 15.4647;
      const initialLng = routeCoordinates.length > 0 ? routeCoordinates[0][0] : 73.8560;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 11,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapRef.current = map;

      // Initial fit
      if (routeCoordsRef.current && routeCoordsRef.current.length > 0) {
        const latLngs = routeCoordsRef.current.map((c) => [c[1], c[0]]);
        map.fitBounds(L.latLngBounds(latLngs as any), { padding: [50, 50], maxZoom: 14 });
      }
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Route Polyline & Markers on data change
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !L || !layerGroup) return;

    routeIndexRef.current = 0;
    layerGroup.clearLayers();

    const coords = routeCoordinates;
    if (!coords || coords.length < 2) return;

    // 1. OSRM Road Polyline (Dual Layer: Deep Navy Casing + Electric Blue Core)
    const latLngs: [number, number][] = coords.map((c) => [c[1], c[0]]);

    const casing = L.polyline(latLngs, {
      color: '#174ea6',
      weight: 12,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    });
    casing.addTo(layerGroup);
    polylineCasingRef.current = casing;

    const core = L.polyline(latLngs, {
      color: isEmergency ? '#dc2626' : '#1a73e8',
      weight: 7,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    });
    core.addTo(layerGroup);
    polylineCoreRef.current = core;

    // 2. Start Marker (🟢 START)
    const startPt = originCoord ? [originCoord[1], originCoord[0]] : latLngs[0];
    const shortOrigin = (originName || 'Origin Vault').split(',')[0];
    const startIcon = L.divIcon({
      className: 'cg-start-pin',
      html: `
        <div style="background:#16a34a;color:#ffffff;padding:5px 12px;border-radius:14px;font-size:11px;font-weight:900;box-shadow:0 4px 16px rgba(22,163,74,0.6);border:2px solid #ffffff;display:flex;align-items:center;gap:5px;white-space:nowrap;transform:translate(-50%,-100%);">
          <span style="font-size:13px;">🟢</span> <span>START: ${shortOrigin}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(startPt as [number, number], { icon: startIcon, zIndexOffset: 800 }).addTo(layerGroup);

    // 3. Drop Marker (📍 DROP)
    const destPt = destinationCoord ? [destinationCoord[1], destinationCoord[0]] : latLngs[latLngs.length - 1];
    const shortDest = (destinationName || 'Hospital').split(',')[0];
    const destIcon = L.divIcon({
      className: 'cg-dest-pin',
      html: `
        <div style="background:#dc2626;color:#ffffff;padding:5px 12px;border-radius:14px;font-size:11px;font-weight:900;box-shadow:0 4px 16px rgba(220,38,38,0.6);border:2px solid #ffffff;display:flex;align-items:center;gap:5px;white-space:nowrap;transform:translate(-50%,-100%);">
          <span style="font-size:13px;">📍</span> <span>DROP: ${shortDest}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(destPt as [number, number], { icon: destIcon, zIndexOffset: 800 }).addTo(layerGroup);

    // 4. All 10 Cold-Storage Facilities Across Goa (❄️)
    if (facilities && facilities.length > 0) {
      facilities.forEach((f) => {
        if (!f.latitude || !f.longitude) return;

        // Skip exact overlap with start/drop
        if (originCoord && Math.abs(f.latitude - originCoord[1]) < 0.003 && Math.abs(f.longitude - originCoord[0]) < 0.003) return;
        if (destinationCoord && Math.abs(f.latitude - destinationCoord[1]) < 0.003 && Math.abs(f.longitude - destinationCoord[0]) < 0.003) return;

        const shortName = f.name
          .split(',')[0]
          .replace('Community Health & Specialty Center', 'CHC')
          .replace('Community Health Center', 'CHC')
          .replace('Sub District Hospital', 'SDH')
          .replace('Sub-District Hospital', 'SDH');

        const facIcon = L.divIcon({
          className: 'cg-fac-pin',
          html: `
            <div style="background:rgba(15,23,42,0.92);color:#c084fc;padding:4px 9px;border-radius:12px;font-size:10px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,0.5);border:1.5px solid #a855f7;display:flex;align-items:center;gap:4px;white-space:nowrap;transform:translate(-50%,-100%);cursor:pointer;">
              <span style="font-size:12px;">❄️</span> <span>${shortName}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker([f.latitude, f.longitude], { icon: facIcon, zIndexOffset: 600 }).addTo(layerGroup);
      });
    }

    // 5. Active Emergency Diversion Facility (⚠️)
    if (facilityCoord && (isEmergency || isNavigating)) {
      const shortFac = (facilityName || 'Emergency Vault').split(',')[0];
      const emergIcon = L.divIcon({
        className: 'cg-emerg-pin',
        html: `
          <div style="background:#7c3aed;color:#ffffff;padding:7px 14px;border-radius:16px;font-size:11px;font-weight:900;box-shadow:0 4px 22px rgba(124,58,237,0.8);border:2.5px solid #ffffff;display:flex;align-items:center;gap:6px;white-space:nowrap;transform:translate(-50%,-100%);animation:cgPulse 1.2s infinite;">
            <span style="font-size:14px;">❄️ EMERGENCY TARGET:</span> <span>${shortFac}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([facilityCoord[1], facilityCoord[0]], { icon: emergIcon, zIndexOffset: 950 }).addTo(layerGroup);
    }

    // 6. Navigation Vehicle Puck
    const firstLat = latLngs[0][0];
    const firstLng = latLngs[0][1];
    const puckIcon = L.divIcon({
      className: 'cg-puck-pin',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);pointer-events:none;">
          <div style="width:42px;height:42px;border-radius:50%;background:#ffffff;box-shadow:0 4px 18px rgba(0,0,0,0.4),0 0 0 3px rgba(26,115,232,0.6);display:flex;align-items:center;justify-content:center;">
            <svg id="cg-puck-chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" style="transform:rotate(0deg);transition:transform 0.15s ease-out;">
              <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="#1a73e8" stroke="#174ea6" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>
          <span id="cg-street-pill" style="margin-top:4px;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.95);color:#1e3a8a;font-size:10px;font-weight:800;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:1px solid #bfdbfe;white-space:nowrap;">
            ${currentStreet}
          </span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const puckMarker = L.marker([firstLat, firstLng], { icon: puckIcon, zIndexOffset: 1000 });
    puckMarker.addTo(layerGroup);
    puckMarkerRef.current = puckMarker;

    // Fit camera to route
    if (!isNavigating) {
      map.fitBounds(casing.getBounds(), { padding: [50, 50], maxZoom: 14 });
    }
  }, [routeCoordinates, isEmergency, isNavigating, facilities, originCoord, originName, destinationCoord, destinationName, facilityCoord, facilityName]);

  // -------------------------------------------------------------
  // HIGH-PERFORMANCE FLUID DRIVING ENGINE (~60 km/h)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isNavigating) {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      setCurrentSpeed(0);
      setCameraMode('overview');
      return;
    }

    setCameraMode('drive');
    const map = mapRef.current;
    if (!map) return;

    map.setZoom(15);

    let lastTime = performance.now();
    let lastThrottledUpdate = 0;

    const tick = (now: number) => {
      const coords = routeCoordsRef.current;
      if (!coords || coords.length < 2) {
        animIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Realistic speed ~58-62 km/h
      const speed = 58 + Math.sin(now / 1400) * 3 + Math.random() * 1.5;

      const isEmerg = isEmergencyRef.current;
      const stepRate = isEmerg ? 1.05 : 0.75;

      let idx = routeIndexRef.current + dt * stepRate;

      if (idx >= coords.length - 1) {
        idx = coords.length - 1;
        routeIndexRef.current = idx;
        const lastPt = coords[coords.length - 1];
        if (puckMarkerRef.current && Array.isArray(lastPt)) {
          puckMarkerRef.current.setLatLng([lastPt[1], lastPt[0]]);
          map.panTo([lastPt[1], lastPt[0]], { animate: false });
        }
        setCurrentSpeed(0);
        if (onLocationUpdateRef.current && Array.isArray(lastPt)) {
          onLocationUpdateRef.current(lastPt[0], lastPt[1], 0);
        }
        if (onArrivalRef.current) {
          onArrivalRef.current();
        }
        return;
      }

      routeIndexRef.current = idx;
      const baseIdx = Math.floor(idx);
      const frac = idx - baseIdx;

      const p1 = coords[baseIdx];
      const p2 = coords[Math.min(baseIdx + 1, coords.length - 1)];

      if (Array.isArray(p1) && Array.isArray(p2)) {
        // Interpolate exact position [lng, lat]
        const lng = p1[0] + (p2[0] - p1[0]) * frac;
        const lat = p1[1] + (p2[1] - p1[1]) * frac;

        // Calculate tangent road bearing
        const bearing = calculateBearing(p1[1], p1[0], p2[1], p2[0]);

        if (puckMarkerRef.current) {
          puckMarkerRef.current.setLatLng([lat, lng]);
          const chevronEl = document.getElementById('cg-puck-chevron');
          if (chevronEl) {
            chevronEl.style.transform = `rotate(${bearing}deg)`;
          }
        }

        // Camera follow
        if (cameraModeRef.current === 'drive') {
          map.panTo([lat, lng], { animate: false });
        }

        // Throttled update to React HUD (every 1 second)
        if (now - lastThrottledUpdate > 1000) {
          lastThrottledUpdate = now;
          setCurrentSpeed(Math.round(speed));

          const totalPts = coords.length - 1;
          const remainingPts = Math.max(0, totalPts - baseIdx);
          const remKm = Math.max(0.1, (remainingPts * 0.05)).toFixed(1);
          const remMin = Math.max(1, Math.round((parseFloat(remKm) / 58) * 60));
          setRemainingKm(remKm);
          setEtaMinutes(remMin);

          // Dynamic Turn-by-Turn Maneuver Matching
          const steps = routeStepsRef.current;
          if (steps && steps.length > 0) {
            const fractionDone = baseIdx / totalPts;
            const totalDistM = steps.reduce((sum, s) => sum + (s.distance_m || 0), 0) || 18000;
            const distTraveled = fractionDone * totalDistM;

            let accum = 0;
            let foundStep: RouteStep | null = null;
            let distToManeuver = 300;

            for (let i = 0; i < steps.length; i++) {
              accum += (steps[i].distance_m || 0);
              if (accum > distTraveled) {
                foundStep = steps[i];
                distToManeuver = Math.max(20, Math.round(accum - distTraveled));
                break;
              }
            }

            if (foundStep) {
              const instr = foundStep.instruction || 'Continue on route';
              setActiveStepText(instr);
              setActiveTurnIcon(getTurnIcon(instr));
              if (distToManeuver > 1000) {
                setActiveStepDist(`${(distToManeuver / 1000).toFixed(1)} km`);
              } else {
                setActiveStepDist(`${distToManeuver} m`);
              }
              const streetEl = document.getElementById('cg-street-pill');
              if (streetEl) streetEl.innerText = instr;
            }
          } else {
            const turnM = Math.max(50, (remainingPts % 12 + 1) * 60);
            setActiveStepDist(`${turnM} m`);
            setActiveTurnIcon(isEmerg ? '↱' : '↗');
            setActiveStepText(isEmerg ? `Diverting to ${facilityName}` : `Heading to ${destinationName}`);
          }

          if (onLocationUpdateRef.current) {
            onLocationUpdateRef.current(lng, lat, speed);
          }
        }
      }

      animIdRef.current = requestAnimationFrame(tick);
    };

    animIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [isNavigating, facilityName, destinationName]);

  const toggleCameraMode = () => {
    const map = mapRef.current;
    if (!map) return;

    if (cameraMode === 'drive') {
      setCameraMode('overview');
      fitOverview();
    } else {
      setCameraMode('drive');
      const coords = routeCoordsRef.current;
      const idx = Math.floor(routeIndexRef.current);
      const currentPt = coords && coords[idx] ? coords[idx] : [73.856, 15.4647];
      map.setView([currentPt[1], currentPt[0]], 15, { animate: true });
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  return (
    <div className={`relative ${className} overflow-hidden bg-slate-900`}>
      {/* Leaflet DOM & SVG Canvas */}
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Floating Google Maps Turn Banner */}
      <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex justify-center">
        <div className="bg-[#1a73e8] text-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl shadow-blue-950/40 border border-blue-300/40 flex items-center gap-3 max-w-sm w-full">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black shrink-0">
            {activeTurnIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-extrabold text-blue-100 uppercase tracking-wider">
              {isEmergency
                ? `Emergency Reroute • In ${activeStepDist}`
                : isNavigating
                ? `In ${activeStepDist}`
                : 'Navigation Route'}
            </div>
            <div className="text-xs font-black truncate text-white leading-tight">
              {isEmergency
                ? `Facility: ${facilityName}`
                : isNavigating
                ? activeStepText
                : `Route to ${destinationName}`}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Map Controls (Bottom-Right) */}
      <div className="absolute bottom-28 right-3 z-30 flex flex-col gap-2 pointer-events-auto">
        {/* Toggle Overview vs Track Vehicle */}
        <button
          onClick={toggleCameraMode}
          className="bg-slate-900/90 hover:bg-slate-800 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          title="Toggle Full Route Overview vs Track Vehicle"
        >
          <span>{cameraMode === 'drive' ? '🗺️' : '🧭'}</span>
          <span>{cameraMode === 'drive' ? 'Overview' : 'Track'}</span>
        </button>

        {/* Fit Entire Route across Goa */}
        <button
          onClick={fitOverview}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-black rounded-xl border border-slate-700 shadow-xl backdrop-blur-md flex items-center justify-center cursor-pointer transition-all active:scale-95 self-end"
          title="Fit Route across Goa"
        >
          ⛶
        </button>

        {/* Zoom In / Out */}
        <div className="bg-slate-900/90 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md flex flex-col overflow-hidden self-end">
          <button
            onClick={handleZoomIn}
            className="w-9 h-8 hover:bg-slate-800 text-white text-base font-black flex items-center justify-center cursor-pointer border-b border-slate-700/60 transition-all active:scale-95"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-9 h-8 hover:bg-slate-800 text-white text-base font-black flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title="Zoom Out"
          >
            −
          </button>
        </div>
      </div>

      {/* Live Speedometer (Bottom-Left) */}
      <div className="absolute bottom-24 left-4 z-20 pointer-events-none flex flex-col items-center">
        <div className="w-13 h-13 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border-2 border-blue-600 shadow-xl flex flex-col items-center justify-center text-slate-900">
          <span className="text-base font-black leading-none font-mono">{currentSpeed}</span>
          <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-tighter">km/h</span>
        </div>
      </div>

      {/* Live ETA Badge (Bottom-Center) */}
      {isNavigating && (
        <div className="absolute bottom-24 left-0 right-0 z-20 pointer-events-none flex justify-center">
          <div className="bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 text-[11px] font-bold">
            <span className="text-emerald-400">● {etaMinutes} min</span>
            <span className="text-slate-400">({remainingKm} km)</span>
            <span className="text-slate-300">• On Route</span>
          </div>
        </div>
      )}
    </div>
  );
}
