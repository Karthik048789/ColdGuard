'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiFetch } from '@/lib/api';
import { Shipment, Facility } from '@/lib/types';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  Info,
  Layers,
  MapPin,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react';

// Dynamic import for Leaflet map with SSR disabled
const LeafletMap = dynamic(() => import('@/components/maps/LeafletMap'), { ssr: false });

interface FleetDriver {
  id: number;
  name: string;
  phone: string;
  vehicle: string;
  email?: string;
  avatarColor?: string;
}

const FLEET_DRIVERS: FleetDriver[] = [
  { id: 1, name: 'Rajesh Kumar', phone: '+91 98765 43211', vehicle: 'Reefer Truck GA-07-C-4021', email: 'driver@coldguard.ai', avatarColor: 'bg-blue-600' },
  { id: 2, name: 'Suresh Nair', phone: '+91 98470 12345', vehicle: 'Reefer Van GA-08-D-8910', avatarColor: 'bg-emerald-600' },
  { id: 3, name: 'Manoj Varma', phone: '+91 98950 67890', vehicle: 'Deep Freeze Unit GA-03-A-1204', avatarColor: 'bg-indigo-600' },
  { id: 4, name: 'Anil Joseph', phone: '+91 94471 23456', vehicle: 'Cryo Transporter GA-09-E-5567', avatarColor: 'bg-purple-600' },
];

// Sparkline SVG Component for Dashboard KPI Cards
function Sparkline({ color, data }: { color: string; data: number[] }) {
  const width = 110;
  const height = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const fillPath = `M 0,${height} L ${points} L ${width},${height} Z`;

  return (
    <div className="relative w-28 h-9 overflow-hidden pointer-events-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${color})`} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

// Visual Temperature Tolerance Gauge Bar Component
function TemperatureToleranceBar({
  minTemp,
  maxTemp,
  currentTemp,
}: {
  minTemp: number;
  maxTemp: number;
  currentTemp?: number | null;
}) {
  const hasCur = currentTemp != null && !isNaN(currentTemp);

  // Dynamic span with comfort buffer
  const buffer = Math.max(1.5, (maxTemp - minTemp) * 0.35);
  const gaugeMin = minTemp - buffer;
  const gaugeMax = maxTemp + buffer;
  const totalSpan = gaugeMax - gaugeMin || 1;

  const safeStartPct = Math.max(6, Math.min(94, ((minTemp - gaugeMin) / totalSpan) * 100));
  const safeEndPct = Math.max(6, Math.min(94, ((maxTemp - gaugeMin) / totalSpan) * 100));

  let curPct = 50;
  let isExcursion = false;
  let isWarning = false;

  if (hasCur) {
    const clamped = Math.max(gaugeMin, Math.min(gaugeMax, currentTemp));
    curPct = Math.max(4, Math.min(96, ((clamped - gaugeMin) / totalSpan) * 100));
    if (currentTemp < minTemp || currentTemp > maxTemp) {
      isExcursion = true;
    } else if (currentTemp <= minTemp + 0.4 || currentTemp >= maxTemp - 0.4) {
      isWarning = true;
    }
  }

  return (
    <div className="space-y-1.5 py-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500 font-semibold flex items-center gap-1.5">
          <Thermometer className="w-3.5 h-3.5 text-blue-500" />
          Temperature tolerance
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded text-[10px] border border-slate-200/60">
            {minTemp}°C - {maxTemp}°C
          </span>
          {hasCur ? (
            <span
              className={`font-mono font-black text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs ${
                isExcursion
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-rose-400/30'
                  : isWarning
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 ring-1 ring-amber-400/30'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 ring-1 ring-emerald-400/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isExcursion ? 'bg-rose-600 animate-ping' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              {currentTemp.toFixed(1)}°C
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-mono">--°C</span>
          )}
        </div>
      </div>

      {/* Visual Tolerance Track Bar */}
      <div className="relative w-full h-3 rounded-full bg-slate-100/80 overflow-visible border border-slate-200 shadow-inner">
        <div
          className="absolute inset-0 rounded-full opacity-90"
          style={{
            background: `linear-gradient(to right, 
              #38bdf8 0%, 
              #38bdf8 ${safeStartPct}%, 
              #10b981 ${safeStartPct}%, 
              #10b981 ${safeEndPct}%, 
              #f59e0b ${safeEndPct}%, 
              #ef4444 100%)`,
          }}
        />

        {/* Current temperature pointer marker */}
        {hasCur && (
          <div
            className="absolute -top-1 -bottom-1 w-3 -ml-1.5 flex items-center justify-center transition-all duration-300 z-10"
            style={{ left: `${curPct}%` }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md ${
                isExcursion ? 'bg-rose-600 ring-2 ring-rose-400/40' : isWarning ? 'bg-amber-500' : 'bg-emerald-600 ring-2 ring-emerald-400/40'
              }`}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono px-0.5">
        <span>{minTemp}°C</span>
        <span className="text-[8px] uppercase tracking-wider text-emerald-600 font-bold">Optimal Target Window</span>
        <span>{maxTemp}°C</span>
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'WARNING' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDriverRoster, setShowDriverRoster] = useState(false);

  // OSRM route state for main view
  const [routeCoordinates, setRouteCoordinates] = useState<Array<[number, number]>>([]);
  const [routeMeta, setRouteMeta] = useState<{ distanceKm?: string | number; durationMin?: string | number; via?: string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Modals & Action States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [geocoding, setGeocoding] = useState(false);
  const [geoSearchQuery, setGeoSearchQuery] = useState('');
  const [geoSearching, setGeoSearching] = useState(false);
  const [geoResults, setGeoResults] = useState<any[]>([]);
  const [modalRouteCoords, setModalRouteCoords] = useState<Array<[number, number]>>([]);
  const [modalRouteMeta, setModalRouteMeta] = useState<{ distanceKm?: string; durationMin?: number } | null>(null);

  // Form state for creating a new shipment in Goa
  const [newShipment, setNewShipment] = useState({
    product_name: '',
    quantity: 200,
    quantity_unit: 'vials',
    shipment_value: 250000,
    origin_name: 'Goa Medical College (GMC) Central Vault, Bambolim',
    origin_lat: 15.4647,
    origin_lng: 73.856,
    destination_name: 'South Goa District Hospital, Margao',
    destination_lat: 15.2832,
    destination_lng: 73.9862,
    min_temp: 2.0,
    max_temp: 8.0,
    driver_name: 'Rajesh Kumar',
    driver_phone: '+91 98765 43211',
  });

  // Success alert state
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Extract shipments safely from any backend response structure
  const extractShipments = (res: any): Shipment[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.shipments)) return res.data.shipments;
    if (Array.isArray(res.shipments)) return res.shipments;
    return [];
  };

  // Fetch OSRM Road Route for a specific shipment
  const fetchOsrmRoute = useCallback(async (shipment: Shipment) => {
    setRouteLoading(true);
    try {
      // 1. Attempt backend routing endpoint
      const res = await apiFetch<any>(`/shipments/${shipment.id}/route`).catch(() => null);

      if (res?.data?.geometry?.coordinates && Array.isArray(res.data.geometry.coordinates)) {
        const leafletCoords: Array<[number, number]> = res.data.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );
        setRouteCoordinates(leafletCoords);
        setRouteMeta({
          distanceKm: res.data.distance_km ?? (res.data.distance_m ? (res.data.distance_m / 1000).toFixed(1) : undefined),
          durationMin: res.data.duration_minutes ?? (res.data.duration_seconds ? Math.round(res.data.duration_seconds / 60) : undefined),
          via: 'Backend OSRM Engine',
        });
        return;
      }

      // 2. Direct OSRM public engine fallback
      const startLng = Number(shipment.current_lng || shipment.origin_lng);
      const startLat = Number(shipment.current_lat || shipment.origin_lat);
      const endLng = Number(shipment.destination_lng);
      const endLat = Number(shipment.destination_lat);

      if (startLng && startLat && endLng && endLat) {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const osrmRes = await fetch(osrmUrl).then((r) => r.json()).catch(() => null);

        if (osrmRes?.routes?.[0]?.geometry?.coordinates) {
          const leafletCoords: Array<[number, number]> = osrmRes.routes[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
          );
          setRouteCoordinates(leafletCoords);
          setRouteMeta({
            distanceKm: (osrmRes.routes[0].distance / 1000).toFixed(1),
            durationMin: Math.round(osrmRes.routes[0].duration / 60),
            via: 'OpenStreetMap OSRM',
          });
          return;
        }
      }

      setRouteCoordinates([]);
      setRouteMeta(null);
    } catch (err) {
      console.error('OSRM route fetch failed:', err);
      setRouteCoordinates([]);
      setRouteMeta(null);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // Calculate route preview inside the create modal
  const updateModalRoutePreview = useCallback(async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const osrmRes = await fetch(osrmUrl).then((r) => r.json()).catch(() => null);

      if (osrmRes?.routes?.[0]?.geometry?.coordinates) {
        const coords: Array<[number, number]> = osrmRes.routes[0].geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        setModalRouteCoords(coords);
        setModalRouteMeta({
          distanceKm: (osrmRes.routes[0].distance / 1000).toFixed(1),
          durationMin: Math.round(osrmRes.routes[0].duration / 60),
        });
      }
    } catch {
      setModalRouteCoords([]);
      setModalRouteMeta(null);
    }
  }, []);

  // Action: Run Gemini AI Risk Assessment
  const handleRunAiAnalysis = async (id: number) => {
    setAiLoading(true);
    try {
      const res = await apiFetch<any>(`/shipments/${id}/ai-analysis`, { method: 'POST' });
      if (res?.data) {
        setAiAnalysis(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'AI analysis unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  // Forward geocoding & PIN code search
  const handleForwardGeocode = async (q: string) => {
    setGeoSearchQuery(q);
    if (!q.trim() || q.trim().length < 2) {
      setGeoResults([]);
      return;
    }
    setGeoSearching(true);
    try {
      const isPin = /^\d{6}$/.test(q.trim());
      const url = isPin
        ? `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(q.trim())}&country=in&format=json`
        : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim() + ', Goa, India')}&format=json&limit=5`;
      const res = await fetch(url, { headers: { 'User-Agent': 'ColdGuard/1.0' } }).then((r) => r.json());
      if (Array.isArray(res)) {
        setGeoResults(res);
      } else {
        setGeoResults([]);
      }
    } catch {
      setGeoResults([]);
    } finally {
      setGeoSearching(false);
    }
  };

  const handleSelectGeoLocation = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const name = item.display_name.split(',').slice(0, 3).join(', ').trim();
    const roundedLat = parseFloat(lat.toFixed(4));
    const roundedLng = parseFloat(lng.toFixed(4));
    setNewShipment((prev) => {
      const updated = {
        ...prev,
        destination_lat: roundedLat,
        destination_lng: roundedLng,
        destination_name: name,
      };
      updateModalRoutePreview(updated.origin_lat, updated.origin_lng, roundedLat, roundedLng);
      return updated;
    });
    setGeoResults([]);
    setGeoSearchQuery(name);
  };

  // Reverse geocoding via OpenStreetMap Nominatim
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      setGeocoding(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'User-Agent': 'ColdGuard/1.0' },
      }).then((r) => r.json());

      if (res?.display_name) {
        const parts = res.display_name.split(',');
        return parts.slice(0, 3).join(',').trim();
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } finally {
      setGeocoding(false);
    }
  };

  // Handle map click in the Dispatch Modal
  const handleModalMapClick = async (lat: number, lng: number) => {
    const roundedLat = parseFloat(lat.toFixed(4));
    const roundedLng = parseFloat(lng.toFixed(4));

    const placeName = await reverseGeocode(roundedLat, roundedLng);
    setNewShipment((prev) => {
      const updated = {
        ...prev,
        destination_lat: roundedLat,
        destination_lng: roundedLng,
        destination_name: placeName,
      };
      updateModalRoutePreview(updated.origin_lat, updated.origin_lng, roundedLat, roundedLng);
      return updated;
    });
  };

  // Action: Create and Dispatch Shipment
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<any>('/shipments', {
        method: 'POST',
        body: JSON.stringify(newShipment),
      });

      const newId = res?.data?.shipment?.id;
      setShowCreateModal(false);
      await loadDashboardData(newId);

      const trackNum = res?.data?.shipment?.tracking_number || newId;
      setSuccessBanner(`Success! Dispatched new shipment ${trackNum} to ${newShipment.destination_name}.`);
      setTimeout(() => setSuccessBanner(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch shipment');
    }
  };

  // Action: Start Transit
  const handleStartTransit = async (id: number) => {
    try {
      await apiFetch<any>(`/shipments/${id}/start`, { method: 'POST' });
      await loadDashboardData(id);
      setSuccessBanner(`Shipment #${id} is now IN TRANSIT! OSRM telemetry stream active.`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to start transit');
    }
  };

  // Open modal with default route preview
  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    updateModalRoutePreview(
      newShipment.origin_lat,
      newShipment.origin_lng,
      newShipment.destination_lat,
      newShipment.destination_lng
    );
  };

  // Select shipment and fetch its road route
  const handleSelectShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    fetchOsrmRoute(shipment);
  };

  // Open Detailed Modal & Trigger AI
  const handleOpenDetail = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
    setAiAnalysis(null);
  };

  // Load shipments and facilities from backend (with silent background polling)
  const loadDashboardData = useCallback(async (preferredSelectId?: number, isSilent = false) => {
    if (!isSilent && shipments.length === 0) {
      setLoading(true);
    }
    try {
      const [shipmentsRes, facilitiesRes] = await Promise.all([
        apiFetch<any>('/shipments').catch(() => null),
        apiFetch<any>('/facilities').catch(() => null),
      ]);

      const extractedShipments = extractShipments(shipmentsRes);
      setShipments(extractedShipments);

      const facList = Array.isArray(facilitiesRes)
        ? facilitiesRes
        : facilitiesRes?.data && Array.isArray(facilitiesRes.data)
        ? facilitiesRes.data
        : [];
      setFacilities(facList);

      if (extractedShipments.length > 0) {
        let toSelect: Shipment | undefined;
        if (preferredSelectId) {
          toSelect = extractedShipments.find((s) => s.id === preferredSelectId);
        }
        if (!toSelect && selectedShipment) {
          toSelect = extractedShipments.find((s) => s.id === selectedShipment.id);
        }
        if (!toSelect) {
          // Prioritize active in-transit shipments so manager sees live moving truck
          toSelect = extractedShipments.find((s) => ['IN_TRANSIT', 'WARNING', 'CRITICAL', 'REROUTED', 'DIVERTED'].includes(s.status)) || extractedShipments[0];
        }

        if (toSelect) {
          setSelectedShipment(toSelect);
          // Only re-fetch route if selecting a new shipment or if route coordinates are missing
          if (selectedShipment?.id !== toSelect.id || routeCoordinates.length === 0) {
            fetchOsrmRoute(toSelect);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [fetchOsrmRoute, selectedShipment?.id, routeCoordinates.length, shipments.length]);

  // Initial mount with silent 15-second background polling
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(undefined, true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Real-time live polling for selected shipment telemetry & moving truck position
  useEffect(() => {
    if (!selectedShipment) return;
    if (selectedShipment.status === 'DELIVERED') return;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch<any>(`/shipments/${selectedShipment.id}`);
        if (res?.success && res?.data) {
          const fresh = res.data?.shipment || res.data;
          // Only update if coordinates, temp, or status changed
          setSelectedShipment((prev) => {
            if (!prev || prev.id !== fresh.id) return prev;
            if (
              prev.current_lat === fresh.current_lat &&
              prev.current_lng === fresh.current_lng &&
              prev.current_temp === fresh.current_temp &&
              prev.status === fresh.status
            ) {
              return prev;
            }
            return {
              ...prev,
              current_lat: fresh.current_lat,
              current_lng: fresh.current_lng,
              current_temp: fresh.current_temp,
              status: fresh.status,
            };
          });

          // Also keep the shipment in the shipments list up to date
          setShipments((prev) =>
            prev.map((s) =>
              s.id === fresh.id
                ? {
                    ...s,
                    current_lat: fresh.current_lat,
                    current_lng: fresh.current_lng,
                    current_temp: fresh.current_temp,
                    status: fresh.status,
                  }
                : s
            )
          );
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [selectedShipment?.id, selectedShipment?.status]);

  // Compute live driver availability
  const safeShipments = Array.isArray(shipments) ? shipments : [];

  const busyDriversMap = new Map<string, Shipment>();
  safeShipments.forEach((s) => {
    if ((s.status === 'IN_TRANSIT' || s.status === 'WARNING' || s.status === 'CRITICAL' || s.status === 'REROUTED') && s.driver_name) {
      busyDriversMap.set(s.driver_name.toLowerCase().trim(), s);
    }
  });

  const availableDrivers = FLEET_DRIVERS.filter((d) => !busyDriversMap.has(d.name.toLowerCase().trim()));

  // Dynamic statistics calculated directly from live shipments list
  const activeCount = safeShipments.filter((s) => s.status !== 'DELIVERED').length;
  const atRiskCount = safeShipments.filter((s) => s.status === 'WARNING' || s.status === 'CRITICAL').length;
  const deliveredCount = safeShipments.filter((s) => s.status === 'DELIVERED').length;
  const totalProtectedVal = safeShipments.reduce((acc, s) => acc + (Number(s.shipment_value) || 0), 0);
  const complianceRate = activeCount > 0 ? (((activeCount - atRiskCount) / activeCount) * 100).toFixed(1) : '100.0';

  // Dynamic sparklines computed from actual shipments data
  const tempHistoryData = safeShipments.length >= 2
    ? safeShipments.map((s) => Number(s.current_temp ?? (s.min_temp != null && s.max_temp != null ? (s.min_temp + s.max_temp) / 2 : 4.0)))
    : [3.8, 4.2, 4.0, 3.9, 4.1];
  
  const complianceHistoryData = safeShipments.length >= 2
    ? safeShipments.map((s) => (s.status === 'WARNING' || s.status === 'CRITICAL' ? 60 : 99))
    : [98, 99, 97, 99, 100];
  
  const riskHistoryData = safeShipments.length >= 2
    ? safeShipments.map((s) => (s.status === 'WARNING' || s.status === 'CRITICAL' ? 85 : 5))
    : [0, 0, 10, 5, atRiskCount > 0 ? 90 : 0];

  const valHistoryData = safeShipments.length >= 2
    ? safeShipments.map((s) => Math.max(10, Math.round((Number(s.shipment_value) || 100000) / 10000)))
    : [15, 20, 25, 20, 30];

  // Filtered shipments
  const filteredShipments = safeShipments.filter((s) => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const name = (s.product_name || s.cargo_type || '').toLowerCase();
    const track = (s.tracking_number || '').toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || track.includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Prepare map markers for main view
  const mapMarkers: any[] = [];

  if (selectedShipment) {
    const cargoTitle = selectedShipment.product_name || selectedShipment.cargo_type || 'Cold Cargo';
    const minT = selectedShipment.min_temp ?? selectedShipment.required_temp_min;
    const maxT = selectedShipment.max_temp ?? selectedShipment.required_temp_max;
    const curT = selectedShipment.current_temp;

    // Origin
    if (selectedShipment.origin_lat && selectedShipment.origin_lng) {
      mapMarkers.push({
        lat: Number(selectedShipment.origin_lat),
        lng: Number(selectedShipment.origin_lng),
        title: `Origin: ${selectedShipment.origin_name}`,
        description: `Dispatch Hub | Required: ${minT}°C to ${maxT}°C`,
        type: 'origin',
      });
    }

    // In-transit truck location
    const truckLat = Number(selectedShipment.current_lat || selectedShipment.origin_lat);
    const truckLng = Number(selectedShipment.current_lng || selectedShipment.origin_lng);
    if (truckLat && truckLng) {
      mapMarkers.push({
        lat: truckLat,
        lng: truckLng,
        title: `Truck Location (${selectedShipment.tracking_number || '#' + selectedShipment.id})`,
        description: `Payload: ${cargoTitle} | Current Temp: ${curT != null ? curT + '°C' : 'Stable'} | Status: ${selectedShipment.status}`,
        type: 'truck',
      });
    }

    // Destination
    if (selectedShipment.destination_lat && selectedShipment.destination_lng) {
      mapMarkers.push({
        lat: Number(selectedShipment.destination_lat),
        lng: Number(selectedShipment.destination_lng),
        title: `Destination: ${selectedShipment.destination_name}`,
        description: `Receiving Facility | ${selectedShipment.status}`,
        type: 'destination',
      });
    }
  }

  // Emergency storage facilities on map
  facilities.forEach((f) => {
    if (f.latitude && f.longitude) {
      mapMarkers.push({
        lat: Number(f.latitude),
        lng: Number(f.longitude),
        title: `Storage Facility: ${f.name}`,
        description: `Available Capacity: ${f.available_capacity ?? f.capacity} units | Status: ${f.status || 'OPERATIONAL'}`,
        type: 'facility',
      });
    }
  });

  // Modal map markers for location pin preview
  const modalMarkers: any[] = [
    {
      lat: newShipment.origin_lat,
      lng: newShipment.origin_lng,
      title: `Origin: ${newShipment.origin_name}`,
      description: 'Dispatch Point',
      type: 'origin',
    },
    {
      lat: newShipment.destination_lat,
      lng: newShipment.destination_lng,
      title: `Delivery Pin: ${newShipment.destination_name}`,
      description: 'Destination Hospital / Cold Room',
      type: 'destination',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in font-semibold text-xs border border-emerald-400/30">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-white/80 hover:text-white font-bold p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              ColdGuard Command Center
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time IoT cold-chain orchestration across healthcare distribution networks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadDashboardData()}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all shadow-xs flex items-center gap-2 hover:border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh Feed</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/25 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Dispatch Shipment</span>
          </button>
        </div>
      </div>

      {/* Dynamic Glassmorphic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Cargo */}
        <div className="bg-gradient-to-br from-white to-blue-50/40 p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Cargo</div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
              {safeShipments.length > 0 ? `${Math.round((activeCount / safeShipments.length) * 100)}% active` : '100% active'}
            </span>
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '...' : activeCount}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Active consignments</div>
            </div>
            <Sparkline color="#2563eb" data={tempHistoryData} />
          </div>
        </div>

        {/* Card 2: Temperature Health Rate */}
        <div className="bg-gradient-to-br from-white to-emerald-50/40 p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Temp Compliance</div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              {complianceRate}% compliant
            </span>
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="text-3xl font-black text-emerald-600 tracking-tight">
                {loading ? '...' : `${complianceRate}%`}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Optimal thermal band</div>
            </div>
            <Sparkline color="#10b981" data={complianceHistoryData} />
          </div>
        </div>

        {/* Card 3: At-Risk Alerts */}
        <div className="bg-gradient-to-br from-white to-amber-50/40 p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">At-Risk Alerts</div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              atRiskCount > 0 ? 'text-amber-800 bg-amber-100' : 'text-slate-600 bg-slate-100'
            }`}>
              {atRiskCount > 0 ? `▲ ${atRiskCount} critical` : 'Normal'}
            </span>
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className={`text-3xl font-black tracking-tight ${atRiskCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {loading ? '...' : atRiskCount}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Temperature deviations</div>
            </div>
            <Sparkline color="#f59e0b" data={riskHistoryData} />
          </div>
        </div>

        {/* Card 4: Protected Valuation */}
        <div className="bg-gradient-to-br from-white to-indigo-50/40 p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Protected Value</div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
              {safeShipments.length} consignments
            </span>
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tight truncate max-w-[140px]">
                {loading ? '...' : `₹${(totalProtectedVal / 100000).toFixed(1)}L`}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Insured medical cargo</div>
            </div>
            <Sparkline color="#6366f1" data={valHistoryData} />
          </div>
        </div>
      </div>

      {/* Driver Fleet Live Roster (Streamlined & Expandable) */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-4 shadow-xs">
        <div
          onClick={() => setShowDriverRoster(!showDriverRoster)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-slate-900">Certified Driver Fleet Availability</span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/60">
              {availableDrivers.length} of {FLEET_DRIVERS.length} Free
            </span>
          </div>
          <button className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1">
            <span>{showDriverRoster ? 'Hide Roster' : 'View Roster'}</span>
            {showDriverRoster ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showDriverRoster && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
            {FLEET_DRIVERS.map((d) => {
              const activeMission = busyDriversMap.get(d.name.toLowerCase().trim());
              const isBusy = !!activeMission;

              return (
                <div
                  key={d.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                    isBusy
                      ? 'bg-amber-50/50 border-amber-200/70 text-amber-950'
                      : 'bg-emerald-50/40 border-emerald-200/70 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0 ${d.avatarColor || 'bg-slate-700'}`}>
                      {d.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{d.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">{d.vehicle}</div>
                      {isBusy && (
                        <div className="text-[9px] font-bold text-amber-700 truncate">
                          Active: {activeMission.tracking_number || `#CG-${activeMission.id}`}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 ${
                      isBusy ? 'bg-amber-200/80 text-amber-900' : 'bg-emerald-200/80 text-emerald-900'
                    }`}
                  >
                    {isBusy ? 'On Delivery' : 'Available'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Split Layout: Left = Shipments Feed, Right = GPS Map & OSRM Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Active Shipment Feed */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">Active Shipment Feed</h2>
                <p className="text-[11px] text-slate-400 font-medium">Select a payload to trace real-time route</p>
              </div>
              <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/50">
                {filteredShipments.length} Available
              </span>
            </div>

            {/* Filter Tabs & Search */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search cargo, hospital, or tracking..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-200 text-xs font-medium bg-slate-50/60 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
                {(['ALL', 'IN_TRANSIT', 'WARNING', 'DELIVERED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                      statusFilter === filter
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {filter === 'ALL'
                      ? 'All'
                      : filter === 'IN_TRANSIT'
                      ? 'In Transit'
                      : filter === 'WARNING'
                      ? 'At Risk'
                      : 'Delivered'}
                  </button>
                ))}
              </div>
            </div>

            {/* Shipments Cards List */}
            <div className="space-y-3 max-h-[660px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span>Loading real-time shipments...</span>
                </div>
              ) : filteredShipments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  No shipments found. Click <b>&quot;+ Dispatch Shipment&quot;</b> to schedule new medical consignments.
                </div>
              ) : (
                filteredShipments.map((s) => {
                  const isSelected = selectedShipment?.id === s.id;
                  const cargo = s.product_name || s.cargo_type || 'Consignment';
                  const minT = Number(s.min_temp ?? s.required_temp_min ?? 2.0);
                  const maxT = Number(s.max_temp ?? s.required_temp_max ?? 8.0);
                  const curT = s.current_temp;

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectShipment(s)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      {/* Top Row: Cargo Title & Status Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{cargo}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                s.status === 'DELIVERED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.status === 'WARNING' || s.status === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-800 animate-pulse'
                                  : s.status === 'IN_TRANSIT'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status === 'IN_TRANSIT' ? 'In Transit' : s.status}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {s.tracking_number || `#CG-${s.id}`}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(s);
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 text-slate-700 shadow-xs shrink-0 flex items-center gap-1 transition-all"
                        >
                          <Zap className="w-3 h-3 text-purple-600" />
                          <span>Inspect</span>
                        </button>
                      </div>

                      {/* Visual Temperature Tolerance Bar */}
                      <div className="mt-2.5">
                        <TemperatureToleranceBar minTemp={minT} maxTemp={maxT} currentTemp={curT} />
                      </div>

                      {/* Route & Driver Details */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600 space-y-2">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{s.origin_name}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                          <span className="truncate font-semibold text-slate-900">{s.destination_name}</span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[9px]">
                              {s.driver_name ? s.driver_name[0] : 'D'}
                            </div>
                            <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                              {s.driver_name || 'Unassigned'}
                            </span>
                          </div>

                          {s.status === 'CREATED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartTransit(s.id);
                              }}
                              className="px-3 py-1 rounded-xl text-[10px] font-black bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-all flex items-center gap-1"
                            >
                              <span>🚀 Start Transit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: GPS Route Map & Real-Time Telemetry HUD */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            
            {/* Map Header with OSRM Metrics */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    {selectedShipment ? `GPS Route: ${selectedShipment.product_name || selectedShipment.cargo_type}` : 'Real-time GPS Route Map'}
                  </h2>
                  {selectedShipment && (
                    <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                      {selectedShipment.tracking_number || `#CG-${selectedShipment.id}`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  High-precision routing calculated via OpenStreetMap OSRM driving engine
                </p>
              </div>

              {/* OSRM Route Info Chips */}
              <div className="flex items-center gap-2">
                {routeLoading ? (
                  <span className="text-[11px] font-bold text-blue-600 animate-pulse flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Calculating OSRM Route...
                  </span>
                ) : routeMeta?.distanceKm ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-2xl text-[11px] font-bold text-slate-700 shadow-xs">
                    <span className="flex items-center gap-1">🛣️ {routeMeta.distanceKm} km</span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1">⏱️ {routeMeta.durationMin} mins</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Select a shipment to trace route</span>
                )}
              </div>
            </div>

            {/* The Map Frame with Floating Telemetry HUD Badges */}
            <div className="rounded-3xl overflow-hidden border border-slate-200/80 h-[560px] relative shadow-inner">
              <LeafletMap
                markers={mapMarkers}
                routeCoordinates={routeCoordinates}
                routeColor={selectedShipment?.status === 'WARNING' || selectedShipment?.status === 'CRITICAL' ? '#DC2626' : '#2563EB'}
              />

              {/* FLOATING HUD BADGE 1: Current Temp & Health (Top Left) */}
              {selectedShipment && (
                <div className="absolute top-4 left-4 z-[400] glass-pill px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Current Temp</div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        selectedShipment.current_temp != null &&
                        (selectedShipment.current_temp < (selectedShipment.min_temp ?? 2) || selectedShipment.current_temp > (selectedShipment.max_temp ?? 8))
                          ? 'bg-rose-500 animate-ping'
                          : 'bg-emerald-500'
                      }`} />
                      {selectedShipment.current_temp != null ? `${selectedShipment.current_temp}°C` : '--'}
                    </div>
                  </div>
                </div>
              )}

              {/* FLOATING HUD BADGE 2: ETA & Distance (Top Right) */}
              {routeMeta?.distanceKm && (
                <div className="absolute top-4 right-4 z-[400] glass-pill px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">ETA Estimate</div>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {routeMeta.durationMin} mins ({routeMeta.distanceKm} km)
                    </div>
                  </div>
                </div>
              )}

              {/* FLOATING HUD BADGE 3: OSRM Road Telemetry (Bottom Right) */}
              <div className="absolute bottom-4 right-4 z-[400] glass-pill px-3.5 py-1.5 rounded-xl shadow-md text-[10px] font-black text-slate-700 flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span>OSRM road telemetry</span>
              </div>

              {/* FLOATING HUD BADGE 4: Interactive Legend (Bottom Left) */}
              <div className="absolute bottom-4 left-4 z-[400] glass-pill px-3 py-2 rounded-2xl shadow-md text-[10px] font-bold text-slate-700 flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600" /> Origin</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600" /> Truck</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Destination</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-600" /> Cold Vault</span>
              </div>
            </div>

            {/* Quick Actions Bar for Selected Shipment */}
            {selectedShipment && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-blue-50/40 p-3.5 rounded-2xl border border-slate-200/70">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-black text-slate-800">Payload Controls:</span>
                  <span className="text-[11px] text-slate-500">
                    Status: <b className="text-slate-900 uppercase font-mono">{selectedShipment.status}</b>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedShipment.status !== 'IN_TRANSIT' && selectedShipment.status !== 'DELIVERED' && (
                    <button
                      onClick={() => handleStartTransit(selectedShipment.id)}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xs"
                    >
                      Start Transit
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenDetail(selectedShipment)}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/20 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Deep AI Inspection</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* MODAL: Gemini AI Failure Diagnosis & Telemetry Inspection */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-purple-50/30">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black tracking-wider text-blue-600 uppercase font-mono">
                  {selectedShipment.tracking_number || `#CG-${selectedShipment.id}`}
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {selectedShipment.product_name || selectedShipment.cargo_type}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedShipment.origin_name} &rarr; {selectedShipment.destination_name}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Telemetry Overview Cards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Current Temp</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {selectedShipment.current_temp != null ? `${selectedShipment.current_temp}°C` : '--'}
                  </div>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Required Range</div>
                  <div className="text-sm font-bold text-slate-800 mt-1.5 font-mono">
                    {(selectedShipment.min_temp ?? selectedShipment.required_temp_min)}°C - {(selectedShipment.max_temp ?? selectedShipment.required_temp_max)}°C
                  </div>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Battery Level</div>
                  <div className="text-xl font-black text-emerald-600 mt-1">
                    {selectedShipment.current_battery != null ? `${selectedShipment.current_battery}%` : '--'}
                  </div>
                </div>
              </div>

              {/* Gemini AI Failure Diagnosis Card (Modeled after design mockup) */}
              <div className="bg-gradient-to-br from-white to-purple-50/60 rounded-3xl border border-purple-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/30">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Gemini AI Failure Diagnosis</h3>
                      <p className="text-[11px] text-slate-400">Autonomous predictive cold-chain copilot</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRunAiAnalysis(selectedShipment.id)}
                    disabled={aiLoading}
                    className="px-4 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{aiLoading ? 'Analyzing...' : 'Run Diagnosis'}</span>
                  </button>
                </div>

                {/* Pulsing AI Badge Orb */}
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full ai-glow-orb absolute animate-pulse-slow" />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-purple-500/30">
                      AI
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mt-2">
                    Neural Thermal Model Active
                  </span>
                </div>

                {/* Risk Severity Meter - Dynamically calculated from API */}
                {aiAnalysis ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Risk severity</span>
                      <span className="text-[11px] font-extrabold text-purple-700 uppercase">
                        {aiAnalysis.deterministic_risk?.severity || aiAnalysis.risk_level || (selectedShipment.status === 'WARNING' || selectedShipment.status === 'CRITICAL' ? 'High Risk' : 'Low Risk')}
                        {aiAnalysis.deterministic_risk?.risk_score != null && ` (${aiAnalysis.deterministic_risk.risk_score}%)`}
                      </span>
                    </div>
                    {/* Visual Severity Indicator Bar with dynamic marker */}
                    <div className="relative h-2.5 rounded-full bg-slate-200 overflow-visible flex">
                      <div className="flex-1 bg-rose-500 rounded-l-full" />
                      <div className="flex-1 bg-amber-400" />
                      <div className="flex-1 bg-emerald-500 rounded-r-full" />
                      {/* Active Severity Needle Marker */}
                      {(() => {
                        const sev = (aiAnalysis.deterministic_risk?.severity || aiAnalysis.risk_level || selectedShipment.status || '').toUpperCase();
                        const isHigh = sev.includes('CRITICAL') || sev.includes('HIGH');
                        const isMed = sev.includes('WARNING') || sev.includes('MEDIUM') || sev.includes('MODERATE');
                        const markerPct = isHigh ? 16 : isMed ? 50 : 84;
                        return (
                          <div
                            className="absolute -top-1 w-4 -ml-2 h-4 rounded-full border-2 border-white shadow-md bg-purple-700 transition-all z-10"
                            style={{ left: `${markerPct}%` }}
                          />
                        );
                      })()}
                    </div>
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                      <span className="text-rose-600">High Risk</span>
                      <span className="text-amber-600">Medium Risk</span>
                      <span className="text-emerald-600">Low Risk</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs text-slate-400 font-medium bg-slate-50/70 p-3 rounded-2xl border border-dashed border-slate-200">
                    Click &quot;Run Diagnosis&quot; to fetch real-time AI risk severity and operational recommendations from the API.
                  </div>
                )}

                {/* AI Recommendations List - 100% Dynamic from API response */}
                {aiAnalysis && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                      AI Actionable Recommendations
                    </span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {/* 1. Recommended Action */}
                      {(aiAnalysis.ai_interpretation?.recommended_action || aiAnalysis.recommendation) && (
                        <div className="p-3.5 rounded-2xl bg-white border border-purple-200/80 shadow-xs flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-700 block">Recommended Action</span>
                            <span className="text-xs font-semibold text-slate-800 leading-relaxed block">
                              {aiAnalysis.ai_interpretation?.recommended_action || aiAnalysis.recommendation}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 2. Urgency Level */}
                      {aiAnalysis.ai_interpretation?.urgency && (
                        <div className="p-3.5 rounded-2xl bg-white border border-amber-200/80 shadow-xs flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700 block">Urgency Timeline</span>
                            <span className="text-xs font-semibold text-slate-800 leading-relaxed block">
                              {aiAnalysis.ai_interpretation.urgency}
                              {aiAnalysis.deterministic_risk?.predicted_failure_minutes != null && (
                                <span className="ml-1 text-rose-600 font-bold">
                                  (Est. failure in {aiAnalysis.deterministic_risk.predicted_failure_minutes} mins)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 3. Risk Explanation */}
                      {(aiAnalysis.ai_interpretation?.risk_explanation || aiAnalysis.analysis) && (
                        <div className="p-3.5 rounded-2xl bg-white border border-blue-200/80 shadow-xs flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Info className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-700 block">Root Cause / Thermal Analysis</span>
                            <span className="text-xs font-semibold text-slate-800 leading-relaxed block">
                              {aiAnalysis.ai_interpretation?.risk_explanation || aiAnalysis.analysis}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 4. Confidence Note */}
                      {aiAnalysis.ai_interpretation?.confidence_note && (
                        <div className="text-[10px] text-slate-400 font-mono text-center pt-1">
                          {aiAnalysis.ai_interpretation.confidence_note}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* OSRM Routing Info Card */}
              {routeMeta && (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-900 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Navigation className="w-5 h-5 text-blue-600" />
                    <div>
                      <span className="text-xs font-black text-blue-950 block">OSRM Road Calculation</span>
                      <span className="text-[11px] text-blue-700">Calculated driving trajectory</span>
                    </div>
                  </div>
                  <div className="text-xs font-bold font-mono text-blue-900 text-right">
                    <span>{routeMeta.distanceKm} km</span>
                    <span className="mx-1 text-blue-300">•</span>
                    <span>~{routeMeta.durationMin} mins</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dispatch New Shipment with Interactive Location Pinning Map */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30">
              <div>
                <h2 className="text-lg font-black text-slate-900">Dispatch New Cold-Chain Shipment</h2>
                <p className="text-xs text-slate-500">Configure consignment parameters and pin destination on the map</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Form & Map Grid */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Side: Parameters Form */}
                <div className="md:col-span-6 space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Product / Vaccine Cargo</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hepatitis B Vaccine Vials"
                      value={newShipment.product_name}
                      onChange={(e) => setNewShipment({ ...newShipment, product_name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Quantity (Doses)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={newShipment.quantity}
                        onChange={(e) => setNewShipment({ ...newShipment, quantity: Number(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Payload Value (₹)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={newShipment.shipment_value}
                        onChange={(e) => setNewShipment({ ...newShipment, shipment_value: Number(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Min Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newShipment.min_temp}
                        onChange={(e) => setNewShipment({ ...newShipment, min_temp: parseFloat(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Max Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newShipment.max_temp}
                        onChange={(e) => setNewShipment({ ...newShipment, max_temp: parseFloat(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                      />
                    </div>
                  </div>

                  {/* Origin Dispatch Facility */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" /> Dispatch Origin Hub
                      </label>
                      <span className="text-[9px] font-mono text-slate-400">
                        {newShipment.origin_lat}, {newShipment.origin_lng}
                      </span>
                    </div>
                    {facilities.length > 0 ? (
                      <select
                        value={newShipment.origin_name}
                        onChange={(e) => {
                          const fac = facilities.find((f) => f.name === e.target.value);
                          if (fac) {
                            setNewShipment((prev) => {
                              const updated = {
                                ...prev,
                                origin_name: fac.name,
                                origin_lat: Number(fac.latitude),
                                origin_lng: Number(fac.longitude),
                              };
                              updateModalRoutePreview(Number(fac.latitude), Number(fac.longitude), prev.destination_lat, prev.destination_lng);
                              return updated;
                            });
                          } else {
                            setNewShipment({ ...newShipment, origin_name: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                      >
                        {facilities.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name} ({f.latitude}, {f.longitude})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={newShipment.origin_name}
                        onChange={(e) => setNewShipment({ ...newShipment, origin_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                      />
                    )}
                  </div>

                  {/* Destination Details */}
                  <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" /> Delivery Destination (Pinned)
                      </label>
                      <span className="text-[9px] font-mono text-emerald-700">
                        {newShipment.destination_lat}, {newShipment.destination_lng}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Click on map to pin destination..."
                      value={newShipment.destination_name}
                      onChange={(e) => setNewShipment({ ...newShipment, destination_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 text-xs font-semibold bg-white text-emerald-950"
                    />
                    {geocoding && (
                      <span className="text-[10px] text-emerald-600 font-medium animate-pulse block">
                        Resolving address via OpenStreetMap Nominatim...
                      </span>
                    )}
                  </div>

                  {/* Smart Fleet Driver Assignment */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" /> Assign Fleet Driver
                      </label>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          availableDrivers.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {availableDrivers.length > 0 ? `${availableDrivers.length} Free / Available` : 'All Drivers En Route'}
                      </span>
                    </div>

                    {availableDrivers.length > 0 ? (
                      <select
                        required
                        value={newShipment.driver_name}
                        onChange={(e) => {
                          const driver = FLEET_DRIVERS.find((d) => d.name === e.target.value);
                          if (driver) {
                            setNewShipment({
                              ...newShipment,
                              driver_name: driver.name,
                              driver_phone: driver.phone,
                            });
                          } else {
                            setNewShipment({
                              ...newShipment,
                              driver_name: '',
                              driver_phone: '',
                            });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-900"
                      >
                        <option value="">-- Choose Available Driver --</option>
                        {availableDrivers.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.name} • {d.vehicle}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        All registered drivers are currently on active deliveries. Completing an ongoing delivery will free them up.
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>Assigned Contact: <b className="font-mono text-slate-800">{newShipment.driver_phone || '--'}</b></span>
                      <span>Verified Cold-Chain Operator</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Interactive Location Pinning Map */}
                <div className="md:col-span-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">Pin Delivery Destination</span>
                      <p className="text-[10px] text-slate-400">Search location / PIN code or click map to drop pin</p>
                    </div>
                    <span className="px-3 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>Click Map to Set</span>
                    </span>
                  </div>

                  {/* Location & PIN Code Forward Search Input */}
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus-within:border-blue-500 focus-within:bg-white transition-all shadow-inner">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Search town, hospital, or 6-digit PIN code (e.g. 403001, Panaji, Margao)..."
                        value={geoSearchQuery}
                        onChange={(e) => handleForwardGeocode(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400 font-medium text-xs"
                      />
                      {geoSearching && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
                      {geoSearchQuery && (
                        <button
                          type="button"
                          onClick={() => { setGeoSearchQuery(''); setGeoResults([]); }}
                          className="text-slate-400 hover:text-slate-600 font-bold text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Geocoding Dropdown Suggestions */}
                    {geoResults.length > 0 && (
                      <div className="absolute z-[500] left-0 right-0 top-full mt-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {geoResults.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectGeoLocation(r)}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 transition-colors flex items-center justify-between gap-2 group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-bold text-slate-800 truncate">{r.display_name.split(',')[0]}</span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{r.display_name}</span>
                            </div>
                            <span className="text-[9px] font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                              Select Pin
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interactive Picker Map */}
                  <div className="rounded-3xl overflow-hidden border border-slate-200 h-[360px] relative shadow-inner cursor-crosshair">
                    <LeafletMap
                      markers={modalMarkers}
                      routeCoordinates={modalRouteCoords}
                      onMapClick={handleModalMapClick}
                      className="w-full h-full min-h-[360px] rounded-3xl cursor-crosshair"
                    />

                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm z-[400] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Drop Pin for Destination</span>
                    </div>
                  </div>

                  {/* Route Estimation Chip */}
                  {modalRouteMeta && (
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between text-xs font-semibold text-blue-900">
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-blue-600" />
                        <span>Estimated Route via OSRM:</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold font-mono">
                        <span>{modalRouteMeta.distanceKm} km</span>
                        <span>•</span>
                        <span>~{modalRouteMeta.durationMin} mins</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Form Footer Action */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
                >
                  Confirm & Dispatch Shipment
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
