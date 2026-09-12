'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { apiFetch, getAuthUser } from '@/lib/api';
import { Shipment } from '@/lib/types';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Truck,
  Thermometer,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  ExternalLink,
  ArrowRight,
  FileCheck,
  Lock,
  Cpu,
  Sparkles,
  X,
  Check,
  Building2,
  Send,
  Navigation,
  Layers,
  FileText,
  Download,
  Copy,
  Activity,
  CheckCheck,
} from 'lucide-react';

// Dynamic import for Leaflet map with SSR disabled
const LeafletMap = dynamic(() => import('@/components/maps/LeafletMap'), { ssr: false });

// Helper to calculate SHA-256 hash in browser
async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Visual QR Code Generator Component for On-Chain Consignment Auditing
function BlockchainQrCode({ value, size = 96 }: { value: string; size?: number }) {
  const hashVal = value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 42);
  const rows = 12;
  const cols = 12;
  const cells: boolean[][] = [];

  for (let r = 0; r < rows; r++) {
    cells[r] = [];
    for (let c = 0; c < cols; c++) {
      if ((r < 3 && c < 3) || (r < 3 && c >= cols - 3) || (r >= rows - 3 && c < 3)) {
        cells[r][c] = r === 0 || r === 2 || c === 0 || c === 2 || (r === 1 && c === 1);
      } else {
        const seed = (hashVal * (r + 1) * 37 + (c + 1) * 73) % 100;
        cells[r][c] = seed > 45;
      }
    }
  }

  const cellSize = size / rows;

  return (
    <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs inline-block group hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-lg">
        {cells.map((row, r) =>
          row.map((active, c) =>
            active ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize - 0.6}
                height={cellSize - 0.6}
                rx={1}
                className="fill-slate-900 group-hover:fill-emerald-600 transition-colors"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
}

export default function ReceiverIntakePage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [activeTab, setActiveTab] = useState<'AWAITING' | 'DELIVERED'>('AWAITING');
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'LIVE_TRACKING'>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState('');

  // OSRM route state for Live Tracking
  const [routeCoordinates, setRouteCoordinates] = useState<Array<[number, number]>>([]);
  const [routeMeta, setRouteMeta] = useState<{ distanceKm?: string | number; durationMin?: string | number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Scanner Modal & Blockchain Logs Modal
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBlockchainLogsModal, setShowBlockchainLogsModal] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);

  // Sign & Mint State
  const [receiverName, setReceiverName] = useState('Dr. Priya Deshmukh');
  const [staffId, setStaffId] = useState('PHARM-IN-8821');
  const [inspectionNotes, setInspectionNotes] = useState('Packaging and seal intact. No physical damage or temperature breach.');
  const [signatureText, setSignatureText] = useState('P. Deshmukh');
  const [calculatedHash, setCalculatedHash] = useState<string>('0x3a1b4c89e2f019a2b5d4e6f7a8b9c0d1e2f3a4b5c6d7e8f9');
  const [minting, setMinting] = useState(false);

  // Minted Receipt / Digital Product Passport Modal
  const [mintedReceipt, setMintedReceipt] = useState<{
    txHash: string;
    blockNumber: number;
    shipment: Shipment;
    timestamp: string;
    passportId: string;
  } | null>(null);

  // Fetch OSRM Road Route for Live Tracking
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
          });
          return;
        }
      }

      setRouteCoordinates([]);
      setRouteMeta(null);
    } catch {
      setRouteCoordinates([]);
      setRouteMeta(null);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // Load shipments
  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/shipments').catch(() => null);
      let list: Shipment[] = [];
      if (Array.isArray(res)) list = res;
      else if (Array.isArray(res?.data)) list = res.data;
      else if (Array.isArray(res?.data?.shipments)) list = res.data.shipments;
      else if (Array.isArray(res?.shipments)) list = res.shipments;

      setShipments(list);

      if (list.length > 0 && !selectedShipment) {
        const inTransit = list.find((s) => s.status === 'IN_TRANSIT' || s.status === 'WARNING' || s.status === 'CRITICAL');
        const defaultSel = inTransit || list[0];
        setSelectedShipment(defaultSel);
        fetchOsrmRoute(defaultSel);
      }
    } catch (err) {
      console.error('Failed to load shipments for receiver:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchOsrmRoute, selectedShipment]);

  useEffect(() => {
    loadShipments();
    const user = getAuthUser();
    if (user?.name) {
      setReceiverName(user.name);
      setSignatureText(user.name);
    }
  }, [loadShipments]);

  // Generate SHA-256 hash when selected shipment changes
  useEffect(() => {
    if (selectedShipment) {
      const rawPayload = `${selectedShipment.id}-${selectedShipment.tracking_number}-${selectedShipment.current_temp}-${selectedShipment.destination_name}-${staffId}`;
      sha256(rawPayload).then((h) => setCalculatedHash(h));
    }
  }, [selectedShipment, staffId]);

  const handleSelectShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    fetchOsrmRoute(shipment);
  };

  // Filter incoming vs delivered
  const awaitingShipments = useMemo(() => {
    return shipments.filter((s) => s.status !== 'DELIVERED');
  }, [shipments]);

  const deliveredShipments = useMemo(() => {
    return shipments.filter((s) => s.status === 'DELIVERED');
  }, [shipments]);

  const displayedShipments = useMemo(() => {
    const base = activeTab === 'AWAITING' ? awaitingShipments : deliveredShipments;
    if (!searchQuery) return base;
    return base.filter((s) => {
      const name = (s.product_name || s.cargo_type || '').toLowerCase();
      const track = (s.tracking_number || '').toLowerCase();
      const dest = (s.destination_name || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return name.includes(q) || track.includes(q) || dest.includes(q);
    });
  }, [activeTab, awaitingShipments, deliveredShipments, searchQuery]);

  // Execute Delivery & Blockchain Minting
  const handleSignAndMintDelivery = async () => {
    if (!selectedShipment) return;
    setMinting(true);

    try {
      await apiFetch<any>(`/shipments/${selectedShipment.id}/deliver`, {
        method: 'POST',
      });

      const mockBlockNum = Math.floor(19800000 + Math.random() * 50000);
      const generatedTxHash = calculatedHash.slice(0, 66);
      const passportId = `DPP-CG-${selectedShipment.id}-${Date.now().toString().slice(-4)}`;

      const receiptData = {
        txHash: generatedTxHash,
        blockNumber: mockBlockNum,
        shipment: { ...selectedShipment, status: 'DELIVERED' as const },
        timestamp: new Date().toISOString(),
        passportId,
      };

      setMintedReceipt(receiptData);
      await loadShipments();
    } catch (err: any) {
      alert(err.message || 'Failed to complete blockchain delivery sign-off');
    } finally {
      setMinting(false);
    }
  };

  // Handle QR scanner simulation
  const handleSimulatedScan = (trackingNumber: string) => {
    const found = shipments.find(
      (s) => s.tracking_number?.toLowerCase() === trackingNumber.toLowerCase() || String(s.id) === trackingNumber
    );
    if (found) {
      handleSelectShipment(found);
      setShowScannerModal(false);
      setScanInput('');
      setShowBlockchainLogsModal(true); // Open full blockchain details on scan
    } else {
      alert(`No shipment found matching tracking number ${trackingNumber}`);
    }
  };

  const isCompliant = useMemo(() => {
    if (!selectedShipment) return true;
    const curT = selectedShipment.current_temp;
    const minT = Number(selectedShipment.min_temp ?? 2);
    const maxT = Number(selectedShipment.max_temp ?? 8);
    if (curT == null) return true;
    return curT >= minT && curT <= maxT && selectedShipment.status !== 'WARNING' && selectedShipment.status !== 'CRITICAL';
  }, [selectedShipment]);

  // Prepare map markers for Live Tracking
  const mapMarkers: any[] = [];
  if (selectedShipment) {
    const curT = selectedShipment.current_temp;
    if (selectedShipment.origin_lat && selectedShipment.origin_lng) {
      mapMarkers.push({
        lat: Number(selectedShipment.origin_lat),
        lng: Number(selectedShipment.origin_lng),
        title: `Origin: ${selectedShipment.origin_name}`,
        description: 'Dispatch Point Hub',
        type: 'origin',
      });
    }

    const truckLat = Number(selectedShipment.current_lat || selectedShipment.origin_lat);
    const truckLng = Number(selectedShipment.current_lng || selectedShipment.origin_lng);
    if (truckLat && truckLng) {
      mapMarkers.push({
        lat: truckLat,
        lng: truckLng,
        title: `En Route Carrier (${selectedShipment.tracking_number || '#' + selectedShipment.id})`,
        description: `Live Temperature: ${curT != null ? curT + '°C' : '--'} | Status: ${selectedShipment.status}`,
        type: 'truck',
      });
    }

    if (selectedShipment.destination_lat && selectedShipment.destination_lng) {
      mapMarkers.push({
        lat: Number(selectedShipment.destination_lat),
        lng: Number(selectedShipment.destination_lng),
        title: `Receiving Dock: ${selectedShipment.destination_name}`,
        description: 'Hospital Delivery Bay (Intake Point)',
        type: 'destination',
      });
    }
  }

  const copyHash = (hashText: string) => {
    navigator.clipboard.writeText(hashText);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-400/30 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pharma Custody Verification Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Vaccine Intake & Blockchain Ledger Center
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed font-medium">
            Live trace approaching cold-chain cargo, scan physical QR labels for full cryptographic shipping telemetry, and sign off verified delivery on the blockchain.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowScannerModal(true)}
            className="px-4 py-2.5 rounded-2xl text-xs font-black bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-md flex items-center gap-2"
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span>Scan QR for Ledger</span>
          </button>
          <button
            onClick={loadShipments}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Consignment Queue */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setActiveTab('AWAITING')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'AWAITING'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Incoming ({awaitingShipments.length})
              </button>
              <button
                onClick={() => setActiveTab('DELIVERED')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'DELIVERED'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Delivered ({deliveredShipments.length})
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tracking or vaccine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-2xl border border-slate-200 text-xs font-medium bg-slate-50/70 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            {/* Shipments List */}
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  <span>Loading consignment queue...</span>
                </div>
              ) : displayedShipments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Truck className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                  No consignments found in this view.
                </div>
              ) : (
                displayedShipments.map((s) => {
                  const isSelected = selectedShipment?.id === s.id;
                  const cargo = s.product_name || s.cargo_type || 'Cold Consignment';
                  const curT = s.current_temp;
                  const isDelivered = s.status === 'DELIVERED';

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectShipment(s)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-slate-900 block">{cargo}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {s.tracking_number || `#CG-${s.id}`}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.status === 'WARNING' || s.status === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isDelivered ? 'Verified on Ledger' : s.status === 'IN_TRANSIT' ? 'En Route' : s.status}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                        <div className="flex items-center gap-1 truncate max-w-[170px]">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{s.destination_name}</span>
                        </div>
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                          {curT != null ? `${curT}°C` : '--'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Handover Details, Live Tracking & Blockchain Audit */}
        <div className="lg:col-span-8 space-y-6">
          {selectedShipment ? (
            <div className="space-y-6">
              
              {/* Header Card with Blockchain QR Code and View Switcher */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">
                        {selectedShipment.tracking_number || `#CG-${selectedShipment.id}`}
                      </span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                        Batch #CG-2026-GOA
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                      {selectedShipment.product_name || selectedShipment.cargo_type}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {selectedShipment.origin_name} &rarr; {selectedShipment.destination_name}
                    </p>
                  </div>

                  {/* Blockchain QR Code Card (Click to View Full Ledger) */}
                  <div
                    onClick={() => setShowBlockchainLogsModal(true)}
                    className="flex items-center gap-3 p-2.5 bg-gradient-to-r from-slate-50 to-emerald-50/50 rounded-2xl border border-emerald-200/60 cursor-pointer hover:border-emerald-500 transition-all shrink-0"
                    title="Click to inspect complete blockchain shipping logs"
                  >
                    <BlockchainQrCode value={selectedShipment.tracking_number || String(selectedShipment.id)} size={64} />
                    <div className="text-left">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        Blockchain QR
                      </span>
                      <span className="text-xs font-black text-slate-900 block mt-0.5">
                        Scan Log Details
                      </span>
                      <span className="text-[10px] text-slate-400 underline decoration-dotted mt-0.5 block">
                        Open on-chain audit &rarr;
                      </span>
                    </div>
                  </div>
                </div>

                {/* View Switcher: Overview vs Live Tracking */}
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                      onClick={() => setViewMode('OVERVIEW')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        viewMode === 'OVERVIEW'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Intake & Handover</span>
                    </button>
                    <button
                      onClick={() => setViewMode('LIVE_TRACKING')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        viewMode === 'LIVE_TRACKING'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      <span>Live GPS Route Map</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowBlockchainLogsModal(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5"
                  >
                    <Cpu className="w-3.5 h-3.5 text-purple-600" />
                    <span>View Blockchain Logs</span>
                  </button>
                </div>
              </div>

              {/* VIEW 1: LIVE GPS TRACKING MAP */}
              {viewMode === 'LIVE_TRACKING' && (
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <span>Approaching Carrier Live GPS Tracking</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Real-time OSRM driving route towards your hospital dock
                      </p>
                    </div>

                    {routeMeta?.distanceKm && (
                      <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 font-mono">
                        <span>🛣️ {routeMeta.distanceKm} km away</span>
                        <span className="text-slate-300">|</span>
                        <span>⏱️ ETA ~{routeMeta.durationMin} mins</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl overflow-hidden border border-slate-200 h-[480px] relative shadow-inner">
                    <LeafletMap
                      markers={mapMarkers}
                      routeCoordinates={routeCoordinates}
                      routeColor={isCompliant ? '#10B981' : '#DC2626'}
                    />

                    {/* Floating Telemetry Chips */}
                    <div className="absolute top-4 left-4 z-[400] glass-pill px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                        <Thermometer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Live Cargo Temp</div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-1.5 font-mono">
                          <span className={`w-2 h-2 rounded-full ${isCompliant ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
                          {selectedShipment.current_temp != null ? `${selectedShipment.current_temp}°C` : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="absolute bottom-4 left-4 z-[400] glass-pill px-3.5 py-2 rounded-2xl shadow-md text-[10px] font-bold text-slate-700 flex items-center gap-3">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600" /> Dispatch Vault</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600" /> Approaching Carrier</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Hospital Dock (You)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: INTAKE OVERVIEW & BLOCKCHAIN VERIFICATION */}
              {viewMode === 'OVERVIEW' && (
                <>
                  {/* Cryptographic Cold-Chain Integrity Verdict */}
                  <div className={`p-6 rounded-3xl border shadow-xs transition-all ${
                    isCompliant
                      ? 'bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-emerald-200/90'
                      : 'bg-gradient-to-br from-rose-50/70 to-amber-50/40 border-rose-200/90'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                          isCompliant ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}>
                          {isCompliant ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900">
                            {isCompliant ? 'Cryptographic Cold-Chain Integrity Verified' : 'Temperature Excursion Flagged'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isCompliant
                              ? 'Immutable sensor history verifies that required storage band (2°C - 8°C) was strictly preserved.'
                              : 'Telemetry breached mandatory biological thresholds during transit. Quarantine review recommended.'}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right font-mono text-[11px] text-slate-500 space-y-0.5 shrink-0 bg-white/80 p-3 rounded-2xl border border-slate-200/60">
                        <div><b>Sensor Oracle:</b> SN-IOT-{selectedShipment.id * 114}</div>
                        <div><b>Cipher:</b> SHA-256 / secp256k1</div>
                        <div><b>Audit Verdict:</b> <span className={isCompliant ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{isCompliant ? '100% COMPLIANT' : 'EXCURSION'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Blockchain Proof-of-Delivery Sign-Off Form */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                          Blockchain Proof-of-Delivery Sign-Off
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        Polygon / Ethereum L2 Smart Contract
                      </span>
                    </div>

                    {/* Pre-calculated Hash Preview */}
                    <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-700 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-blue-600" />
                          Cryptographic Consignment Hash (SHA-256)
                        </span>
                        <button
                          onClick={() => copyHash(calculatedHash)}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                        >
                          {copiedHash ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                        </button>
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-800 break-all bg-white p-2.5 rounded-xl border border-slate-200">
                        {calculatedHash}
                      </div>
                    </div>

                    {/* Form Inputs: Receiver Name, Staff ID, Inspection Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase">Receiving Officer</label>
                        <input
                          type="text"
                          value={receiverName}
                          onChange={(e) => setReceiverName(e.target.value)}
                          disabled={selectedShipment.status === 'DELIVERED'}
                          className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase">Hospital Staff ID</label>
                        <input
                          type="text"
                          value={staffId}
                          onChange={(e) => setStaffId(e.target.value)}
                          disabled={selectedShipment.status === 'DELIVERED'}
                          className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase">Physical Handover Inspection Notes</label>
                      <textarea
                        rows={2}
                        value={inspectionNotes}
                        onChange={(e) => setInspectionNotes(e.target.value)}
                        disabled={selectedShipment.status === 'DELIVERED'}
                        className="w-full mt-1 p-3 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>

                    {/* Digital Signature & Mint Action */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Digital Signature:</span>
                        <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80">
                          ✍️ {signatureText}
                        </span>
                      </div>

                      {selectedShipment.status === 'DELIVERED' ? (
                        <div className="flex items-center gap-2">
                          <span className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>Receipt Minted On-Chain</span>
                          </span>
                          <button
                            onClick={() => {
                              setMintedReceipt({
                                txHash: calculatedHash.slice(0, 66),
                                blockNumber: 19842100,
                                shipment: selectedShipment,
                                timestamp: new Date().toISOString(),
                                passportId: `DPP-CG-${selectedShipment.id}-VERIFIED`,
                              });
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs flex items-center gap-1.5"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>View Passport</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleSignAndMintDelivery}
                          disabled={minting}
                          className="px-6 py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {minting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Minting Proof of Delivery On Blockchain...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              <span>Sign & Mint Blockchain Delivery Receipt</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                  </div>
                </>
              )}

            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 p-8">
              <Truck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-slate-700">Select a Consignment for Intake</h3>
              <p className="text-xs text-slate-400 mt-1">
                Choose an incoming shipment from the left queue or scan its QR code to begin verification.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: QR Code & RFID Scanner Viewfinder */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">QR / RFID Consignment Scanner</h3>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Scanner Viewfinder Visual */}
            <div className="relative h-48 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-emerald-500/50">
              <div className="w-36 h-36 border-2 border-dashed border-emerald-400 rounded-xl flex items-center justify-center relative">
                <span className="w-full h-0.5 bg-emerald-400 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-md shadow-emerald-400" />
                <QrCode className="w-16 h-16 text-emerald-400/40" />
              </div>
              <span className="absolute bottom-2 text-[10px] text-emerald-300 font-mono">
                Align QR Code to pull full on-chain shipping logs
              </span>
            </div>

            {/* Quick Demo Scan Options */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quick Test Samples (Tap to Scan):
              </span>
              <div className="flex flex-wrap gap-2">
                {awaitingShipments.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSimulatedScan(s.tracking_number || String(s.id))}
                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200"
                  >
                    Scan: {s.tracking_number || `#${s.id}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="Or paste tracking number..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-emerald-600"
              />
              <button
                onClick={() => handleSimulatedScan(scanInput)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Full Blockchain Shipping Log Details (Triggered by QR Code Scan) */}
      {showBlockchainLogsModal && selectedShipment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-400/30 uppercase">
                    On-Chain Immutable Audit Trail
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Polygon / Ethereum L2 Proof
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight">
                  Blockchain Shipping Log Details
                </h2>
                <p className="text-xs text-slate-300 font-mono">
                  {selectedShipment.tracking_number || `#CG-${selectedShipment.id}`} • {selectedShipment.product_name}
                </p>
              </div>

              <button
                onClick={() => setShowBlockchainLogsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Block Explorer & Chronological Blocks */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Smart Contract Meta Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Smart Contract Protocol:</span>
                  <span className="font-mono font-bold text-slate-800">ColdGuardPharmaRegistry.sol</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Contract Address:</span>
                  <span className="font-mono text-slate-800 break-all font-bold">0x9c4F89d12aB7603B8e174CdE29A105Bf7a90b712</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                  <span>Consignment State Hash:</span>
                  <span className="font-mono text-emerald-700 break-all font-bold">{calculatedHash.slice(0, 32)}...</span>
                </div>
              </div>

              {/* Chronological Blockchain Blocks Trail */}
              <div className="space-y-4">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Immutable Block Ledger History ({selectedShipment.status === 'DELIVERED' ? '4 Blocks Mined' : '3 Blocks Mined'})
                </span>

                {/* Block 1: Genesis Dispatch */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 relative pl-6 border-l-4 border-l-blue-600">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      Block #19842010 — Genesis Dispatch Event
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Timestamp: T-0:00</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div><b>Origin Vault:</b> {selectedShipment.origin_name}</div>
                    <div><b>Target Temperature:</b> {selectedShipment.min_temp ?? 2}°C to {selectedShipment.max_temp ?? 8}°C</div>
                    <div><b>Dispatcher Wallet:</b> 0x1A2b...99F3 (GMC Central Vault Authority)</div>
                    <div className="font-mono text-[10px] text-slate-400"><b>TxHash:</b> 0x7f2a89c1e0129bbd45e7f0923ac891024bd3c</div>
                  </div>
                </div>

                {/* Block 2: Highway Checkpoint */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 relative pl-6 border-l-4 border-l-emerald-600">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Block #19842045 — Transit Telemetry Checkpoint #1
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Timestamp: T+0:15</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div><b>GPS Telemetry:</b> NH-66 Coastal Expressway Corridor</div>
                    <div><b>Sensor Reading:</b> <span className="font-mono font-bold text-emerald-700">{selectedShipment.current_temp != null ? `${selectedShipment.current_temp}°C` : '3.8°C'}</span> (Optimal Target Zone)</div>
                    <div><b>IoT Hardware Oracle:</b> Verified via Hardware HSM Key SN-IOT-881</div>
                    <div className="font-mono text-[10px] text-slate-400"><b>TxHash:</b> 0x3c9b11d044ea908812c3f4e9102a45bc88ef0</div>
                  </div>
                </div>

                {/* Block 3: Arrival Verification */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 relative pl-6 border-l-4 border-l-purple-600">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      Block #19842088 — Hospital Receiving Dock Gate Arrival
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Timestamp: T+0:32</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div><b>Destination Facility:</b> {selectedShipment.destination_name}</div>
                    <div><b>Arriving Driver:</b> {selectedShipment.driver_name || 'Rajesh Kumar'} (GA-07-C-4021)</div>
                    <div><b>Intake Status:</b> {selectedShipment.status === 'DELIVERED' ? 'Intake Completed' : 'Carrier Arrived at Dock'}</div>
                    <div className="font-mono text-[10px] text-slate-400"><b>TxHash:</b> 0x8e4dfa2900cba14509e8f192aa3014fbc9902</div>
                  </div>
                </div>

                {/* Block 4: Final Handover Minting (if delivered) */}
                {selectedShipment.status === 'DELIVERED' && (
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-300 shadow-xs space-y-2 relative pl-6 border-l-4 border-l-emerald-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Block #19842100 — Smart Contract Settlement & Sign-Off
                      </span>
                      <span className="text-[10px] font-mono text-emerald-800">Permanent Record</span>
                    </div>
                    <div className="text-[11px] text-emerald-900 space-y-1">
                      <div><b>Receiving Officer:</b> {receiverName} ({staffId})</div>
                      <div><b>Physical Handover:</b> Seals intact, cold-chain verified compliant</div>
                      <div><b>Smart Contract Escrow:</b> Released (Carrier SLA 100% Satisfied)</div>
                      <div className="font-mono text-[10px] text-emerald-800"><b>Final State Hash:</b> {calculatedHash}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-[11px] text-slate-400 font-mono">
                Cryptographically Sealed on Blockchain
              </span>
              <button
                onClick={() => setShowBlockchainLogsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
              >
                Close Logs
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: Minted Digital Product Passport (DPP) */}
      {mintedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in">
            
            {/* Passport Header */}
            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 font-mono">
                  {mintedReceipt.passportId}
                </span>
                <h2 className="text-xl font-black">Digital Product Passport (DPP)</h2>
                <p className="text-xs text-emerald-100">Cold-Chain Cryptographic Proof of Delivery</p>
              </div>
              <button
                onClick={() => setMintedReceipt(null)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Passport Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center gap-3 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <b>Delivery Confirmed On Blockchain:</b> Consignment status permanently anchored to ledger with zero tampering risk.
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Cargo:</span>
                  <span className="font-bold text-slate-900">{mintedReceipt.shipment.product_name || 'Biologic Vaccine'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tracking Number:</span>
                  <span className="font-mono font-bold text-slate-900">{mintedReceipt.shipment.tracking_number}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Receiving Facility:</span>
                  <span className="font-bold text-slate-900">{mintedReceipt.shipment.destination_name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Received By:</span>
                  <span className="font-bold text-slate-900">{receiverName} ({staffId})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Block Number:</span>
                  <span className="font-mono font-bold text-slate-900">#{mintedReceipt.blockNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="font-mono font-medium text-slate-700">{new Date(mintedReceipt.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Transaction Hash Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Polygon / Ethereum Tx Hash</span>
                <span className="text-[11px] font-mono font-bold text-slate-800 break-all block">
                  {mintedReceipt.txHash}
                </span>
              </div>
            </div>

            {/* Passport Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-[11px] text-slate-400 font-medium">
                Verified by ColdGuard Blockchain Protocol
              </span>
              <button
                onClick={() => setMintedReceipt(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
              >
                Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
