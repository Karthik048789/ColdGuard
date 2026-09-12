'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface RouteStep {
  instruction?: string;
  distance_m?: number;
  duration_seconds?: number;
  location?: { latitude: number; longitude: number };
}

export interface NavMapProps {
  routeCoordinates: [number, number][]; // [[lng, lat], ...]
  routeSteps?: RouteStep[];
  isNavigating: boolean;
  isEmergency?: boolean;
  currentStreet?: string;
  nextStep?: any;
  destinationCoord?: [number, number] | null;
  destinationName?: string;
  facilityCoord?: [number, number] | null;
  facilityName?: string;
  onLocationUpdate?: (lng: number, lat: number, speed: number) => void;
  onArrival?: () => void;
  className?: string;
}

const CARTO_KEY = 'cb1_3ig8_1_11956d158c962eee4dd04aed';

// Valid GeoJSON FeatureCollection initialization
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
        `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
        `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
        `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
    'route-source': {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 20,
    },
    {
      id: 'route-casing',
      type: 'line',
      source: 'route-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#174ea6', // Deep navy outer casing for Google Maps depth
        'line-width': 12,
        'line-opacity': 0.95,
      },
    },
    {
      id: 'route-line',
      type: 'line',
      source: 'route-source',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#1a73e8', // Google Maps vibrant electric blue navigation line
        'line-width': 7.5,
        'line-opacity': 1,
      },
    },
  ],
};

function calculateBearing(lng1: number, lat1: number, lng2: number, lat2: number): number {
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

export default function MapLibreNavMap({
  routeCoordinates,
  routeSteps = [],
  isNavigating,
  isEmergency = false,
  currentStreet = 'NH 66 Panaji-Margao Hwy',
  destinationCoord,
  destinationName = 'South Goa District Hospital',
  facilityCoord,
  facilityName = 'Cold Storage Facility',
  onLocationUpdate,
  onArrival,
  className = 'w-full h-full',
}: NavMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const puckMarkerRef = useRef<maplibregl.Marker | null>(null);
  const puckElRef = useRef<HTMLDivElement | null>(null);
  const streetPillRef = useRef<HTMLSpanElement | null>(null);
  const arrowSvgRef = useRef<SVGElement | null>(null);

  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const facMarkerRef = useRef<maplibregl.Marker | null>(null);

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

  // Dynamic Navigation Live State
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [remainingKm, setRemainingKm] = useState<string>('18.0');
  const [etaMinutes, setEtaMinutes] = useState<number>(18);
  const [activeStepText, setActiveStepText] = useState<string>('Depart onto NH 66');
  const [activeStepDist, setActiveStepDist] = useState<string>('750 m');
  const [activeTurnIcon, setActiveTurnIcon] = useState<string>('↑');

  // Robust function to draw or update the route polyline on MapLibre
  const drawOrUpdateRoute = useCallback((map: maplibregl.Map, coords: [number, number][], emergency: boolean) => {
    if (!map || !coords || coords.length < 2) return;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    };

    const source = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else {
      try {
        map.addSource('route-source', {
          type: 'geojson',
          data: geojson,
        });
      } catch (e) {}
    }

    if (!map.getLayer('route-casing')) {
      try {
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': emergency ? '#7f1d1d' : '#174ea6',
            'line-width': 12,
            'line-opacity': 0.95,
          },
        });
      } catch (e) {}
    }

    if (!map.getLayer('route-line')) {
      try {
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': emergency ? '#dc2626' : '#1a73e8',
            'line-width': 7.5,
            'line-opacity': 1,
          },
        });
      } catch (e) {}
    }

    try {
      if (map.getLayer('route-line')) {
        map.setPaintProperty('route-line', 'line-color', emergency ? '#dc2626' : '#1a73e8');
      }
      if (map.getLayer('route-casing')) {
        map.setPaintProperty('route-casing', 'line-color', emergency ? '#7f1d1d' : '#174ea6');
      }
    } catch (e) {}
  }, []);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCoord: [number, number] = routeCoordinates.length > 0 && routeCoordinates[0]?.length >= 2
      ? [routeCoordinates[0][0], routeCoordinates[0][1]]
      : [73.856, 15.4647];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE,
      center: initialCoord,
      zoom: 14.5,
      pitch: 45,
      bearing: 180,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right');

    map.on('load', () => {
      if (routeCoordsRef.current && routeCoordsRef.current.length > 1) {
        drawOrUpdateRoute(map, routeCoordsRef.current, isEmergencyRef.current);
        const bounds = new maplibregl.LngLatBounds();
        routeCoordsRef.current.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: { top: 70, bottom: 90, left: 40, right: 40 }, maxZoom: 15 });
      }
    });

    // Create Google Maps Navigation Puck (Marker)
    const puckEl = document.createElement('div');
    puckEl.style.display = 'flex';
    puckEl.style.flexDirection = 'column';
    puckEl.style.alignItems = 'center';
    puckEl.style.transform = 'translate(-50%, -50%)';
    puckEl.style.pointerEvents = 'none';

    // Circular white puck with blue border
    const circle = document.createElement('div');
    circle.style.width = '42px';
    circle.style.height = '42px';
    circle.style.borderRadius = '50%';
    circle.style.background = '#ffffff';
    circle.style.boxShadow = '0 4px 18px rgba(0,0,0,0.35), 0 0 0 3px rgba(26,115,232,0.45)';
    circle.style.display = 'flex';
    circle.style.alignItems = 'center';
    circle.style.justifyContent = 'center';

    // SVG Blue Navigation Chevron
    circle.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="cg-puck-svg" style="transition: transform 0.15s ease-out;">
        <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="#1a73e8" stroke="#174ea6" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;

    // Street pill chip below puck
    const pill = document.createElement('span');
    pill.style.marginTop = '4px';
    pill.style.padding = '2px 8px';
    pill.style.borderRadius = '12px';
    pill.style.background = 'rgba(255,255,255,0.95)';
    pill.style.color = '#1e3a8a';
    pill.style.fontSize = '10px';
    pill.style.fontWeight = '800';
    pill.style.letterSpacing = '0.3px';
    pill.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
    pill.style.whiteSpace = 'nowrap';
    pill.style.border = '1px solid #bfdbfe';
    pill.innerText = currentStreet;

    puckEl.appendChild(circle);
    puckEl.appendChild(pill);

    puckElRef.current = puckEl;
    streetPillRef.current = pill;
    arrowSvgRef.current = circle.querySelector('svg');

    const marker = new maplibregl.Marker({ element: puckEl, rotationAlignment: 'map' })
      .setLngLat(initialCoord)
      .addTo(map);

    puckMarkerRef.current = marker;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Route Polyline & Bounds whenever routeCoordinates or emergency changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routeIndexRef.current = 0; // Reset progress for new route

    if (routeCoordinates && routeCoordinates.length > 0) {
      const firstPt = routeCoordinates[0];
      if (puckMarkerRef.current && Array.isArray(firstPt)) {
        puckMarkerRef.current.setLngLat(firstPt);
        map.jumpTo({ center: firstPt });
      }
    }

    drawOrUpdateRoute(map, routeCoordinates, isEmergency);

    const onStyleData = () => drawOrUpdateRoute(map, routeCoordinates, isEmergency);
    map.on('styledata', onStyleData);
    map.on('load', onStyleData);

    if (routeCoordinates && routeCoordinates.length > 1) {
      try {
        const bounds = new maplibregl.LngLatBounds();
        routeCoordinates.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: { top: 70, bottom: 90, left: 40, right: 40 }, maxZoom: 15 });
      } catch (e) {}
    }

    return () => {
      map.off('styledata', onStyleData);
      map.off('load', onStyleData);
    };
  }, [routeCoordinates, isEmergency, drawOrUpdateRoute]);

  // Update street pill text
  useEffect(() => {
    if (streetPillRef.current && currentStreet) {
      streetPillRef.current.innerText = currentStreet;
    }
  }, [currentStreet]);

  // Destination Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !destinationCoord) return;

    if (!destMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:#dc2626;color:#fff;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2px solid #fff;display:flex;align-items:center;gap:4px;">
          <span>🏥</span> <span>${destinationName}</span>
        </div>
      `;
      destMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(destinationCoord)
        .addTo(map);
    } else {
      destMarkerRef.current.setLngLat(destinationCoord);
    }
  }, [destinationCoord, destinationName]);

  // Emergency Facility Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (facilityCoord && (isEmergency || isNavigating)) {
      if (!facMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="background:#7c3aed;color:#fff;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;box-shadow:0 4px 14px rgba(124,58,237,0.5);border:2px solid #fff;display:flex;align-items:center;gap:4px;animation:cgPulse 1.2s infinite;">
            <span>❄️</span> <span>${facilityName}</span>
          </div>
        `;
        facMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(facilityCoord)
          .addTo(map);
      } else {
        facMarkerRef.current.setLngLat(facilityCoord);
      }
    } else {
      if (facMarkerRef.current) {
        facMarkerRef.current.remove();
        facMarkerRef.current = null;
      }
    }
  }, [facilityCoord, isEmergency, isNavigating, facilityName]);

  // -------------------------------------------------------------
  // HIGH-PERFORMANCE FLUID DRIVING ENGINE
  // Authentic ~60 km/h cruising with real-time turn detection!
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isNavigating) {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      setCurrentSpeed(0);
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: 56,
      zoom: 16.5,
      duration: 500,
    });

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
      // Steady, realistic vehicular pace: 0.75 pts/sec (never too fast!)
      const stepRate = isEmerg ? 1.05 : 0.75;

      let idx = routeIndexRef.current + dt * stepRate;

      if (idx >= coords.length - 1) {
        idx = coords.length - 1;
        routeIndexRef.current = idx;
        const lastPt = coords[coords.length - 1];
        if (puckMarkerRef.current && Array.isArray(lastPt)) {
          puckMarkerRef.current.setLngLat(lastPt as [number, number]);
          map.jumpTo({ center: lastPt as [number, number] });
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
        // Interpolate exact position
        const lng = p1[0] + (p2[0] - p1[0]) * frac;
        const lat = p1[1] + (p2[1] - p1[1]) * frac;

        // Calculate tangent road bearing
        const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

        if (puckMarkerRef.current) {
          puckMarkerRef.current.setLngLat([lng, lat]);
        }

        if (arrowSvgRef.current) {
          arrowSvgRef.current.style.transform = `rotate(${bearing}deg)`;
        }

        // Camera follow
        map.jumpTo({
          center: [lng, lat],
          bearing: bearing,
        });

        // Throttled update to React HUD (every 1 second)
        if (now - lastThrottledUpdate > 1000) {
          lastThrottledUpdate = now;
          setCurrentSpeed(Math.round(speed));

          // Dynamic remaining distance & ETA calculation
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
            }
          } else {
            // Fallback dynamic turn based on remaining distance
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

  return (
    <div className={`relative ${className} overflow-hidden bg-slate-900`}>
      {/* MapLibre 3D Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Google Maps Turn Banner (Dynamic, Real turn maneuvers) */}
      <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex justify-center">
        <div className="bg-[#1a73e8] text-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl shadow-blue-950/40 border border-blue-300/40 flex items-center gap-3 max-w-sm w-full">
          {/* Turn Icon Pill */}
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

      {/* Live Speedometer (Bottom-Left like Google Maps / Waze) */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none flex flex-col items-center">
        <div className="w-13 h-13 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border-2 border-blue-600 shadow-xl flex flex-col items-center justify-center text-slate-900">
          <span className="text-base font-black leading-none font-mono">{currentSpeed}</span>
          <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-tighter">km/h</span>
        </div>
      </div>

      {/* Live ETA Badge (Bottom-Center above dock, Google Maps style) */}
      {isNavigating && (
        <div className="absolute bottom-16 left-0 right-0 z-10 pointer-events-none flex justify-center">
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
