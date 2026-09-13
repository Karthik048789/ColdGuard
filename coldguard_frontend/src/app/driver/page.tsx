'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

const MapLibreNavMap = dynamic(() => import('@/components/maps/MapLibreNavMap'), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

type DriverStatus = 'idle' | 'moving' | 'emergency' | 'at_facility' | 'delivered';

interface TelemetryData {
  temperature: number;
  humidity: number;
  battery: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface NearbyFacility {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
}

interface PresetDriver {
  name: string;
  email: string;
  password: string;
  vehicle: string;
  cargo: string;
  route: string;
  icon: string;
}

const PRESET_DRIVERS: PresetDriver[] = [
  {
    name: 'Suresh Nair',
    email: 'suresh@coldguard.ai',
    password: 'password123',
    vehicle: 'Reefer Van GA-08-D-8910',
    cargo: 'Polio & Rotavirus Vaccine',
    route: 'SDH Ponda → Mapusa (Active)',
    icon: '🚐',
  },
  {
    name: 'Rajesh Kumar',
    email: 'driver@coldguard.ai',
    password: 'password123',
    vehicle: 'Reefer Truck GA-07-C-4021',
    cargo: 'Covishield & Rabies Vaccine',
    route: 'GMC Bambolim → Margao',
    icon: '🚛',
  },
  {
    name: 'Manoj Varma',
    email: 'manoj@coldguard.ai',
    password: 'password123',
    vehicle: 'Deep Freeze Unit GA-03-A-1204',
    cargo: 'Cold-Chain Insulin & Plasma',
    route: 'GMC Bambolim → Vasco',
    icon: '🧊',
  },
];

// Geodesic distance calculation between two GPS coordinates
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestFacility(
  curLat: number,
  curLng: number,
  facList: any[],
  originName?: string,
  originLat?: number,
  originLng?: number
): any {
  if (!facList || facList.length === 0) return null;
  let best: any = null;
  let minDist = Infinity;
  for (const f of facList) {
    const fLat = Number(f.latitude);
    const fLng = Number(f.longitude);
    if (!fLat || !fLng) continue;

    // Exclude origin facility so driver never turns back/teleports to the origin warehouse
    if (originLat && originLng && Math.abs(fLat - Number(originLat)) < 0.005 && Math.abs(fLng - Number(originLng)) < 0.005) {
      continue;
    }
    if (originName && f.name && f.name.toLowerCase().includes(originName.toLowerCase().split(' ')[0])) {
      continue;
    }

    const dist = calculateDistanceKm(curLat, curLng, fLat, fLng);
    if (dist < minDist) {
      minDist = dist;
      best = { ...f, approximate_distance_km: parseFloat(dist.toFixed(1)) };
    }
  }
  return best;
}

export default function DriverPage() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Manual login
  const [inputEmail, setInputEmail] = useState('driver@coldguard.ai');
  const [inputPassword, setInputPassword] = useState('password123');

  // Shipment & Telemetry
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  const [shipment, setShipment] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('idle');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  // Navigation State
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeSteps, setRouteSteps] = useState<any[]>([]);
  const [currentStreet, setCurrentStreet] = useState<string>('NH 66 Panaji-Margao Hwy');
  const [nextStep, setNextStep] = useState<any>(null);
  const [emergencyFacility, setEmergencyFacility] = useState<NearbyFacility | null>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [isAtFacility, setIsAtFacility] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [tempPulse, setTempPulse] = useState(false);

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const shipmentIdRef = useRef<number | null>(null);
  shipmentIdRef.current = shipmentId;
  const telemetryRef = useRef<TelemetryData | null>(null);
  telemetryRef.current = telemetry;
  const isSyncingRef = useRef<boolean>(false);

  // Check saved token on mount
  useEffect(() => {
    const t = localStorage.getItem('cg_token');
    if (t) setToken(t);
  }, []);

  // Handle Login
  const handleLogin = async (emailToUse?: string, passToUse?: string) => {
    const e = emailToUse || inputEmail;
    const p = passToUse || inputPassword;
    setLoginSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json();

      if (data.success && data.data?.token) {
        localStorage.setItem('cg_token', data.data.token);
        if (data.data.user) {
          localStorage.setItem('cg_user', JSON.stringify(data.data.user));
          setCurrentUser(data.data.user);
        }
        setToken(data.data.token);
      } else {
        setAuthError(data.message || 'Invalid credentials.');
      }
    } catch {
      setAuthError('Cannot connect to backend API server at localhost:8000.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cg_token');
    localStorage.removeItem('cg_user');
    setToken(null);
    setCurrentUser(null);
    setShipment(null);
    setShipmentId(null);
    setTelemetry(null);
    setDriverStatus('idle');
    setAlerts([]);
    setFacilities([]);
    setRouteCoordinates([]);
    setActionMsg('');
  };

  const shipmentDataRef = useRef<any>(shipment);
  shipmentDataRef.current = shipment;

  // Route & Steps Fetcher with guaranteed direct OSRM fallback (100% stable reference to stop loop)
  const fetchRouteData = useCallback(async (
    tk: string,
    sid: number,
    facilityId?: number,
    direct?: boolean,
    fallbackShip?: any,
    targetFacility?: any
  ) => {
    try {
      // Determine origin coordinate: prefer real-time location of truck
      const s = fallbackShip || shipmentDataRef.current;
      const curLat = telemetryRef.current?.latitude ?? telemetry?.latitude ?? s?.current_lat ?? s?.origin_lat ?? 15.4647;
      const curLng = telemetryRef.current?.longitude ?? telemetry?.longitude ?? s?.current_lng ?? s?.origin_lng ?? 73.8560;
      const destLng = Number(s?.destination_lng);
      const destLat = Number(s?.destination_lat);

      // 1. If emergency facility reroute is requested, ALWAYS build the complete 3-point route:
      // [Current Truck Position] -> [Emergency Cold Storage Facility] -> [Final Destination Hospital]
      if (targetFacility || facilityId) {
        let facLng: number | null = null;
        let facLat: number | null = null;
        let actualFac = targetFacility;
        if (targetFacility?.longitude && targetFacility?.latitude) {
          facLng = Number(targetFacility.longitude);
          facLat = Number(targetFacility.latitude);
        } else if (facilityId) {
          actualFac = facilities.find((f: any) => f.id === facilityId);
          if (actualFac?.longitude && actualFac?.latitude) {
            facLng = Number(actualFac.longitude);
            facLat = Number(actualFac.latitude);
          }
        }

        const startLng = curLng;
        const startLat = curLat;

        if (startLng && startLat && facLng && facLat && destLng && destLat) {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${facLng},${facLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
          const osrmRes = await fetch(osrmUrl).then((res) => res.json()).catch(() => null);

          if (osrmRes?.routes?.[0]?.geometry?.coordinates) {
            const coords = osrmRes.routes[0].geometry.coordinates;
            setRouteCoordinates(coords);
            const allSteps = osrmRes.routes[0].legs?.flatMap((l: any) => l.steps || []) || [];
            if (allSteps.length > 0) {
              const mappedSteps = allSteps.map((st: any) => ({
                instruction: st.maneuver?.instruction || st.name || 'Proceed along route',
                distance_m: st.distance,
                duration_seconds: st.duration,
              }));
              setRouteSteps(mappedSteps);
              setNextStep(mappedSteps[0]);
              if (mappedSteps[0]?.instruction) setCurrentStreet(mappedSteps[0].instruction);
            }

            // Broadcast rerouted multi-stop road route to manager & receiver dashboards
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              try {
                const bc = new BroadcastChannel('coldguard_live_tracking');
                bc.postMessage({
                  shipmentId: Number(sid),
                  latitude: curLat,
                  longitude: curLng,
                  temperature: telemetryRef.current?.temperature ?? 4.2,
                  speed: 55,
                  status: 'REROUTED',
                  rerouted: true,
                  facility: actualFac,
                  routeCoordinates: coords,
                });
                bc.close();
              } catch {}
            }
            return coords;
          }
        }
      }

      // 2. Standard direct transit route
      let url = `${API}/shipments/${sid}/route?lat=${curLat}&lng=${curLng}`;
      if (direct) {
        url += `&direct=true`;
      }
      const r = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      const d = await r.json();

      if (d.success && d.data?.geometry?.coordinates && d.data.geometry.coordinates.length > 0) {
        setRouteCoordinates(d.data.geometry.coordinates);

        if (d.data.steps && d.data.steps.length > 0) {
          setRouteSteps(d.data.steps);
          setNextStep(d.data.steps[0]);
          if (d.data.steps[0]?.instruction) {
            setCurrentStreet(d.data.steps[0].instruction);
          }
        }
        return d.data.geometry.coordinates;
      }

      // 3. Direct OSRM engine fallback: builds standard 2-point route
      const startLng = curLng;
      const startLat = curLat;

      if (startLng && startLat && destLng && destLat) {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
        const osrmRes = await fetch(osrmUrl).then((res) => res.json()).catch(() => null);

        if (osrmRes?.routes?.[0]?.geometry?.coordinates) {
          const coords = osrmRes.routes[0].geometry.coordinates;
          setRouteCoordinates(coords);
          const allSteps = osrmRes.routes[0].legs?.flatMap((l: any) => l.steps || []) || [];
          if (allSteps.length > 0) {
            const mappedSteps = allSteps.map((st: any) => ({
              instruction: st.maneuver?.instruction || st.name || 'Proceed along route',
              distance_m: st.distance,
              duration_seconds: st.duration,
            }));
            setRouteSteps(mappedSteps);
            setNextStep(mappedSteps[0]);
            if (mappedSteps[0]?.instruction) setCurrentStreet(mappedSteps[0].instruction);
          }
          return coords;
        }
      }
    } catch (e) {
      console.error('Failed to load route:', e);
    }
    return null;
  }, [facilities]);

  // Fetch active shipment assigned to this driver
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        // Fetch all Goa cold storage facilities
        fetch(`${API}/facilities`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => {
            if (d.success && Array.isArray(d.data)) setFacilities(d.data);
          })
          .catch(console.error);

        const meRes = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData = await meRes.json();
        const user = meData.data?.user || meData.data;
        if (user) setCurrentUser(user);

        const userName: string = (user?.name || '').toLowerCase();

        const sRes = await fetch(`${API}/shipments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sData = await sRes.json();
        const allShipments: any[] = sData.data?.shipments ?? [];

        // Match shipment assigned to this logged-in driver
        let assigned = allShipments.find((s: any) => {
          const sDriver = (s.driver_name || '').toLowerCase().trim();
          const uName = userName.toLowerCase().trim();
          return (
            (sDriver === uName || sDriver.includes(uName.split(' ')[0])) &&
            ['IN_TRANSIT', 'CREATED', 'WARNING', 'CRITICAL', 'REROUTED', 'DIVERTED'].includes(s.status)
          );
        });

        // Fallback: If no assigned shipment for this exact driver, take the active consignment across Goa
        if (!assigned) {
          assigned = allShipments.find((s: any) =>
            ['IN_TRANSIT', 'CREATED', 'WARNING', 'CRITICAL', 'REROUTED', 'DIVERTED'].includes(s.status)
          );
        }

        if (assigned) {
          setShipmentId(assigned.id);
          setShipment(assigned);

          // Initial telemetry
          const tRes = await fetch(`${API}/shipments/${assigned.id}/telemetry/latest`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const tData = await tRes.json();
          if (tData.success && tData.data) {
            setTelemetry(tData.data);
          }

          // Alerts
          const aRes = await fetch(`${API}/shipments/${assigned.id}/alerts?role=DRIVER`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const aData = await aRes.json();
          if (aData.success) setAlerts(aData.data || []);

          // Fetch OSRM road route immediately
          await fetchRouteData(token, assigned.id, undefined, undefined, assigned);
        }
      } catch (e) {
        console.error('Error loading shipment:', e);
      }
    })();
  }, [token]);

  // Periodic Location & Telemetry Sync callback from Map (every 2-3 seconds, zero render thrash)
  const handleLocationUpdate = useCallback(async (lng: number, lat: number, speed: number) => {
    const tk = tokenRef.current;
    const sid = shipmentIdRef.current;
    if (!tk || !sid) return;

    // Calculate dynamic live temperature according to current mode
    let curT = telemetryRef.current?.temperature ?? 4.2;
    if (driverStatusRef.current === 'emergency' && curT < 8.5) {
      curT = 9.4;
    }
    const newTemp = parseFloat((curT + (Math.random() * 0.04 - 0.02)).toFixed(2));

    // 1. Keep ref and React states synchronized so top pill & dashboard are live
    if (telemetryRef.current) {
      telemetryRef.current.latitude = lat;
      telemetryRef.current.longitude = lng;
      telemetryRef.current.temperature = newTemp;
    }

    setTelemetry((p) => (p ? { ...p, latitude: lat, longitude: lng, temperature: newTemp } : {
      latitude: lat,
      longitude: lng,
      temperature: newTemp,
      humidity: 64,
      battery: 90,
      recorded_at: new Date().toISOString(),
    }));

    setShipment((p: any) => (p ? { ...p, current_lat: lat, current_lng: lng, current_temp: newTemp } : p));

    // 2. Immediate zero-latency cross-tab broadcast for manager and receiver dashboards
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('coldguard_live_tracking');
        bc.postMessage({
          shipmentId: Number(sid),
          latitude: lat,
          longitude: lng,
          temperature: newTemp,
          speed,
          status: driverStatusRef.current === 'emergency' ? 'CRITICAL' : emergencyFacilityRef.current ? 'REROUTED' : 'IN_TRANSIT',
          facility: emergencyFacilityRef.current,
        });
        bc.close();
      } catch {}
    }

    // 3. Persistent backend telemetry post every 2-3 seconds without request pile-up
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      await fetch(`${API}/shipments/${sid}/telemetry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: newTemp,
          humidity: 64.0,
          battery: 91.0,
          latitude: lat,
          longitude: lng,
          recorded_at: new Date().toISOString(),
        }),
      });
    } catch {} finally {
      isSyncingRef.current = false;
    }
  }, []);

  const emergencyFacilityRef = useRef<any>(emergencyFacility);
  emergencyFacilityRef.current = emergencyFacility;
  const driverStatusRef = useRef<string>(driverStatus);
  driverStatusRef.current = driverStatus;

  // Intermediate stop: Reached emergency cold storage facility along the multi-stop route
  const handleFacilityArrival = useCallback(async () => {
    const fac = emergencyFacilityRef.current;
    const facName = fac?.name?.split(',')[0] || 'Nearby Cold Storage';
    const destName = shipmentDataRef.current?.destination_name?.split(',')[0] || 'destination hospital';
    setActionMsg(`❄️ Reached ${facName}! Cold chain secured & replenished at 3.5C. Continuing journey to ${destName}...`);
    setIsAtFacility(true);
    setDriverStatus('idle'); // Pause at the facility. Wait for driver to manually resume!
    setActionMsg(`🚚 Reached ${facName}! Cold chain secured at 3.5°C. Vehicle paused. Tap play to resume journey to ${destName}.`);

    // Normalize cargo temperature to safe level (3.5C)
    setTelemetry((prev) => (prev ? { ...prev, temperature: 3.5 } : prev));
    setShipment((prev: any) => (prev ? { ...prev, current_temp: 3.5, status: 'REROUTED' } : prev));
    if (telemetryRef.current) {
      telemetryRef.current.temperature = 3.5;
    }

    // Report safe stabilized reading to backend database
    const tk = tokenRef.current;
    const sid = shipmentIdRef.current;
    if (tk && sid && fac) {
      try {
        await fetch(`${API}/shipments/${sid}/telemetry`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: 3.5,
            humidity: 62.0,
            battery: 89.0,
            latitude: fac.latitude,
            longitude: fac.longitude,
            recorded_at: new Date().toISOString(),
          }),
        });
      } catch {}
    }

    // Broadcast stabilized temperature to manager and receiver dashboards
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('coldguard_live_tracking');
        bc.postMessage({
          shipmentId: Number(sid),
          latitude: fac?.latitude,
          longitude: fac?.longitude,
          temperature: 3.5,
          speed: 50,
          status: 'REROUTED',
          rerouted: true,
          facility: fac,
        });
        bc.close();
      } catch {}
    }
  }, []);

  // Final destination arrival
  const handleArrival = useCallback(async () => {
    setDriverStatus('delivered');
    setActionMsg('✓ Arrived at destination hospital! Cold chain preserved. Ready for delivery confirmation.');
  }, []);

  const handleStart = async () => {
    if (!token || !shipmentId || driverStatus === 'moving' || driverStatus === 'emergency') return;
    setLoading(true);
    try {
      if (isAtFacility) {
        // Resuming journey from facility to final destination!
        setIsAtFacility(false);
        setEmergencyFacility(null);

        // Put shipment back to IN_TRANSIT on backend
        await fetch(`${API}/shipments/${shipmentId}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        // Fetch direct route from facility location to final destination hospital
        await fetchRouteData(token, shipmentId, undefined, true);
        const destName = shipment?.destination_name?.split(',')[0] || 'destination';
        setActionMsg(`Resuming transit towards ${destName}...`);
        setDriverStatus('moving');
      } else {
        if (routeCoordinates.length < 2) {
          await fetchRouteData(token, shipmentId);
        }
        setActionMsg('Cruising at ~60 km/h along highway...');
        setDriverStatus(emergencyFacility ? 'emergency' : 'moving');
      }

      if (shipment?.status === 'CREATED') {
        await fetch(`${API}/shipments/${shipmentId}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setDriverStatus('idle');
    setActionMsg('Vehicle paused. Tap play to resume.');

    const tk = tokenRef.current;
    const sid = shipmentIdRef.current;
    const curLat = telemetryRef.current?.latitude ?? telemetry?.latitude ?? shipment?.current_lat ?? shipment?.origin_lat;
    const curLng = telemetryRef.current?.longitude ?? telemetry?.longitude ?? shipment?.current_lng ?? shipment?.origin_lng;

    if (tk && sid && curLat && curLng) {
      try {
        await fetch(`${API}/shipments/${sid}/telemetry`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temperature: telemetryRef.current?.temperature ?? telemetry?.temperature ?? 4.0,
            humidity: telemetry?.humidity ?? 62.0,
            battery: telemetry?.battery ?? 89.0,
            latitude: curLat,
            longitude: curLng,
            speed: 0,
            recorded_at: new Date().toISOString(),
          }),
        });
      } catch {}
    }
  };

  const handleIncreaseTemp = async () => {
    if (!token || !shipmentId) return;
    setLoading(true);
    setTempPulse(true);
    setTimeout(() => setTempPulse(false), 800);

    try {
      // 1. Spikes temperature into critical cold-chain excursion (>8.5C)
      const curTemp = telemetryRef.current?.temperature ?? telemetry?.temperature ?? shipment?.current_temp ?? 5.5;
      const newSpikeTemp = curTemp < 8.0
        ? parseFloat((9.2 + Math.random() * 0.8).toFixed(2))
        : parseFloat((curTemp + 2.5 + Math.random() * 0.8).toFixed(2));

      // Get real-time truck coordinate
      const curLat = telemetryRef.current?.latitude ?? telemetry?.latitude ?? shipment?.origin_lat ?? 15.4647;
      const curLng = telemetryRef.current?.longitude ?? telemetry?.longitude ?? shipment?.origin_lng ?? 73.8560;

      // Post real telemetry reading to backend database (/api/shipments/{id}/telemetry)
      await fetch(`${API}/shipments/${shipmentId}/telemetry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: newSpikeTemp,
          humidity: 68.0,
          battery: 88.0,
          latitude: curLat,
          longitude: curLng,
          recorded_at: new Date().toISOString(),
        }),
      });

      // Trigger failure simulation & AI risk analysis on backend
      fetch(`${API}/shipments/${shipmentId}/telemetry/simulate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'failure' }),
      }).catch(() => null);

      fetch(`${API}/shipments/${shipmentId}/analyze-risk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      // Immediately update local UI telemetry & shipment states so temperature visibly increases!
      telemetryRef.current = {
        ...(telemetryRef.current || {}),
        temperature: newSpikeTemp,
        latitude: curLat,
        longitude: curLng,
        humidity: 68,
        battery: 88,
        recorded_at: new Date().toISOString(),
      } as any;

      setTelemetry((prev) => ({
        ...(prev || { humidity: 68, battery: 88, recorded_at: new Date().toISOString() }),
        temperature: newSpikeTemp,
        latitude: curLat,
        longitude: curLng,
      }));

      setShipment((prev: any) => (prev ? {
        ...prev,
        current_temp: newSpikeTemp,
        current_lat: curLat,
        current_lng: curLng,
        status: 'REROUTED',
      } : prev));

      // Immediately broadcast excursion temperature to manager and receiver dashboards (0ms cross-tab latency!)
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('coldguard_live_tracking');
          bc.postMessage({
            shipmentId: Number(shipmentId),
            latitude: curLat,
            longitude: curLng,
            temperature: newSpikeTemp,
            speed: 55,
            status: 'CRITICAL',
          });
          bc.close();
        } catch {}
      }

      // 2. Fetch nearest eligible cold-storage facility (excluding origin!)
      let nearest: any = null;
      try {
        const facRes = await fetch(`${API}/shipments/${shipmentId}/facilities/eligible?lat=${curLat}&lng=${curLng}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const facData = await facRes.json();
        nearest = facData.data?.recommended_facility || facData.data?.facilities?.[0];
      } catch {}

      // Robust fallback: Haversine search across Goa facilities list, strictly excluding origin warehouse
      if (!nearest) {
        nearest = findNearestFacility(curLat, curLng, facilities, shipment?.origin_name, shipment?.origin_lat, shipment?.origin_lng);
      }

      if (nearest) {
        setEmergencyFacility(nearest);
        setIsAtFacility(false);
        const facShortName = nearest.name.split(',')[0];
        const destShort = (shipment?.destination_name || 'destination').split(',')[0];
        setActionMsg(`🚨 Temp breach: ${newSpikeTemp}°C! Rerouting via ${facShortName} to ${destShort}...`);

        // Post REROUTED status to backend and append to blockchain ledger
        fetch(`${API}/shipments/${shipmentId}/reroute`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facility_id: nearest.id,
            facility_name: nearest.name,
            temperature: newSpikeTemp,
          }),
        }).catch(() => null);

        // 3. Recalculate multi-stop road route: [Current Position -> Facility -> Destination]
        const newCoords = await fetchRouteData(token, shipmentId, nearest.id, false, undefined, nearest);

        // Broadcast to manager and receiver dashboards immediately
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const bc = new BroadcastChannel('coldguard_live_tracking');
            bc.postMessage({
              shipmentId: Number(shipmentId),
              latitude: curLat,
              longitude: curLng,
              temperature: newSpikeTemp,
              speed: 55,
              status: 'REROUTED',
              rerouted: true,
              facility: nearest,
              routeCoordinates: newCoords || routeCoordinates,
            });
            bc.close();
          } catch {}
        }

        // 4. Continue navigating along rerouted path towards facility then destination!
        setDriverStatus('emergency');
      } else {
        setEmergencyFacility(null);
        setDriverStatus('moving');
        const destShort = (shipment?.destination_name || 'destination').split(',')[0];
        setActionMsg(`⚠️ Temp breach: ${newSpikeTemp}°C! No facility nearby. Continuing transit to ${destShort}...`);
      }
    } catch {
      setActionMsg('Error triggering temperature failure.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async () => {
    if (!token || !shipmentId) return;
    setLoading(true);
    try {
      await fetch(`${API}/shipments/${shipmentId}/deliver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setDriverStatus('delivered');
      setActionMsg('✓ Delivery confirmed! Cold chain verified and mission completed.');
    } finally {
      setLoading(false);
    }
  };

  const stableOriginCoord = useMemo<[number, number] | null>(() => {
    if (shipment?.origin_lng && shipment?.origin_lat) {
      return [Number(shipment.origin_lng), Number(shipment.origin_lat)];
    }
    return routeCoordinates.length > 0 ? routeCoordinates[0] : null;
  }, [shipment?.id, routeCoordinates.length > 0 ? routeCoordinates[0][0] : 0]);

  const stableDestCoord = useMemo<[number, number] | null>(() => {
    if (shipment?.destination_lng && shipment?.destination_lat) {
      return [Number(shipment.destination_lng), Number(shipment.destination_lat)];
    }
    return routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null;
  }, [shipment?.id, routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1][0] : 0]);

  const stableFacilityCoord = useMemo<[number, number] | null>(() => {
    if (emergencyFacility?.longitude && emergencyFacility?.latitude) {
      return [Number(emergencyFacility.longitude), Number(emergencyFacility.latitude)];
    }
    return null;
  }, [emergencyFacility?.id]);

  // Temperature math
  const temp = telemetry?.temperature ?? shipment?.current_temp;
  const minT = shipment?.min_temp ?? 2;
  const maxT = shipment?.max_temp ?? 8;
  const getTempColor = (t: number | undefined) => {
    if (t === undefined || t === null) return '#94a3b8';
    if (t < minT || t > maxT) return '#ef4444';
    if (t > maxT - 1) return '#f59e0b';
    return '#22c55e';
  };
  const tempColor = getTempColor(temp);
  const isEmergency = driverStatus === 'emergency';
  const isMoving = driverStatus === 'moving';
  const unread = alerts.filter((a: any) => !a.read_at).length;

  const currentShipStatus = shipment?.status || 'IN_TRANSIT';
  const displayStatus = isEmergency
    ? 'BREACH'
    : isAtFacility
    ? 'SECURED'
    : currentShipStatus === 'CRITICAL'
    ? 'CRITICAL'
    : currentShipStatus === 'WARNING'
    ? 'WARNING'
    : isMoving
    ? 'IN_TRANSIT'
    : currentShipStatus;

  const statusColor =
    displayStatus === 'CRITICAL' || displayStatus === 'BREACH'
      ? '#dc2626'
      : displayStatus === 'WARNING'
      ? '#f59e0b'
      : displayStatus === 'SECURED' || displayStatus === 'IN_TRANSIT' || displayStatus === 'SAFE'
      ? '#10b981'
      : '#3b82f6';

  // -------------------------------------------------------------
  // 1. NOT LOGGED IN: Render Mobile Driver Login View
  // -------------------------------------------------------------
  if (!token) {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginHeader}>
          <div style={s.loginLogoBadge}>❄️</div>
          <h1 style={s.loginTitle}>ColdGuard Driver</h1>
          <p style={s.loginSubtitle}>Goa Cold-Chain 3D Navigation Console</p>
        </div>

        {authError && (
          <div style={s.loginErrorBox}>
            <span>⚠️ {authError}</span>
          </div>
        )}

        <div style={s.quickSection}>
          <div style={s.quickHeader}>
            <span style={s.quickTitle}>SELECT ASSIGNED DRIVER</span>
            <span style={s.quickBadge}>1-Tap Sign In</span>
          </div>

          <div style={s.driverList}>
            {PRESET_DRIVERS.map((d) => (
              <div key={d.email} style={s.driverCard}>
                <div style={s.driverCardTop}>
                  <span style={s.driverIcon}>{d.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={s.driverName}>{d.name}</div>
                    <div style={s.driverVehicle}>{d.vehicle}</div>
                  </div>
                </div>

                <div style={s.driverMeta}>
                  <div style={s.driverCargo}>
                    <span style={{ color: '#94a3b8' }}>Cargo:</span> {d.cargo}
                  </div>
                  <div style={s.driverRoute}>
                    <span style={{ color: '#94a3b8' }}>Route:</span> {d.route}
                  </div>
                </div>

                <button
                  style={s.driverLoginBtn}
                  disabled={loginSubmitting}
                  onClick={() => handleLogin(d.email, d.password)}
                >
                  {loginSubmitting ? 'Authenticating...' : `Sign In as ${d.name.split(' ')[0]}`}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={s.manualBox}>
          <div style={s.manualTitle}>Manual Driver Login</div>
          <input
            type="email"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            placeholder="Driver Email"
            style={s.manualInput}
          />
          <input
            type="password"
            value={inputPassword}
            onChange={(e) => setInputPassword(e.target.value)}
            placeholder="Password"
            style={s.manualInput}
          />
          <button
            style={s.manualSubmitBtn}
            disabled={loginSubmitting}
            onClick={() => handleLogin()}
          >
            {loginSubmitting ? 'Signing In...' : 'Sign In to Dashboard'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <a href="/" style={{ color: '#64748b', fontSize: 12, textDecoration: 'none' }}>
            ← Back to ColdGuard Homepage
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. LOGGED IN BUT NO ASSIGNED SHIPMENT BY LOGISTICS MANAGER
  // -------------------------------------------------------------
  if (!shipment) {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginHeader}>
          <div style={s.loginLogoBadge}>🚚</div>
          <h1 style={s.loginTitle}>{currentUser?.name || 'Driver'}</h1>
          <p style={s.loginSubtitle}>Cold-Chain Fleet Portal</p>
        </div>

        <div style={s.unassignedCard}>
          <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>📋</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center', margin: 0 }}>
            No Active Route Assigned
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.5, marginTop: 8 }}>
            Your Logistics Manager has not assigned an active shipment to your profile yet.
            Once a shipment is dispatched from the Logistics Dashboard, your 3D navigation route will activate automatically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <button
              style={s.refreshBtn}
              onClick={() => {
                if (token) {
                  fetch(`${API}/shipments`, { headers: { Authorization: `Bearer ${token}` } })
                    .then((r) => r.json())
                    .then((d) => {
                      const all = d.data?.shipments ?? [];
                      const uName = (currentUser?.name || '').toLowerCase().trim();
                      const match = all.find((s: any) =>
                        (s.driver_name || '').toLowerCase().includes(uName.split(' ')[0]) &&
                        ['IN_TRANSIT', 'CREATED', 'WARNING', 'CRITICAL', 'REROUTED', 'DIVERTED'].includes(s.status)
                      );
                      if (match) {
                        setShipment(match);
                        setShipmentId(match.id);
                        fetchRouteData(token, match.id);
                      }
                    });
                }
              }}
            >
              🔄 Refresh Assignment
            </button>
            <button style={s.switchBtn} onClick={handleLogout}>
              Switch Driver / Sign Out
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <a href="/manager" style={{ color: '#3b82f6', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
            Go to Logistics Manager Dashboard →
          </a>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. LOGGED IN & ASSIGNED: Render Full Google Maps Style 3D Navigation UI
  // -------------------------------------------------------------

  return (
    <div style={s.navScreenWrap}>
      {/* 3D MapLibre Navigation Canvas (FullScreen Background) */}
      <div style={s.mapCanvasWrapper}>
        <MapLibreNavMap
          routeCoordinates={routeCoordinates}
          routeSteps={routeSteps}
          isNavigating={isMoving || isEmergency}
          isEmergency={isEmergency}
          currentStreet={currentStreet}
          nextStep={nextStep}
          currentCoord={stableOriginCoord}
          originCoord={stableOriginCoord}
          originName={shipment?.origin_name || 'Sub District Hospital, Ponda'}
          destinationCoord={stableDestCoord}
          destinationName={shipment?.destination_name || 'North Goa District Hospital, Mapusa'}
          facilities={facilities}
          facilityCoord={stableFacilityCoord}
          facilityName={emergencyFacility?.name}
          onLocationUpdate={handleLocationUpdate}
          onFacilityArrival={handleFacilityArrival}
          onArrival={handleArrival}
        />
      </div>

      {/* Top Floating HUD: Driver Identity & Temperature Live Pill */}
      <div style={s.topHudRow}>
        <div style={s.driverPill}>
          <span style={s.driverPillDot}>●</span>
          <span style={s.driverPillName}>{currentUser?.name || 'Driver'}</span>
          <button style={s.switchDriverBtn} onClick={handleLogout}>
            Switch
          </button>
        </div>

        <div style={{ ...s.tempPill, borderColor: tempColor, boxShadow: `0 4px 14px ${tempColor}40` }}>
          <span style={{ fontSize: 12 }}>🌡</span>
          <span style={{ ...s.tempValText, color: tempColor, animation: tempPulse ? 'cgPulse 0.5s ease' : 'none' }}>
            {temp !== undefined && temp !== null ? `${Number(temp).toFixed(1)}°C` : '--.-C'}
          </span>
          <span style={s.tempStatusBadge(statusColor)}>
            {displayStatus}
          </span>
        </div>

        <button style={s.alertPillBtn} onClick={() => setShowAlerts(!showAlerts)}>
          🔔
          {unread > 0 && <span style={s.badge}>{unread}</span>}
        </button>
      </div>

      {/* Small Hazard Warning Badge on Right (Google Maps Navigation Style) */}
      {isEmergency && (
        <div style={s.rightWarningBadge}>
          <div style={s.rightWarningCircle}>
            <span>⚠️</span>
          </div>
          <span style={s.rightWarningLabel}>TEMP BREACH</span>
        </div>
      )}

      {/* Alerts Drawer */}
      {showAlerts && (
        <div style={s.alertPanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 13 }}>Driver Notifications</span>
            <button style={s.closeBtn} onClick={() => setShowAlerts(false)}>✕</button>
          </div>
          {alerts.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 12 }}>No active alerts.</p>
          ) : (
            alerts.slice(0, 3).map((a: any) => (
              <div key={a.id} style={s.alertItem(a.severity)}>
                <div style={{ fontWeight: 700, fontSize: 11 }}>{a.title}</div>
                <div style={{ fontSize: 10, opacity: 0.9, marginTop: 1 }}>{a.message}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bottom Floating Control Dock */}
      <div style={s.bottomDockWrap}>
        {actionMsg && (
          <div style={s.actionPill(isEmergency)}>
            {loading && <div style={s.miniSpinner} />}
            <span>{actionMsg}</span>
          </div>
        )}

        {/* Sleek Small Circular Control Buttons (Play/Pause Circle + Red Alert Circle) */}
        <div style={s.circleDock}>
          {/* Circular Play / Pause Toggle Button */}
          <button
            style={{
              ...s.circleFab,
              background: isMoving || driverStatus === 'emergency'
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : isAtFacility
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: isMoving
                ? '0 4px 18px rgba(245,158,11,0.5)'
                : '0 4px 18px rgba(34,197,94,0.5)',
              opacity: driverStatus === 'delivered' ? 0.45 : 1,
            }}
            onClick={isMoving || driverStatus === 'emergency' ? handleStop : handleStart}
            disabled={driverStatus === 'delivered' || loading}
            title={isMoving ? 'Pause Simulation' : isAtFacility ? 'Resume Simulation' : 'Start Simulation'}
          >
            {loading ? (
              <div style={s.miniSpinner} />
            ) : isMoving || driverStatus === 'emergency' ? (
              <span style={{ fontSize: 20, color: '#ffffff', lineHeight: 1 }}>⏸</span>
            ) : (
              <span style={{ fontSize: 20, color: '#ffffff', lineHeight: 1, marginLeft: 3 }}>▶</span>
            )}
          </button>

          {/* Red Circular Button for Temperature Excursion Spike */}
          <button
            style={{
              ...s.circleFab,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 18px rgba(239,68,68,0.55)',
              animation: tempPulse ? 'cgPulse 0.5s ease' : 'none',
              opacity: loading ? 0.65 : 1,
            }}
            onClick={handleIncreaseTemp}
            disabled={loading}
            title="Simulate Temperature Excursion (Spike Temp)"
          >
            <span style={{ fontSize: 20, color: '#ffffff', lineHeight: 1 }}>🔥</span>
          </button>
        </div>

        {/* Delivery Confirmation - ONLY after reaching destination hospital */}
        {driverStatus === 'delivered' && (
          <button style={s.deliverBtn} onClick={handleDeliver} disabled={loading}>
            ✓ Confirm Delivery & Complete Mission
          </button>
        )}
      </div>

      <style>{`
        @keyframes cgPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes cgSpin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

const s: Record<string, any> = {
  unassignedCard: {
    background: '#131c2e',
    border: '1px solid #1e293b',
    borderRadius: 18,
    padding: 20,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  refreshBtn: {
    padding: '11px',
    borderRadius: 12,
    background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    color: '#fff',
    border: 'none',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
  },
  switchBtn: {
    padding: '10px',
    borderRadius: 12,
    background: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },
  loginWrap: {
    maxWidth: 440,
    minHeight: '100vh',
    margin: '0 auto',
    background: 'linear-gradient(180deg,#070d1a 0%,#0b1422 100%)',
    color: '#f1f5f9',
    fontFamily: "'Inter',-apple-system,sans-serif",
    padding: '32px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  loginHeader: { textAlign: 'center', marginBottom: 6 },
  loginLogoBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 16,
    background: 'rgba(59,130,246,0.15)',
    border: '1px solid rgba(59,130,246,0.3)',
    fontSize: 24,
    marginBottom: 8,
  },
  loginTitle: { fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', color: '#fff' },
  loginSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 500 },
  loginErrorBox: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid #ef444455',
    color: '#fca5a5',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 600,
  },
  quickSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  quickHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  quickTitle: { fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b' },
  quickBadge: { fontSize: 10, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 10 },
  driverList: { display: 'flex', flexDirection: 'column', gap: 10 },
  driverCard: {
    background: '#131c2e',
    border: '1px solid #1e293b',
    borderRadius: 16,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  driverCardTop: { display: 'flex', alignItems: 'center', gap: 10 },
  driverIcon: { fontSize: 24 },
  driverName: { fontSize: 15, fontWeight: 800, color: '#fff' },
  driverVehicle: { fontSize: 11, color: '#64748b', fontWeight: 500 },
  driverMeta: {
    background: '#090f1d',
    padding: '6px 10px',
    borderRadius: 8,
    fontSize: 11,
    color: '#cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  driverCargo: { fontWeight: 600 },
  driverRoute: { fontWeight: 600 },
  driverLoginBtn: {
    marginTop: 4,
    padding: '9px 14px',
    borderRadius: 10,
    background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    color: '#fff',
    border: 'none',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
  },
  manualBox: {
    background: '#0d1527',
    border: '1px solid #1e293b',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  manualTitle: { fontSize: 12, fontWeight: 700, color: '#94a3b8' },
  manualInput: {
    padding: '10px 14px',
    background: '#131c2e',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    outline: 'none',
  },
  manualSubmitBtn: {
    padding: '10px',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  navScreenWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    height: '100vh',
    margin: '0 auto',
    overflow: 'hidden',
    background: '#070d1a',
    fontFamily: "'Inter',-apple-system,sans-serif",
  },
  mapCanvasWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  topHudRow: {
    position: 'absolute',
    top: 68,
    left: 12,
    right: 12,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    pointerEvents: 'auto',
  },
  driverPill: {
    background: 'rgba(15,23,42,0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(51,65,85,0.7)',
    borderRadius: 20,
    padding: '5px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  driverPillDot: { color: '#22c55e', fontSize: 10, fontWeight: 900 },
  driverPillName: { color: '#f8fafc', fontSize: 11, fontWeight: 700 },
  switchDriverBtn: {
    background: 'rgba(51,65,85,0.8)',
    border: 'none',
    color: '#94a3b8',
    padding: '2px 6px',
    borderRadius: 6,
    fontSize: 9,
    fontWeight: 700,
    cursor: 'pointer',
    marginLeft: 2,
  },
  tempPill: {
    background: 'rgba(15,23,42,0.9)',
    backdropFilter: 'blur(8px)',
    border: '1.5px solid #22c55e',
    borderRadius: 20,
    padding: '5px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
  },
  tempValText: { fontSize: 14, fontWeight: 900, letterSpacing: '-0.5px' },
  tempStatusBadge: (color: string) => ({
    fontSize: 9,
    fontWeight: 800,
    color,
    background: `${color}20`,
    padding: '1px 5px',
    borderRadius: 8,
  }),
  alertPillBtn: {
    position: 'relative',
    background: 'rgba(15,23,42,0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(51,65,85,0.7)',
    borderRadius: 20,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    cursor: 'pointer',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    background: '#ef4444',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    borderRadius: '50%',
    width: 15,
    height: 15,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightWarningBadge: {
    position: 'absolute',
    top: 120,
    right: 14,
    zIndex: 25,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    animation: 'cgPulse 1.2s infinite',
    pointerEvents: 'auto',
  },
  rightWarningCircle: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: '2.5px solid #ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    boxShadow: '0 4px 16px rgba(239,68,68,0.6)',
    color: '#ffffff',
  },
  rightWarningLabel: {
    background: 'rgba(15,23,42,0.9)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(239,68,68,0.6)',
    color: '#fca5a5',
    fontSize: 9,
    fontWeight: 900,
    padding: '2px 6px',
    borderRadius: 8,
    letterSpacing: 0.5,
  },
  alertPanel: {
    position: 'absolute',
    top: 114,
    left: 12,
    right: 12,
    zIndex: 15,
    background: '#1e293b',
    borderRadius: 16,
    padding: 12,
    border: '1px solid #334155',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  closeBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer' },
  alertItem: (sev: string) => ({
    padding: '6px 10px',
    borderRadius: 8,
    marginBottom: 6,
    background: sev === 'CRITICAL' ? 'rgba(239,68,68,.2)' : 'rgba(59,130,246,.2)',
    border: `1px solid ${sev === 'CRITICAL' ? '#ef444450' : '#3b82f650'}`,
    color: sev === 'CRITICAL' ? '#fca5a5' : '#93c5fd',
  }),
  bottomDockWrap: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actionPill: (isEmergency: boolean) => ({
    background: isEmergency ? 'rgba(239,68,68,0.92)' : 'rgba(15,23,42,0.92)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${isEmergency ? '#ef4444' : '#3b82f640'}`,
    borderRadius: 14,
    padding: '6px 12px',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
    margin: '0 auto',
    maxWidth: 380,
  }),
  miniSpinner: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
    border: '2px solid #94a3b8',
    borderTop: '2px solid #fff',
    animation: 'cgSpin .7s linear infinite',
  },
  circleDock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'rgba(15,23,42,0.85)',
    backdropFilter: 'blur(16px)',
    padding: '8px 18px',
    borderRadius: 36,
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    margin: '0 auto',
  },
  circleFab: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  deliverBtn: {
    padding: '10px 14px',
    background: 'linear-gradient(135deg,#22c55e,#15803d)',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(34,197,94,0.35)',
    textAlign: 'center' as const,
  },
};
