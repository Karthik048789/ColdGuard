'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    name: 'Rajesh Kumar',
    email: 'driver@coldguard.ai',
    password: 'password123',
    vehicle: 'Reefer Truck GA-07-C-4021',
    cargo: 'Covishield & Rabies Vaccine',
    route: 'GMC Bambolim → Margao',
    icon: '🚛',
  },
  {
    name: 'Suresh Nair',
    email: 'suresh@coldguard.ai',
    password: 'password123',
    vehicle: 'Reefer Van GA-08-D-8910',
    cargo: 'Polio & Rotavirus Vaccine',
    route: 'SDH Ponda → Mapusa',
    icon: '🚐',
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

  // Route & Steps Fetcher
  const fetchRouteData = useCallback(async (tk: string, sid: number, facilityId?: number, direct?: boolean) => {
    try {
      let url = `${API}/shipments/${sid}/route`;
      if (facilityId) {
        url += `?facility_id=${facilityId}`;
      } else if (direct) {
        url += `?direct=true`;
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
      }
    } catch (e) {
      console.error('Failed to fetch OSRM route:', e);
    }
  }, []);

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

        // Match shipment strictly assigned to this logged-in driver by the Logistics Manager!
        let assigned = allShipments.find((s: any) => {
          const sDriver = (s.driver_name || '').toLowerCase().trim();
          const uName = userName.toLowerCase().trim();
          return (
            (sDriver === uName || sDriver.includes(uName.split(' ')[0])) &&
            ['IN_TRANSIT', 'CREATED', 'WARNING', 'CRITICAL', 'REROUTED', 'DIVERTED'].includes(s.status)
          );
        });

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
          await fetchRouteData(token, assigned.id);
        }
      } catch (e) {
        console.error('Error loading shipment:', e);
      }
    })();
  }, [token, fetchRouteData]);

  // Periodic Location & Telemetry Sync callback from Map
  const handleLocationUpdate = useCallback(async (lng: number, lat: number, speed: number) => {
    const tk = tokenRef.current;
    const sid = shipmentIdRef.current;
    if (!tk || !sid) return;

    const curT = telemetryRef.current?.temperature ?? 4.2;
    const newTemp = parseFloat((curT + (Math.random() * 0.06 - 0.03)).toFixed(2));

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
        }),
      });
      setTelemetry((p) => (p ? { ...p, latitude: lat, longitude: lng, temperature: newTemp } : p));
    } catch {}
  }, []);

  // Handle arrival at either emergency facility or final destination
  const handleArrival = useCallback(async () => {
    if (driverStatus === 'emergency') {
      // 1. ARRIVED AT NEARBY EMERGENCY FACILITY -> STOP HERE!
      setDriverStatus('at_facility');
      setIsAtFacility(true);
      const facName = emergencyFacility?.name?.split(',')[0] || 'Emergency Cold Storage';
      setActionMsg(`❄️ Arrived at ${facName}! Cargo secured & stabilized at 3.5°C.`);
      // Normalize cargo temperature inside cold storage
      setTelemetry((prev) => (prev ? { ...prev, temperature: 3.5 } : prev));

      // Report safe arrival at facility to backend
      const tk = tokenRef.current;
      const sid = shipmentIdRef.current;
      if (tk && sid && emergencyFacility) {
        try {
          await fetch(`${API}/shipments/${sid}/telemetry`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              temperature: 3.5,
              humidity: 60.0,
              battery: 90.0,
              latitude: emergencyFacility.latitude,
              longitude: emergencyFacility.longitude,
            }),
          });
        } catch {}
      }
    } else {
      // 2. ARRIVED AT FINAL DESTINATION HOSPITAL
      setDriverStatus('delivered');
      setActionMsg('✓ Arrived at destination hospital vault! Ready for delivery confirmation.');
    }
  }, [driverStatus, emergencyFacility]);

  // Controls
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
      } else {
        if (routeCoordinates.length < 2) {
          await fetchRouteData(token, shipmentId);
        }
        setActionMsg('Cruising at ~60 km/h along highway...');
      }

      if (shipment?.status === 'CREATED') {
        await fetch(`${API}/shipments/${shipmentId}/start`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setDriverStatus('moving');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    setDriverStatus('idle');
    setActionMsg('Vehicle stopped. Standby mode.');
  };

  const handleIncreaseTemp = async () => {
    if (!token || !shipmentId) return;
    setLoading(true);
    setTempPulse(true);
    setTimeout(() => setTempPulse(false), 800);

    try {
      // 1. Progressively increase container temperature (+2.2°C to +3.5°C each click)
      const curTemp = telemetry?.temperature ?? shipment?.current_temp ?? 6.2;
      const newSpikeTemp = parseFloat((curTemp + 2.2 + Math.random() * 0.8).toFixed(2));

      // Post real telemetry reading to backend database (/api/shipments/{id}/telemetry)
      const curLat = telemetry?.latitude ?? shipment?.origin_lat ?? 15.4647;
      const curLng = telemetry?.longitude ?? shipment?.origin_lng ?? 73.8560;

      await fetch(`${API}/shipments/${shipmentId}/telemetry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: newSpikeTemp,
          humidity: 68.0,
          battery: 88.0,
          latitude: curLat,
          longitude: curLng,
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

      // Immediately update local UI telemetry state so temperature visibly increases!
      setTelemetry((prev) => ({
        ...(prev || { humidity: 68, battery: 88, recorded_at: new Date().toISOString() }),
        temperature: newSpikeTemp,
        latitude: curLat,
        longitude: curLng,
      }));

      // 2. Fetch nearest eligible cold-storage facility (/api/shipments/{id}/facilities/eligible)
      const facRes = await fetch(`${API}/shipments/${shipmentId}/facilities/eligible`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const facData = await facRes.json();
      const nearest = facData.data?.recommended_facility || facData.data?.facilities?.[0];

      if (nearest) {
        setEmergencyFacility(nearest);
        setIsAtFacility(false);
        const facShortName = nearest.name.split(',')[0];
        setActionMsg(`⚠️ Temp breach: ${newSpikeTemp}°C! Rerouting to ${facShortName}...`);

        // 3. Recalculate road route to this nearby facility
        await fetchRouteData(token, shipmentId, nearest.id);

        // 4. Start navigating towards facility!
        setDriverStatus('emergency');
      } else {
        setDriverStatus('emergency');
        setActionMsg(`⚠️ Temp breach: ${newSpikeTemp}°C! Thermal anomaly recorded.`);
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
          originCoord={
            shipment?.origin_lng && shipment?.origin_lat
              ? [Number(shipment.origin_lng), Number(shipment.origin_lat)]
              : null
          }
          originName={shipment?.origin_name || 'GMC Bambolim Central Vault'}
          destinationCoord={
            shipment?.destination_lng && shipment?.destination_lat
              ? [Number(shipment.destination_lng), Number(shipment.destination_lat)]
              : null
          }
          destinationName={shipment?.destination_name || 'South Goa District Hospital'}
          facilities={facilities}
          facilityCoord={
            emergencyFacility?.longitude && emergencyFacility?.latitude
              ? [Number(emergencyFacility.longitude), Number(emergencyFacility.latitude)]
              : null
          }
          facilityName={emergencyFacility?.name}
          onLocationUpdate={handleLocationUpdate}
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
            {temp !== undefined && temp !== null ? `${Number(temp).toFixed(1)}°C` : '--.-°C'}
          </span>
          <span style={s.tempStatusBadge(tempColor)}>
            {isEmergency ? 'BREACH' : isAtFacility ? 'SECURED' : isMoving ? 'SAFE' : 'STANDBY'}
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

        {/* Compact 3-Button Glass Pill Dock (Small, Sleek, Minimal) */}
        <div style={s.compactDock}>
          <button
            style={{
              ...s.smallBtn,
              background: isMoving || driverStatus === 'emergency' || driverStatus === 'delivered'
                ? 'rgba(30,41,59,0.6)'
                : isAtFacility
                ? 'linear-gradient(135deg,#10b981,#059669)'
                : 'linear-gradient(135deg,#22c55e,#15803d)',
              opacity: isMoving || driverStatus === 'emergency' || driverStatus === 'delivered' ? 0.45 : 1,
              boxShadow: isAtFacility ? '0 0 10px rgba(16,185,129,0.5)' : '0 2px 6px rgba(0,0,0,0.25)',
            }}
            onClick={handleStart}
            disabled={isMoving || driverStatus === 'emergency' || driverStatus === 'delivered' || loading}
          >
            <span>▶</span> <span>{isAtFacility ? 'Resume' : 'Start'}</span>
          </button>

          <button
            style={{
              ...s.smallBtn,
              background: !isMoving && !isEmergency
                ? 'rgba(30,41,59,0.7)'
                : 'linear-gradient(135deg,#64748b,#475569)',
              opacity: !isMoving && !isEmergency ? 0.5 : 1,
            }}
            onClick={handleStop}
            disabled={!isMoving && !isEmergency}
          >
            <span>⏸</span> <span>Stop</span>
          </button>

          <button
            style={{
              ...s.smallBtn,
              background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleIncreaseTemp}
            disabled={loading}
          >
            <span>🔥</span> <span>Temp+</span>
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
  compactDock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'rgba(15,23,42,0.9)',
    backdropFilter: 'blur(12px)',
    padding: '4px 6px',
    borderRadius: 18,
    border: '1px solid rgba(51,65,85,0.7)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
    margin: '0 auto',
    width: '100%',
    maxWidth: 270,
  },
  smallBtn: {
    flex: 1,
    height: 30,
    padding: '0 8px',
    borderRadius: 13,
    border: 'none',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
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
