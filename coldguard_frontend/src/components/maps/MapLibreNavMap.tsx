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
  currentCoord?: [number, number] | null;
  onLocationUpdate?: (lng: number, lat: number, speed: number) => void;
  onArrival?: () => void;
  className?: string;
}

const CARTO_KEY = 'cb1_3ig8_1_11956d158c962eee4dd04aed';

// Clean Carto raster base style
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

function findClosestPointIndex(coords: [number, number][], target: [number, number]): number {
  if (!coords || coords.length === 0 || !target || target.length < 2) return 0;
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const dLng = coords[i][0] - target[0];
    const dLat = coords[i][1] - target[1];
    const distSq = dLng * dLng + dLat * dLat;
    if (distSq < minDiff) {
      minDiff = distSq;
      closestIdx = i;
    }
  }
  return closestIdx;
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

// Calculate shortest angle difference between two bearings (-180 to 180)
function angleDiff(target: number, current: number): number {
  let diff = (target - current + 180) % 360 - 180;
  return diff < -180 ? diff + 360 : diff;
}

function getTurnIcon(instruction: string = ''): string {
  const lower = instruction.toLowerCase();
  if (lower.includes('slight right')) return '↗';
  if (lower.includes('slight left')) return '↖';
  if (lower.includes('sharp right')) return '↱';
  if (lower.includes('sharp left')) return '↰';
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
  currentCoord,
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

  // Projected SVG route path state (Guaranteed 100% visible on top of any raster basemap)
  const [svgPath, setSvgPath] = useState<string>('');

  // Animation & simulation refs
  const animIdRef = useRef<number | null>(null);
  const routeIndexRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
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

  // Update SVG Projected Path (calculates sub-pixel road alignment on every move/tilt/zoom)
  const updateSvgPath = useCallback(() => {
    const map = mapRef.current;
    const coords = routeCoordsRef.current;
    if (!map || !coords || coords.length < 2) {
      setSvgPath('');
      return;
    }

    try {
      let d = '';
      const len = coords.length;
      // Stride for high-performance sub-pixel projection
      const step = len > 800 ? 2 : 1;
      let first = true;

      for (let i = 0; i < len; i += step) {
        const pt = map.project(coords[i]);
        d += (first ? 'M ' : ' L ') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1);
        first = false;
      }
      // Ensure last point is included
      const lastPt = map.project(coords[len - 1]);
      d += ' L ' + lastPt.x.toFixed(1) + ' ' + lastPt.y.toFixed(1);

      setSvgPath(d);
    } catch {
      setSvgPath('');
    }
  }, []);

  // Add or update route GeoJSON source and layers on MapLibre (Native WebGL)
  const drawOrUpdateRoute = useCallback((map: maplibregl.Map, coords: [number, number][], emergency: boolean) => {
    if (!map || !coords || coords.length < 2) return;

    // Trigger SVG path update immediately
    updateSvgPath();

    const geojson = makeGeoJson(coords);

    const applyLayers = () => {
      try {
        const existingSource = map.getSource('route-source') as maplibregl.GeoJSONSource | undefined;
        if (existingSource && typeof existingSource.setData === 'function') {
          existingSource.setData(geojson);
        } else {
          if (map.getSource('route-source')) {
            try { map.removeLayer('route-line'); } catch {}
            try { map.removeLayer('route-casing'); } catch {}
            try { map.removeSource('route-source'); } catch {}
          }
          map.addSource('route-source', {
            type: 'geojson',
            data: geojson,
          });
        }

        // Ensure casing exists
        if (!map.getLayer('route-casing')) {
          map.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': emergency ? '#7f1d1d' : '#174ea6',
              'line-width': 14,
              'line-opacity': 0.95,
            },
          });
        }

        // Ensure core line exists
        if (!map.getLayer('route-line')) {
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': emergency ? '#ef4444' : '#1a73e8',
              'line-width': 8,
              'line-opacity': 1,
            },
          });
        }

        if (map.getLayer('route-line')) {
          map.setPaintProperty('route-line', 'line-color', emergency ? '#ef4444' : '#1a73e8');
        }
        if (map.getLayer('route-casing')) {
          map.setPaintProperty('route-casing', 'line-color', emergency ? '#7f1d1d' : '#174ea6');
        }
        map.triggerRepaint();
      } catch (e) {
        console.warn('MapLibre line apply warning:', e);
      }
    };

    if (map.isStyleLoaded()) {
      applyLayers();
    } else {
      map.once('load', applyLayers);
      map.once('style.load', applyLayers);
    }
  }, [updateSvgPath]);

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
          padding: { top: 120, bottom: 130, left: 45, right: 45 },
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

    // Wire up continuous projection updates on move/render
    map.on('render', updateSvgPath);
    map.on('move', updateSvgPath);
    map.on('zoom', updateSvgPath);
    map.on('rotate', updateSvgPath);
    map.on('pitch', updateSvgPath);

    map.on('load', () => {
      try { map.resize(); } catch {}
      if (routeCoordsRef.current && routeCoordsRef.current.length > 1) {
        drawOrUpdateRoute(map, routeCoordsRef.current, isEmergencyRef.current);
        fitOverviewBounds();
      }
      setTimeout(() => {
        try { map.resize(); } catch {}
        updateSvgPath();
      }, 300);
    });

    // Create Navigation Puck (Vehicle marker)
    const puckEl = document.createElement('div');
    puckEl.style.display = 'flex';
    puckEl.style.flexDirection = 'column';
    puckEl.style.alignItems = 'center';
    puckEl.style.pointerEvents = 'none';
    puckEl.style.zIndex = '50';

    const circle = document.createElement('div');
    circle.style.width = '44px';
    circle.style.height = '44px';
    circle.style.borderRadius = '50%';
    circle.style.background = '#ffffff';
    circle.style.boxShadow = '0 4px 20px rgba(0,0,0,0.45), 0 0 0 3.5px rgba(26,115,232,0.7)';
    circle.style.display = 'flex';
    circle.style.alignItems = 'center';
    circle.style.justifyContent = 'center';

    circle.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" class="cg-puck-svg" style="transition: transform 0.15s ease-out;">
        <path d="M12 2L4 20L12 16L20 20L12 2Z" fill="#1a73e8" stroke="#174ea6" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;

    const pill = document.createElement('span');
    pill.style.marginTop = '5px';
    pill.style.padding = '2px 9px';
    pill.style.borderRadius = '12px';
    pill.style.background = 'rgba(255,255,255,0.96)';
    pill.style.color = '#1e3a8a';
    pill.style.fontSize = '10px';
    pill.style.fontWeight = '900';
    pill.style.letterSpacing = '0.3px';
    pill.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    pill.style.whiteSpace = 'nowrap';
    pill.style.border = '1.5px solid #93c5fd';
    pill.innerText = currentStreet;

    puckEl.appendChild(circle);
    puckEl.appendChild(pill);

    puckElRef.current = puckEl;
    streetPillRef.current = pill;
    arrowSvgRef.current = circle.querySelector('svg');

    const marker = new maplibregl.Marker({ element: puckEl, rotationAlignment: 'viewport' })
      .setLngLat(initialCoord)
      .addTo(map);

    puckMarkerRef.current = marker;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [drawOrUpdateRoute, fitOverviewBounds, updateSvgPath]);

  const prevRouteKeyRef = useRef<string>('');

  // Update Route Polyline and handle route position without jumping back to origin on stop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeKey = routeCoordinates && routeCoordinates.length > 0
      ? `${routeCoordinates[0][0]}_${routeCoordinates[0][1]}_${routeCoordinates[routeCoordinates.length - 1][0]}_${routeCoordinates.length}`
      : '';

    const isNewRoute = Boolean(routeKey && routeKey !== prevRouteKeyRef.current);
    if (isNewRoute) {
      prevRouteKeyRef.current = routeKey;

      // If currentCoord is supplied, snap directly to that coordinate along the route
      let startIdx = 0;
      if (currentCoord && currentCoord.length >= 2) {
        startIdx = findClosestPointIndex(routeCoordinates, currentCoord);
      }
      routeIndexRef.current = startIdx;

      if (puckMarkerRef.current && routeCoordinates[startIdx]) {
        puckMarkerRef.current.setLngLat(routeCoordinates[startIdx]);
      }
    }

    drawOrUpdateRoute(map, routeCoordinates, isEmergency);
    updateSvgPath();

    if (!isNavigating && isNewRoute) {
      fitOverviewBounds();
    }
  }, [routeCoordinates, isEmergency, currentCoord, drawOrUpdateRoute, fitOverviewBounds, isNavigating, updateSvgPath]);

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

    const shortOrigin = (originName || 'Origin Hub').split(',')[0];

    if (!startMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:#16a34a;color:#ffffff;padding:6px 13px;border-radius:16px;font-size:11px;font-weight:900;box-shadow:0 4px 18px rgba(22,163,74,0.65);border:2.5px solid #ffffff;display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-100%);">
          <span style="font-size:14px;">🟢</span> <span>START: ${shortOrigin}</span>
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

    const shortDest = (destinationName || 'Destination').split(',')[0];

    if (!destMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:#dc2626;color:#ffffff;padding:6px 13px;border-radius:16px;font-size:11px;font-weight:900;box-shadow:0 4px 18px rgba(220,38,38,0.65);border:2.5px solid #ffffff;display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-100%);">
          <span style="font-size:14px;">📍</span> <span>DROP: ${shortDest}</span>
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
        <div style="background:rgba(15,23,42,0.94);color:#c084fc;padding:4px 9px;border-radius:12px;font-size:10px;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,0.5);border:1.5px solid #a855f7;display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;transform:translate(-50%,-100%);">
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

      // Preserve stopped position and inform parent of exact halt coordinate
      const coords = routeCoordsRef.current;
      const idx = Math.floor(routeIndexRef.current);
      if (coords && coords[idx] && onLocationUpdateRef.current) {
        onLocationUpdateRef.current(coords[idx][0], coords[idx][1], 0);
      }
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

      const iFloor = Math.floor(idx);
      const iNext = Math.min(iFloor + 1, coords.length - 1);
      const frac = idx - iFloor;

      const p0 = coords[iFloor];
      const p1 = coords[iNext];

      if (p0 && p1) {
        const lng = p0[0] + (p1[0] - p0[0]) * frac;
        const lat = p0[1] + (p1[1] - p0[1]) * frac;

        const targetBearing = calculateBearing(p0[0], p0[1], p1[0], p1[1]);

        if (currentBearingRef.current === 0) {
          currentBearingRef.current = targetBearing;
        } else {
          const diff = angleDiff(targetBearing, currentBearingRef.current);
          const smoothFactor = Math.min(1, dt * 4.5);
          currentBearingRef.current = (currentBearingRef.current + diff * smoothFactor + 360) % 360;
        }

        if (puckMarkerRef.current) {
          puckMarkerRef.current.setLngLat([lng, lat]);
        }

        if (cameraModeRef.current === 'drive') {
          map.jumpTo({
            center: [lng, lat],
            bearing: currentBearingRef.current,
          });
          if (arrowSvgRef.current) {
            arrowSvgRef.current.style.transform = 'rotate(0deg)';
          }
        } else {
          if (arrowSvgRef.current) {
            arrowSvgRef.current.style.transform = `rotate(${currentBearingRef.current}deg)`;
          }
        }

        // Throttled update to React HUD (every 1 second)
        if (now - lastThrottledUpdate > 1000) {
          lastThrottledUpdate = now;
          setCurrentSpeed(Math.round(speed));

          const remainingPoints = coords.length - idx;
          const remKm = Math.max(0.5, (remainingPoints * 0.055)).toFixed(1);
          const remMin = Math.max(1, Math.round((Number(remKm) / 55) * 60));
          setRemainingKm(remKm);
          setEtaMinutes(remMin);

          const steps = routeStepsRef.current;
          if (steps && steps.length > 0) {
            const stepIdx = Math.min(
              Math.floor((idx / coords.length) * steps.length),
              steps.length - 1
            );
            const curStep = steps[stepIdx];
            if (curStep) {
              const instr = curStep.instruction || 'Continue on route';
              const dist = curStep.distance_m
                ? curStep.distance_m > 1000
                  ? `${(curStep.distance_m / 1000).toFixed(1)} km`
                  : `${Math.round(curStep.distance_m)} m`
                : '500 m';

              setActiveStepText(instr);
              setActiveStepDist(dist);
              setActiveTurnIcon(getTurnIcon(instr));

              if (streetPillRef.current) {
                const words = instr.split(' ');
                streetPillRef.current.innerText = words.slice(0, 3).join(' ');
              }
            }
          } else {
            setActiveStepText(isEmerg ? `Diverting to ${facilityName}` : `Heading to ${destinationName}`);
            setActiveStepDist(`${remKm} km`);
            setActiveTurnIcon('↑');
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
  }, [isNavigating, isEmergency, destinationName, facilityName, onArrival, onLocationUpdate]);

  // View Controls
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
      const curPt = coords && coords[idx] ? coords[idx] : originCoord || [73.856, 15.4647];
      map.easeTo({
        center: curPt,
        zoom: 16.2,
        pitch: 56,
        bearing: currentBearingRef.current || 0,
        duration: 800,
      });
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const shortFrom = (originName || 'Sub District Hospital, Ponda').split(',')[0];
  const shortTo = (destinationName || 'North Goa District Hospital, Mapusa').split(',')[0];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* MapLibre 3D WebGL Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Guaranteed 100% Projected SVG Navigation Route (Google Maps Electric Blue Flow Path) */}
      {svgPath && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-[5]"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="cg-flow-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#2563eb" floodOpacity="0.85" />
            </filter>
          </defs>
          {/* Deep Navy High-Contrast Outer Border */}
          <path
            d={svgPath}
            fill="none"
            stroke="#174ea6"
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.92}
          />
          {/* Electric Blue Core Flow Line */}
          <path
            d={svgPath}
            fill="none"
            stroke={isEmergency ? '#ef4444' : '#1a73e8'}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#cg-flow-glow)"
          />
        </svg>
      )}

      {/* Floating Google Maps Turn Banner */}
      <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex justify-center">
        <div className="bg-[#1a73e8] text-white backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl shadow-blue-950/40 border border-blue-300/40 flex items-center gap-3 max-w-sm w-full pointer-events-auto">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black shrink-0">
            {activeTurnIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-extrabold text-blue-100 uppercase tracking-wider">
              {isEmergency
                ? `Emergency Reroute • In ${activeStepDist}`
                : isNavigating
                ? `In ${activeStepDist}`
                : 'Navigation Route Ready'}
            </div>
            <div className="text-xs font-black truncate text-white leading-tight">
              {isEmergency
                ? `Divert: ${facilityName || 'Emergency Facility'}`
                : isNavigating
                ? activeStepText
                : `To ${shortTo}`}
            </div>
          </div>
        </div>
      </div>

      {/* Route From → To Context Banner (Google Maps Full Path Context) */}
      <div className="absolute top-[114px] left-3 right-3 z-10 pointer-events-none flex justify-center">
        <div className="bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/80 flex items-center justify-between gap-2 max-w-sm w-full text-[10px] pointer-events-auto">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-300 truncate">{shortFrom}</span>
          </div>
          <span className="text-blue-400 font-bold">→</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            <span className="font-bold text-white truncate">{shortTo}</span>
          </div>
          <span className="text-emerald-400 font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
            {remainingKm} km
          </span>
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
