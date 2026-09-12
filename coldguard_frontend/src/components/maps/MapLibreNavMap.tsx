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

export interface FacilityItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  city?: string;
  available_capacity?: number;
}

export interface NavMapProps {
  routeCoordinates: [number, number][]; // [[lng, lat], ...]
  routeSteps?: RouteStep[];
  isNavigating: boolean;
  isEmergency?: boolean;
  currentStreet?: string;
  nextStep?: any;
  originCoord?: [number, number] | null;
  originName?: string;
  destinationCoord?: [number, number] | null;
  destinationName?: string;
  facilityCoord?: [number, number] | null;
  facilityName?: string;
  facilities?: FacilityItem[];
  onLocationUpdate?: (lng: number, lat: number, speed: number) => void;
  onArrival?: () => void;
  className?: string;
}

const CARTO_KEY = 'cb1_3ig8_1_11956d158c962eee4dd04aed';

// Fresh style factory per instance to prevent React 19 remount mutation bugs
function createCartoStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'carto-tiles': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
          `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
          `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
          `https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
        ],
        tileSize: 256,
        attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'carto-tiles-layer',
        type: 'raster',
        source: 'carto-tiles',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
}

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
  originCoord,
  originName = 'GMC Bambolim Central Vault',
  destinationCoord,
  destinationName = 'South Goa District Hospital',
  facilityCoord,
  facilityName = 'Cold Storage Facility',
  facilities = [],
  onLocationUpdate,
  onArrival,
  className = 'w-full h-full',
}: NavMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Markers
  const puckMarkerRef = useRef<maplibregl.Marker | null>(null);
  const puckElRef = useRef<HTMLDivElement | null>(null);
  const streetPillRef = useRef<HTMLSpanElement | null>(null);
  const arrowSvgRef = useRef<SVGElement | null>(null);

  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const emergMarkerRef = useRef<maplibregl.Marker | null>(null);
  const facMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Camera & view mode: 'drive' | 'overview'
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

  // Dynamic Navigation Live State
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [remainingKm, setRemainingKm] = useState<string>('18.0');
  const [etaMinutes, setEtaMinutes] = useState<number>(18);
  const [activeStepText, setActiveStepText] = useState<string>('Depart onto NH 66');
  const [activeStepDist, setActiveStepDist] = useState<string>('750 m');
  const [activeTurnIcon, setActiveTurnIcon] = useState<string>('↑');

  // Convert raw coordinates to GeoJSON FeatureCollection
  const makeGeoJson = (coords: [number, number][]): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        },
      ],
    };
  };

  // Add or update route GeoJSON source and layers on MapLibre
  const drawOrUpdateRoute = useCallback((map: maplibregl.Map, coords: [number, number][], emergency: boolean) => {
    if (!map || !coords || coords.length < 2) return;

    const geojson = makeGeoJson(coords);
    const source = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined;

    if (source) {
      try {
        source.setData(geojson);
      } catch {}
    } else if (map.isStyleLoaded()) {
      try {
        map.addSource('route-source', {
          type: 'geojson',
          data: geojson,
        });
      } catch {}
    }

    if (map.isStyleLoaded()) {
      // 1. Deep Navy Outer Casing
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
        } catch {}
      }
      // 2. Electric Blue Core (or Emergency Crimson)
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
        } catch {}
      }

      try {
        if (map.getLayer('route-line')) {
          map.setPaintProperty('route-line', 'line-color', emergency ? '#dc2626' : '#1a73e8');
        }
        if (map.getLayer('route-casing')) {
          map.setPaintProperty('route-casing', 'line-color', emergency ? '#7f1d1d' : '#174ea6');
        }
      } catch {}
    }

    try {
      map.triggerRepaint();
    } catch {}
  }, []);

  // Fit camera bounds to encompass the entire route, start, drop, and facilities
  const fitOverviewBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    if (routeCoordsRef.current && routeCoordsRef.current.length > 0) {
      routeCoordsRef.current.forEach((c) => {
        bounds.extend(c);
        hasPoints = true;
      });
    }

    if (originCoord) {
      bounds.extend(originCoord);
      hasPoints = true;
    }

    if (destinationCoord) {
      bounds.extend(destinationCoord);
      hasPoints = true;
    }

    if (hasPoints) {
      try {
        map.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 600,
        });
        map.fitBounds(bounds, {
          padding: { top: 90, bottom: 120, left: 45, right: 45 },
          maxZoom: 13.5,
        });
      } catch {}
    }
  }, [originCoord, destinationCoord]);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCoord: [number, number] = routeCoordinates.length > 0 && routeCoordinates[0]?.length >= 2
      ? [routeCoordinates[0][0], routeCoordinates[0][1]]
      : [73.856, 15.4647];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: createCartoStyle(),
      center: initialCoord,
      zoom: 11,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on('load', () => {
      try { map.resize(); } catch {}
      if (routeCoordsRef.current && routeCoordsRef.current.length > 1) {
        drawOrUpdateRoute(map, routeCoordsRef.current, isEmergencyRef.current);
        fitOverviewBounds();
      }
      setTimeout(() => {
        try { map.resize(); } catch {}
      }, 300);
    });

    map.on('styledata', () => {
      if (routeCoordsRef.current && routeCoordsRef.current.length > 1) {
        drawOrUpdateRoute(map, routeCoordsRef.current, isEmergencyRef.current);
      }
    });

    // Create Navigation Puck (Vehicle marker)
    const puckEl = document.createElement('div');
    puckEl.style.display = 'flex';
    puckEl.style.flexDirection = 'column';
    puckEl.style.alignItems = 'center';
    puckEl.style.pointerEvents = 'none';

    const circle = document.createElement('div');
    circle.style.width = '42px';
    circle.style.height = '42px';
    circle.style.borderRadius = '50%';
    circle.style.background = '#ffffff';
    circle.style.boxShadow = '0 4px 18px rgba(0,0,0,0.4), 0 0 0 3px rgba(26,115,232,0.6)';
    circle.style.display = 'flex';
    circle.style.alignItems = 'center';
    circle.style.justifyContent = 'center';

    circle.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="cg-puck-svg" style="transition: transform 0.15s ease-out;">
        <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="#1a73e8" stroke="#174ea6" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    `;

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

  // Update Route Polyline whenever routeCoordinates or emergency changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    routeIndexRef.current = 0;

    if (routeCoordinates && routeCoordinates.length > 0) {
      const firstPt = routeCoordinates[0];
      if (puckMarkerRef.current && Array.isArray(firstPt)) {
        puckMarkerRef.current.setLngLat(firstPt);
      }
    }

    drawOrUpdateRoute(map, routeCoordinates, isEmergency);

    if (!isNavigating) {
      fitOverviewBounds();
    }
  }, [routeCoordinates, isEmergency, isNavigating, drawOrUpdateRoute, fitOverviewBounds]);

  // Update street pill text
  useEffect(() => {
    if (streetPillRef.current && currentStreet) {
      streetPillRef.current.innerText = currentStreet;
    }
  }, [currentStreet]);

  // -------------------------------------------------------------
  // MARKERS: START (ORIGIN), DROP (DESTINATION), & ALL FACILITIES
  // -------------------------------------------------------------

  // 1. START / ORIGIN MARKER (🟢)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const startPt = originCoord || (routeCoordinates.length > 0 ? routeCoordinates[0] : null);
    if (!startPt) return;

    const shortOrigin = (originName || 'Origin Vault').split(',')[0];

    if (!startMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:#16a34a;color:#ffffff;padding:5px 12px;border-radius:14px;font-size:11px;font-weight:900;box-shadow:0 4px 16px rgba(22,163,74,0.6);border:2px solid #ffffff;display:flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-100%);">
          <span style="font-size:13px;">🟢</span> <span>START: ${shortOrigin}</span>
        </div>
      `;
      startMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(startPt)
        .addTo(map);
    } else {
      startMarkerRef.current.setLngLat(startPt);
    }
  }, [originCoord, originName, routeCoordinates]);

  // 2. DROP / DESTINATION MARKER (📍)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const destPt = destinationCoord || (routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null);
    if (!destPt) return;

    const shortDest = (destinationName || 'Destination Vault').split(',')[0];

    if (!destMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:#dc2626;color:#ffffff;padding:5px 12px;border-radius:14px;font-size:11px;font-weight:900;box-shadow:0 4px 16px rgba(220,38,38,0.6);border:2px solid #ffffff;display:flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-100%);">
          <span style="font-size:13px;">📍</span> <span>DROP: ${shortDest}</span>
        </div>
      `;
      destMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(destPt)
        .addTo(map);
    } else {
      destMarkerRef.current.setLngLat(destPt);
    }
  }, [destinationCoord, destinationName, routeCoordinates]);

  // 3. ALL FACILITIES ACROSS GOA (❄️)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous facility markers
    facMarkersRef.current.forEach((m) => m.remove());
    facMarkersRef.current = [];

    if (!facilities || facilities.length === 0) return;

    const newMarkers: maplibregl.Marker[] = [];

    facilities.forEach((f) => {
      if (!f.latitude || !f.longitude) return;

      // Don't duplicate exact start or drop points if within ~150 meters
      if (originCoord && Math.abs(f.latitude - originCoord[1]) < 0.003 && Math.abs(f.longitude - originCoord[0]) < 0.003) {
        return;
      }
      if (destinationCoord && Math.abs(f.latitude - destinationCoord[1]) < 0.003 && Math.abs(f.longitude - destinationCoord[0]) < 0.003) {
        return;
      }

      const shortName = f.name
        .split(',')[0]
        .replace('Community Health & Specialty Center', 'CHC')
        .replace('Community Health Center', 'CHC')
        .replace('Sub District Hospital', 'SDH')
        .replace('Sub-District Hospital', 'SDH');

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:rgba(15,23,42,0.92);color:#c084fc;padding:4px 9px;border-radius:12px;font-size:10px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,0.5);border:1.5px solid #a855f7;display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-100%);">
          <span style="font-size:12px;">❄️</span> <span>${shortName}</span>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.longitude, f.latitude])
        .addTo(map);

      newMarkers.push(marker);
    });

    facMarkersRef.current = newMarkers;

    return () => {
      newMarkers.forEach((m) => m.remove());
    };
  }, [facilities, originCoord, destinationCoord]);

  // 4. ACTIVE EMERGENCY FACILITY TARGET (⚠️)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (facilityCoord && (isEmergency || isNavigating)) {
      const shortFac = (facilityName || 'Emergency Vault').split(',')[0];
      if (!emergMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="background:#7c3aed;color:#fff;padding:7px 14px;border-radius:16px;font-size:12px;font-weight:900;box-shadow:0 4px 22px rgba(124,58,237,0.8);border:2.5px solid #fff;display:flex;align-items:center;gap:6px;animation:cgPulse 1.2s infinite;white-space:nowrap;transform:translate(-50%,-100%);">
            <span style="font-size:14px;">❄️ EMERGENCY TARGET:</span> <span>${shortFac}</span>
          </div>
        `;
        emergMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(facilityCoord)
          .addTo(map);
      } else {
        emergMarkerRef.current.setLngLat(facilityCoord);
      }
    } else {
      if (emergMarkerRef.current) {
        emergMarkerRef.current.remove();
        emergMarkerRef.current = null;
      }
    }
  }, [facilityCoord, isEmergency, isNavigating, facilityName]);

  // -------------------------------------------------------------
  // HIGH-PERFORMANCE FLUID DRIVING ENGINE (3D Perspective ~60 km/h)
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

    map.easeTo({
      pitch: 56,
      zoom: 16.2,
      duration: 600,
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
      // Steady vehicular pace: 0.75 pts/sec
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

        // Camera follow in 3D perspective mode
        if (cameraModeRef.current === 'drive') {
          map.jumpTo({
            center: [lng, lat],
            bearing: bearing,
          });
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

  // Toggle Camera Mode between 3D Driving and Overview
  const toggleCameraMode = () => {
    const map = mapRef.current;
    if (!map) return;

    if (cameraMode === 'drive') {
      setCameraMode('overview');
      fitOverviewBounds();
    } else {
      setCameraMode('drive');
      const coords = routeCoordsRef.current;
      const idx = Math.floor(routeIndexRef.current);
      const currentPt = coords && coords[idx] ? coords[idx] : [73.856, 15.4647];
      map.easeTo({
        center: currentPt as [number, number],
        pitch: 56,
        zoom: 16.2,
        duration: 700,
      });
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  return (
    <div
      className={`relative ${className || ''} overflow-hidden bg-slate-900 w-full h-full`}
      style={{ width: '100%', height: '100%' }}
    >
      {/* MapLibre 3D WebGL Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Google Maps Turn Banner */}
      <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex justify-center">
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

      {/* Floating Map View Controls (Bottom-Right) */}
      <div className="absolute bottom-28 right-3 z-20 flex flex-col gap-2 pointer-events-auto">
        {/* Toggle Overview vs 3D Drive */}
        <button
          onClick={toggleCameraMode}
          className="bg-slate-900/90 hover:bg-slate-800 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          title="Toggle Full Route Overview vs 3D Drive View"
        >
          <span>{cameraMode === 'drive' ? '🗺️' : '🧭'}</span>
          <span>{cameraMode === 'drive' ? 'Overview' : '3D Drive'}</span>
        </button>

        {/* Fit Entire Route across Goa */}
        <button
          onClick={fitOverviewBounds}
          className="w-9 h-9 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-black rounded-xl border border-slate-700 shadow-xl backdrop-blur-md flex items-center justify-center cursor-pointer transition-all active:scale-95 self-end"
          title="Fit Entire Route across Goa"
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

      {/* Live Speedometer (Bottom-Left like Google Maps / Waze) */}
      <div className="absolute bottom-24 left-4 z-10 pointer-events-none flex flex-col items-center">
        <div className="w-13 h-13 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md border-2 border-blue-600 shadow-xl flex flex-col items-center justify-center text-slate-900">
          <span className="text-base font-black leading-none font-mono">{currentSpeed}</span>
          <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-tighter">km/h</span>
        </div>
      </div>

      {/* Live ETA Badge (Bottom-Center above dock) */}
      {isNavigating && (
        <div className="absolute bottom-24 left-0 right-0 z-10 pointer-events-none flex justify-center">
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
