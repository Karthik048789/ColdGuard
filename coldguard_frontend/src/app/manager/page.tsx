'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiFetch } from '@/lib/api';
import { Shipment, Facility, Alert } from '@/lib/types';

// Dynamic import for Leaflet map with SSR disabled
const LeafletMap = dynamic(() => import('@/components/maps/LeafletMap'), { ssr: false });

interface FleetDriver {
  id: number;
  name: string;
  phone: string;
  vehicle: string;
  email?: string;
}

const FLEET_DRIVERS: FleetDriver[] = [
  { id: 1, name: 'Rajesh Kumar', phone: '+91 98765 43211', vehicle: 'Reefer Truck GA-07-C-4021 (Goa Reefer Truck)', email: 'driver@coldguard.ai' },
  { id: 2, name: 'Suresh Nair', phone: '+91 98470 12345', vehicle: 'Reefer Van GA-08-D-8910 (Goa Reefer Van)' },
  { id: 3, name: 'Manoj Varma', phone: '+91 98950 67890', vehicle: 'Deep Freeze Unit GA-03-A-1204 (Goa Deep Freeze Unit)' },
  { id: 4, name: 'Anil Joseph', phone: '+91 94471 23456', vehicle: 'Cryo Transporter GA-09-E-5567 (Goa Cryo Transporter)' },
];


export default function ManagerDashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'WARNING' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
    origin_lng: 73.8560,
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
      // 1. Attempt backend routing endpoint (/api/shipments/{id}/route)
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

  // Calculate route preview inside the create modal whenever coordinates change
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

  // Load shipments & facilities dynamically from backend
  const loadDashboardData = async (selectNewId?: number) => {
    try {
      setLoading(true);
      const [shipRes, facRes] = await Promise.all([
        apiFetch<any>('/shipments').catch(() => null),
        apiFetch<any>('/facilities').catch(() => null),
      ]);

      const ships = extractShipments(shipRes);
      setShipments(ships);

      if (Array.isArray(facRes?.data)) {
        setFacilities(facRes.data);
      } else if (Array.isArray(facRes)) {
        setFacilities(facRes);
      }

      // Auto-select target or first shipment
      if (ships.length > 0) {
        const target = selectNewId
          ? ships.find((s) => s.id === selectNewId) || ships[0]
          : ships.find((s) => s.status === 'IN_TRANSIT' || s.status === 'WARNING') || ships[0];
        setSelectedShipment(target);
        fetchOsrmRoute(target);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Live polling for selected active shipment telemetry & vehicle position
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

  // User clicks a shipment in the list
  const handleSelectShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    fetchOsrmRoute(shipment);
  };

  // Open detailed inspection modal
  const handleOpenDetail = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
    setAiAnalysis(null);
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

  // Action: Deliver
  const handleDeliver = async (id: number) => {
    try {
      await apiFetch<any>(`/shipments/${id}/deliver`, { method: 'POST' });
      await loadDashboardData(id);
      setSuccessBanner(`Shipment #${id} marked DELIVERED safely!`);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to mark delivered');
    }
  };

  // Action: Run Gemini AI Risk Assessment
  const handleRunAiAnalysis = async (id: number) => {
    setAiLoading(true);
    try {
      const res = await apiFetch<any>(`/shipments/${id}/analyze`, { method: 'POST' });
      if (res?.data) {
        setAiAnalysis(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'AI analysis unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  // Reverse geocoding via OpenStreetMap Nominatim when user pins a location
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      setGeocoding(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'User-Agent': 'ColdGuard/1.0' },
      }).then((r) => r.json());

      if (res?.display_name) {
        // Return concise name (first 3 parts)
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

  // Handle map click in the Dispatch Modal - sets Delivery Destination
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

  // Compute live driver availability based on active in-transit shipments
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

  // Also show emergency storage facilities on map
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
    <div className="space-y-6">
      
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-500 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in font-semibold text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-white/80 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cold-Chain Network Command Center</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Select a live shipment to track its road route via OSRM and real-time IoT sensors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadDashboardData()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 transition-all shadow-sm"
          >
            Refresh Feed
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
          >
            <span>+</span> Dispatch Shipment
          </button>
        </div>
      </div>

      {/* Dynamic KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Shipments</div>
          <div className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : activeCount}</div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">Live in transit or pending</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider">At-Risk Cargo</div>
          <div className="text-3xl font-black text-red-600 mt-2">{loading ? '...' : atRiskCount}</div>
          <div className="text-[10px] text-red-400 font-medium mt-1">Temperature spike incidents</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Delivered Safely</div>
          <div className="text-3xl font-black text-emerald-600 mt-2">{loading ? '...' : deliveredCount}</div>
          <div className="text-[10px] text-emerald-500 font-medium mt-1">Preserved integrity</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Protected Value</div>
          <div className="text-2xl font-black text-blue-600 mt-2 truncate">
            {loading ? '...' : `₹${totalProtectedVal.toLocaleString('en-IN')}`}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">Live payload valuation</div>
        </div>
      </div>

      {/* Fleet Drivers Live Availability Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">🚚 Certified Driver Fleet Roster</span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {availableDrivers.length} of {FLEET_DRIVERS.length} Free
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Drivers automatically become Free upon shipment delivery
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FLEET_DRIVERS.map((d) => {
            const activeMission = busyDriversMap.get(d.name.toLowerCase().trim());
            const isBusy = !!activeMission;

            return (
              <div
                key={d.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  isBusy
                    ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                    : 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isBusy ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                    <span className="text-xs font-bold text-slate-900">{d.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate">{d.vehicle}</div>
                  {isBusy && (
                    <div className="text-[9px] font-bold text-amber-700 truncate">
                      En Route: {activeMission.tracking_number || `#CG-${activeMission.id}`}
                    </div>
                  )}
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                  isBusy ? 'bg-amber-200/70 text-amber-900' : 'bg-emerald-200/70 text-emerald-900'
                }`}>
                  {isBusy ? 'On Delivery' : 'Available'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Left = Shipments Selector, Right = Live OSRM Road Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Shipment List & Selectors */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Active Shipments Directory</h2>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {filteredShipments.length} Available
              </span>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search tracking or cargo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-600"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50"
              >
                <option value="ALL">All</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="WARNING">At Risk</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>

            {/* Shipments Cards List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-12 text-slate-400 text-xs">Loading live shipments from backend...</div>
              ) : filteredShipments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No active shipments yet. Click "+ Dispatch Shipment" to create a new cold-chain consignment across Goa hospitals.</div>
              ) : (
                filteredShipments.map((s) => {
                  const isSelected = selectedShipment?.id === s.id;
                  const cargo = s.product_name || s.cargo_type || 'Consignment';
                  const minT = s.min_temp ?? s.required_temp_min;
                  const maxT = s.max_temp ?? s.required_temp_max;
                  const curT = s.current_temp;

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectShipment(s)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{cargo}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              s.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.status === 'WARNING' || s.status === 'CRITICAL'
                                ? 'bg-red-100 text-red-800'
                                : s.status === 'IN_TRANSIT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {s.tracking_number || `#CG-${s.id}`}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(s);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm shrink-0"
                        >
                          Inspect & AI
                        </button>
                      </div>

                      <div className="mt-2.5 text-[11px] text-slate-600 space-y-1.5">
                        <div className="truncate">
                          <span className="text-slate-400 font-medium">Route:</span> {s.origin_name} &rarr; {s.destination_name}
                        </div>

                        {/* Driver & Status Action Row */}
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span>👤</span>
                            <span className="font-semibold text-slate-800">{s.driver_name || 'Unassigned Driver'}</span>
                          </div>

                          {s.status === 'CREATED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartTransit(s.id);
                              }}
                              className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
                            >
                              🚀 Start Transit
                            </button>
                          )}
                          {s.status === 'IN_TRANSIT' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeliver(s.id);
                              }}
                              className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
                            >
                              ✓ Mark Delivered
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>
                            Required: <b className="text-slate-700 font-mono">{minT}°C to {maxT}°C</b>
                          </span>
                          <span>
                            Current: <b className="font-mono text-slate-900">{curT != null ? `${curT}°C` : '--'}</b>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live OSRM Road Map & Real-Time Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            
            {/* Map Header with OSRM Metrics */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    {selectedShipment ? `OSRM Road Route: ${selectedShipment.product_name || selectedShipment.cargo_type}` : 'Active Route Preview'}
                  </span>
                  {selectedShipment && (
                    <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                      {selectedShipment.tracking_number || `#CG-${selectedShipment.id}`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real road coordinates mapped via OpenStreetMap OSRM driving engine
                </p>
              </div>

              {/* OSRM Route Info Chips */}
              <div className="flex items-center gap-2">
                {routeLoading ? (
                  <span className="text-[11px] font-bold text-blue-600 animate-pulse">Calculating OSRM Road Route...</span>
                ) : routeMeta?.distanceKm ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-[11px] font-bold text-slate-700">
                    <span>🛣️ {routeMeta.distanceKm} km</span>
                    <span className="text-slate-300">|</span>
                    <span>⏱️ {routeMeta.durationMin} mins</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Select a shipment to trace road route</span>
                )}
              </div>
            </div>

            {/* The Leaflet Map */}
            <div className="rounded-xl overflow-hidden border border-slate-100 h-[520px] relative">
              <LeafletMap
                markers={mapMarkers}
                routeCoordinates={routeCoordinates}
                routeColor={selectedShipment?.status === 'WARNING' || selectedShipment?.status === 'CRITICAL' ? '#DC2626' : '#2563EB'}
              />

              {/* Map Floating Legend */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md px-3 py-2 rounded-xl text-[10px] font-semibold text-slate-700 flex items-center gap-3 z-[400]">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Origin</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Truck</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600"></span> Destination</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Storage Hub</span>
              </div>
            </div>

            {/* Quick Actions Bar for Selected Shipment */}
            {selectedShipment && (
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold text-slate-700">Payload Controls:</span>
                  <span className="text-[11px] text-slate-500">
                    Status: <b className="text-slate-900">{selectedShipment.status}</b>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedShipment.status !== 'IN_TRANSIT' && selectedShipment.status !== 'DELIVERED' && (
                    <button
                      onClick={() => handleStartTransit(selectedShipment.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
                    >
                      Start Transit
                    </button>
                  )}
                  {selectedShipment.status !== 'DELIVERED' && (
                    <button
                      onClick={() => handleDeliver(selectedShipment.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm"
                    >
                      Mark Delivered
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenDetail(selectedShipment)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm"
                  >
                    ⚡ Deep AI Inspection
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* MODAL: Detailed Shipment Inspector & AI Diagnosis */}
      {showDetailModal && selectedShipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-blue-600 uppercase">
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
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Telemetry Overview */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-center">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Current Temp</div>
                  <div className="text-xl font-black text-slate-900 mt-0.5">
                    {selectedShipment.current_temp != null ? `${selectedShipment.current_temp}°C` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Required Range</div>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {(selectedShipment.min_temp ?? selectedShipment.required_temp_min)}°C - {(selectedShipment.max_temp ?? selectedShipment.required_temp_max)}°C
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Battery Level</div>
                  <div className="text-xl font-black text-emerald-600 mt-0.5">
                    {selectedShipment.current_battery != null ? `${selectedShipment.current_battery}%` : '--'}
                  </div>
                </div>
              </div>

              {/* Gemini AI Risk Analysis */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Predictive Cold-Chain AI</h3>
                  <button
                    onClick={() => handleRunAiAnalysis(selectedShipment.id)}
                    disabled={aiLoading}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? 'Analyzing...' : '⚡ Run Gemini Failure Diagnosis'}
                  </button>
                </div>

                {aiAnalysis && (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Gemini Recommendation</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-800">
                        Risk: {aiAnalysis.risk_level || 'LOW'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-purple-950">
                      {aiAnalysis.recommendation || aiAnalysis.analysis || JSON.stringify(aiAnalysis)}
                    </p>
                  </div>
                )}
              </div>

              {/* Routing Info */}
              {routeMeta && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700">OSRM Road Calculation</span>
                  <p className="text-xs font-medium">
                    Calculated distance: <b>{routeMeta.distanceKm} km</b> | Estimated transit duration: <b>{routeMeta.durationMin} minutes</b>
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dispatch New Shipment with Interactive Location Pinning Map */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h2 className="text-lg font-black text-slate-900">Dispatch New Cold-Chain Shipment</h2>
                <p className="text-xs text-slate-500">Click on the map to pin the exact delivery destination</p>
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
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600"
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
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600"
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
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600"
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
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Max Temp (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newShipment.max_temp}
                        onChange={(e) => setNewShipment({ ...newShipment, max_temp: parseFloat(e.target.value) })}
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Origin Dispatch Facility (Select from facilities or default) */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span> Dispatch Origin Hub
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white"
                      />
                    )}
                  </div>

                  {/* Destination Details */}
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Delivery Destination (Pinned)
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
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 text-xs font-semibold bg-white text-emerald-950"
                    />
                    {geocoding && (
                      <span className="text-[10px] text-emerald-600 font-medium animate-pulse block">
                        Resolving address via OpenStreetMap Nominatim...
                      </span>
                    )}
                  </div>

                  {/* Smart Fleet Driver Assignment */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                        <span>👤</span> Assign Fleet Driver
                      </label>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        availableDrivers.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-900"
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
                      <p className="text-[10px] text-slate-400">Click anywhere on the map to drop the delivery location pin</p>
                    </div>
                    <span className="px-3 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      📍 Click Map to Set Delivery
                    </span>
                  </div>

                  {/* Interactive Picker Map */}
                  <div className="rounded-2xl overflow-hidden border border-slate-200 h-[340px] relative shadow-inner cursor-crosshair">
                    <LeafletMap
                      markers={modalMarkers}
                      routeCoordinates={modalRouteCoords}
                      onMapClick={handleModalMapClick}
                      className="w-full h-full min-h-[340px] rounded-2xl cursor-crosshair"
                    />

                    <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm z-[400] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Drop Pin for Delivery Location</span>
                    </div>
                  </div>

                  {/* Route Estimation Chip */}
                  {modalRouteMeta && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs font-semibold text-blue-900">
                      <div className="flex items-center gap-1.5">
                        <span>🛣️</span>
                        <span>Estimated Route via OSRM:</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold font-mono">
                        <span>{modalRouteMeta.distanceKm} km</span>
                        <span>•</span>
                        <span>~{modalRouteMeta.durationMin} mins drive</span>
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
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
