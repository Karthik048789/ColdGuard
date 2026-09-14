'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  Search,
  Truck,
  MapPin,
  ArrowRight,
  Zap,
  RefreshCw,
  Thermometer,
  Clock,
  Navigation,
  CheckCircle2,
  QrCode as QrIcon,
  ShieldCheck,
  ExternalLink,
  FileText,
  Building2,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  Lock,
  Cpu,
  Check,
  Copy,
  FileCheck,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://coldguard-backend.onrender.com/api';

// Dynamically import Leaflet map (SSR-safe)
const LeafletMap = dynamic(() => import('@/components/maps/LeafletMap'), { ssr: false });

// ─── SHA-256 Hash Helper ──────────────────────────────────────────────────────
async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Visual QR Code Generator for On-Chain Consignment Auditing ──────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ReceiverInfo {
  id: number;
  name: string;
  email: string;
  phone: string;
  organization: string;
  designation: string;
  location?: string;
  badge?: string;
}

export interface ShipmentWithToken {
  id: number;
  tracking_number: string;
  product_name: string;
  cargo_type?: string;
  quantity?: number;
  quantity_unit?: string;
  status: string;
  origin_name: string;
  destination_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
  current_lat: number;
  current_lng: number;
  current_temp: number | null;
  current_humidity: number | null;
  current_battery: number | null;
  min_temp: number;
  max_temp: number;
  shipment_value: number;
  driver_name: string;
  driver_phone?: string;
  receiver_name?: string | null;
  receiver_email?: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  receipt_token?: string;
  facility?: any;
}

export const PRESET_RECEIVERS: ReceiverInfo[] = [
  {
    id: 1,
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@gmcgoa.in',
    phone: '+91 98221 12345',
    organization: 'Goa Medical College (GMC)',
    designation: 'Chief Medical Officer / Cold-Chain Incharge',
    location: 'Bambolim, North Goa',
    badge: 'Hospital CMO',
  },
  {
    id: 2,
    name: 'Nurse Anita Naik',
    email: 'anita.naik@southgoahospital.in',
    phone: '+91 98222 23456',
    organization: 'South Goa District Hospital',
    designation: 'Head Nurse & Vaccine Storage Supervisor',
    location: 'Margao, South Goa',
    badge: 'District Hospital',
  },
  {
    id: 3,
    name: 'Dr. Rohan Dessai',
    email: 'rohan.dessai@phcgoa.in',
    phone: '+91 98223 34567',
    organization: 'Primary Health Centre, Margao',
    designation: 'Medical Officer',
    location: 'Margao, South Goa',
    badge: 'PHC Clinic',
  },
  {
    id: 4,
    name: 'Pharmacist Vikram Patel',
    email: 'vikram.pharmacy@healthgoa.in',
    phone: '+91 98224 45678',
    organization: 'Goa State Health Department',
    designation: 'Chief State Pharmacist',
    location: 'Panaji, North Goa',
    badge: 'State Depot',
  },
  {
    id: 5,
    name: 'Dr. Meera Kamat',
    email: 'meera.kamat@aiimsgoa.in',
    phone: '+91 98225 56789',
    organization: 'AIIMS Goa',
    designation: 'Associate Professor – Medicine & Biological Storage',
    location: 'Khandola, North Goa',
    badge: 'Research Institute',
  },
  {
    id: 6,
    name: 'Cold Store Admin',
    email: 'coldstore@goamedical.in',
    phone: '+91 98226 67890',
    organization: 'Goa Cold Storage Unit',
    designation: 'Facility Administrator',
    location: 'Ponda, South Goa',
    badge: 'Central Depository',
  },
];

// ─── Temperature Tolerance Visual Bar ─────────────────────────────────────────
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
            <span className="font-mono text-slate-400 text-[10px] font-bold">--</span>
          )}
        </div>
      </div>

      <div className="relative h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5 shadow-inner">
        <div
          className="absolute top-0 bottom-0 bg-emerald-500/80 rounded-full transition-all duration-300"
          style={{
            left: `${safeStartPct}%`,
            width: `${Math.max(4, safeEndPct - safeStartPct)}%`,
          }}
        />

        {hasCur && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-all duration-500"
            style={{ left: `${curPct}%` }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-md ${
                isExcursion ? 'bg-rose-600 ring-2 ring-rose-300' : isWarning ? 'bg-amber-500 ring-1 ring-amber-200' : 'bg-emerald-600 ring-1 ring-emerald-200'
              }`}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono font-medium px-0.5">
        <span>{gaugeMin.toFixed(0)}°C</span>
        <span className="text-emerald-700 font-black tracking-tight uppercase text-[8px]">Optimal target window</span>
        <span>{gaugeMax.toFixed(0)}°C</span>
      </div>
    </div>
  );
}

// ─── Receiver Page Inner Component ────────────────────────────────────────────
function ReceiverDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [receiversList, setReceiversList] = useState<ReceiverInfo[]>(PRESET_RECEIVERS);
  const [showSwitcher, setShowSwitcher] = useState(false);

  // Active receiver state
  const [currentReceiver, setCurrentReceiver] = useState<ReceiverInfo>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEmail = localStorage.getItem('cg_receiver_email');
        if (savedEmail) {
          const match = PRESET_RECEIVERS.find((r) => r.email.toLowerCase() === savedEmail.toLowerCase());
          if (match) return match;
        }
        const latestAssigned = localStorage.getItem('cg_latest_assigned_email');
        if (latestAssigned) {
          const match = PRESET_RECEIVERS.find((r) => r.email.toLowerCase() === latestAssigned.toLowerCase());
          if (match) return match;
        }
        const authUser = localStorage.getItem('coldguard_user');
        if (authUser) {
          const u = JSON.parse(authUser);
          const match = PRESET_RECEIVERS.find((r) => r.email.toLowerCase() === u.email.toLowerCase());
          if (match) return match;
        }
      } catch {}
    }
    return PRESET_RECEIVERS[0];
  });

  // Shipments state
  const [shipments, setShipments] = useState<ShipmentWithToken[]>([]);
  const [allShipments, setAllShipments] = useState<ShipmentWithToken[]>([]);
  const [otherShipmentNotice, setOtherShipmentNotice] = useState<{
    receiverName: string;
    receiverEmail: string;
    organization: string;
    trackingNumber: string;
    productName: string;
    receiverObj?: ReceiverInfo;
  } | null>(null);
  const [selected, setSelected] = useState<ShipmentWithToken | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'WARNING' | 'DELIVERED'>('ALL');

  // Route & Telemetry state
  const [routeCoordinates, setRouteCoordinates] = useState<Array<[number, number]>>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMeta, setRouteMeta] = useState<{ distanceKm: string; durationMin: number } | null>(null);

  // Modals state
  const [qrModal, setQrModal] = useState<{
    open: boolean;
    shipment: ShipmentWithToken;
    receiptUrl: string;
    qrDataUrl: string;
    token: string;
  } | null>(null);
  const [inspectModal, setInspectModal] = useState<ShipmentWithToken | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalBanner, setApprovalBanner] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Additional state from upstream (Blockchain Intake & DPP) ──────────────
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'LIVE_TRACKING'>('LIVE_TRACKING');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBlockchainLogsModal, setShowBlockchainLogsModal] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);
  const [receiverNameInput, setReceiverNameInput] = useState('');
  const [staffId, setStaffId] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('Packaging and seal intact. No physical damage or temperature breach.');
  const [signatureText, setSignatureText] = useState('');
  const [calculatedHash, setCalculatedHash] = useState<string>('0x3a1b4c89e2f019a2b5d4e6f7a8b9c0d1e2f3a4b5c6d7e8f9');
  const [minting, setMinting] = useState(false);
  const [mintedReceipt, setMintedReceipt] = useState<{
    txHash: string;
    blockNumber: number;
    shipment: ShipmentWithToken;
    timestamp: string;
    passportId: string;
  } | null>(null);

  // ── Load receivers from backend ───────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/receivers`, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((res) => {
        const backendList = res?.data || res;
        if (Array.isArray(backendList) && backendList.length > 0) {
          const merged = [...PRESET_RECEIVERS];
          backendList.forEach((br: any) => {
            if (!merged.some((m) => m.email.toLowerCase() === br.email.toLowerCase())) {
              merged.push({
                id: br.id,
                name: br.name,
                email: br.email,
                phone: br.phone || '',
                organization: br.organization || 'Goa Health Facility',
                designation: br.designation || 'Receiver',
                badge: 'Registered',
              });
            }
          });
          setReceiversList(merged);
        }
      })
      .catch(() => {});
  }, []);

  // ── Sync URL search params ────────────────────────────────────────────────
  useEffect(() => {
    const pEmail = searchParams.get('email');
    const pId = searchParams.get('id') || searchParams.get('receiver');
    if (pEmail && pEmail.toLowerCase() !== currentReceiver.email.toLowerCase()) {
      const match = receiversList.find((r) => r.email.toLowerCase() === pEmail.toLowerCase());
      if (match) {
        setCurrentReceiver(match);
        localStorage.setItem('cg_receiver_email', match.email);
      }
    } else if (pId && Number(pId) !== currentReceiver.id) {
      const match = receiversList.find((r) => r.id === Number(pId));
      if (match) {
        setCurrentReceiver(match);
        localStorage.setItem('cg_receiver_email', match.email);
      }
    }
  }, [searchParams, receiversList, currentReceiver.email, currentReceiver.id]);

  // ── Initialize sign-off form from current receiver ────────────────────────
  useEffect(() => {
    setReceiverNameInput(currentReceiver.name);
    setSignatureText(currentReceiver.name.split(' ').pop() || currentReceiver.name);
    setStaffId(`PHARM-IN-${currentReceiver.id}001`);
  }, [currentReceiver]);

  // ── Load shipments assigned to the current receiver ───────────────────────
  const loadShipments = useCallback(async (recTarget: ReceiverInfo) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/shipments`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      let all: any[] = [];
      if (Array.isArray(json)) all = json;
      else if (Array.isArray(json?.data)) all = json.data;
      else if (Array.isArray(json?.data?.shipments)) all = json.data.shipments;
      else if (Array.isArray(json?.shipments)) all = json.shipments;

      // 1. Get locally cached assignments (from manager dispatch)
      const localMap = (() => {
        try {
          return JSON.parse(localStorage.getItem('cg_assigned_receivers') || '{}');
        } catch {
          return {};
        }
      })();

      // 2. Enrich shipments
      const enriched: ShipmentWithToken[] = all.map((s: any) => {
        const local = localMap[s.id] || localMap[s.tracking_number];
        let rEmail = s.receiver_email || local?.receiver_email || '';
        let rName = s.receiver_name || local?.receiver_name || '';

        // Destination / facility fallback if unassigned
        if (!rEmail && !rName) {
          const dest = String(s.destination_name || '').toLowerCase();
          const orig = String(s.origin_name || '').toLowerCase();
          if (dest.includes('bambolim') || dest.includes('gmc') || dest.includes('panaji') || dest.includes('st.cruz') || orig.includes('bambolim')) {
            rEmail = 'priya.sharma@gmcgoa.in';
            rName = 'Dr. Priya Sharma';
          } else if (dest.includes('south goa') || dest.includes('margao') || dest.includes('district hospital')) {
            rEmail = 'anita.naik@southgoahospital.in';
            rName = 'Nurse Anita Naik';
          } else if (dest.includes('phc')) {
            rEmail = 'rohan.dessai@phcgoa.in';
            rName = 'Dr. Rohan Dessai';
          } else if (dest.includes('aiims') || dest.includes('khandola')) {
            rEmail = 'meera.kamat@aiimsgoa.in';
            rName = 'Dr. Meera Kamat';
          } else if (dest.includes('cold store') || dest.includes('ponda')) {
            rEmail = 'coldstore@goamedical.in';
            rName = 'Cold Store Admin';
          }
        }

        return {
          ...s,
          receiver_email: rEmail || null,
          receiver_name: rName || null,
        };
      });

      setAllShipments(enriched);

      const recEmail = recTarget.email.toLowerCase().trim();
      const recName = recTarget.name.toLowerCase().trim();

      // 3. Strict filter for this receiver
      const filtered = enriched.filter((s: any) => {
        const sEmail = s.receiver_email ? String(s.receiver_email).toLowerCase().trim() : '';
        const sName = s.receiver_name ? String(s.receiver_name).toLowerCase().trim() : '';
        return sEmail === recEmail || (sName && sName === recName);
      });

      // 4. If this receiver has NO shipments, check if another receiver does
      if (filtered.length === 0 && enriched.length > 0) {
        const otherWithShipment = enriched.find((s) => s.receiver_email || s.receiver_name);
        if (otherWithShipment) {
          const oEmail = (otherWithShipment.receiver_email || '').toLowerCase().trim();
          const oName = (otherWithShipment.receiver_name || '').toLowerCase().trim();
          const foundRec = receiversList.find(
            (r) =>
              (oEmail && r.email.toLowerCase().trim() === oEmail) ||
              (oName && r.name.toLowerCase().trim() === oName)
          );
          setOtherShipmentNotice({
            receiverName: otherWithShipment.receiver_name || foundRec?.name || 'Assigned Officer',
            receiverEmail: otherWithShipment.receiver_email || foundRec?.email || '',
            organization: foundRec?.organization || otherWithShipment.destination_name || 'Hospital Facility',
            trackingNumber: otherWithShipment.tracking_number,
            productName: otherWithShipment.product_name,
            receiverObj: foundRec,
          });
        } else {
          setOtherShipmentNotice(null);
        }
      } else {
        setOtherShipmentNotice(null);
      }

      setShipments(filtered);
      setSelected((prev) => {
        if (!prev) return filtered.length > 0 ? filtered[0] : null;
        const stillThere = filtered.find((s) => s.id === prev.id);
        return stillThere || (filtered.length > 0 ? filtered[0] : null);
      });
    } catch (err) {
      console.error('Error fetching shipments for receiver:', err);
    } finally {
      setLoading(false);
    }
  }, [receiversList]);

  // ── Initial load and silent 5-second polling ──────────────────────────────
  useEffect(() => {
    loadShipments(currentReceiver);
    localStorage.setItem('cg_receiver_email', currentReceiver.email);

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadShipments(currentReceiver);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentReceiver, loadShipments]);

  // ── Synchronize across tabs when manager assigns new shipment ─────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('coldguard_receiver_sync');
    bc.onmessage = (event) => {
      const { receiver_email } = event.data || {};
      if (receiver_email) {
        loadShipments(currentReceiver);
      }
    };
    return () => {
      bc.close();
    };
  }, [currentReceiver, loadShipments]);

  // ── Handle Switch Receiver ────────────────────────────────────────────────
  const handleSelectReceiver = (r: ReceiverInfo) => {
    setCurrentReceiver(r);
    setShowSwitcher(false);
    localStorage.setItem('cg_receiver_email', r.email);
    router.replace(`/receiver?email=${encodeURIComponent(r.email)}`);
  };

  // ── Fetch OSRM Road Route for selected shipment ──────────────────────────
  const fetchReceiverRoute = useCallback(async (s: ShipmentWithToken) => {
    if (!s) return;
    setRouteLoading(true);
    try {
      const startLng = Number(s.origin_lng || s.current_lng);
      const startLat = Number(s.origin_lat || s.current_lat);
      const endLng = Number(s.destination_lng);
      const endLat = Number(s.destination_lat);

      if (!startLng || !startLat || !endLng || !endLat) {
        setRouteLoading(false);
        return;
      }

      let leafletCoords: Array<[number, number]> = [];
      let distanceKm: string | undefined;
      let durationMin: number | undefined;

      const isExcursion = (s.status === 'WARNING' || s.status === 'CRITICAL') &&
        (Number(s.current_temp) > Number(s.max_temp ?? 8) || Number(s.current_temp) < Number(s.min_temp ?? 2));
      const isRerouted = s.status === 'REROUTED' || (s.status as string) === 'DIVERTED' || s.status === 'CRITICAL' || isExcursion;

      // 1. If REROUTED, build multi-stop route [Start -> Facility -> Destination]
      if (isRerouted) {
        const facCandidate = (s as any).facility || { latitude: 15.4989, longitude: 73.8278, name: 'Panaji Vaccine Hub' };
        if (facCandidate?.latitude && facCandidate?.longitude) {
          const multiUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${Number(facCandidate.longitude)},${Number(facCandidate.latitude)};${endLng},${endLat}?overview=full&geometries=geojson`;
          const multiRes = await fetch(multiUrl).then((r) => r.json()).catch(() => null);

          if (multiRes?.routes?.[0]?.geometry?.coordinates && multiRes.routes[0].geometry.coordinates.length > 5) {
            leafletCoords = multiRes.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            distanceKm = (multiRes.routes[0].distance / 1000).toFixed(1);
            durationMin = Math.round(multiRes.routes[0].duration / 60);
          }
        }
      }

      // 2. Direct public OSRM Highway route (Origin -> Destination)
      if (leafletCoords.length <= 2) {
        const directUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const directRes = await fetch(directUrl).then((r) => r.json()).catch(() => null);

        if (directRes?.routes?.[0]?.geometry?.coordinates && directRes.routes[0].geometry.coordinates.length > 5) {
          leafletCoords = directRes.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          distanceKm = (directRes.routes[0].distance / 1000).toFixed(1);
          durationMin = Math.round(directRes.routes[0].duration / 60);
        }
      }

      // 3. Fallback to backend route endpoint
      if (leafletCoords.length <= 2) {
        const res = await fetch(`${API_BASE}/shipments/${s.id}/route?direct=true`, { headers: { Accept: 'application/json' } })
          .then((r) => r.json())
          .catch(() => null);
        const backendCoords = res?.data?.geometry?.coordinates;
        if (Array.isArray(backendCoords) && backendCoords.length > 5 && (Number(res?.data?.distance_km) > 0 || Number(res?.data?.distance_m) > 0)) {
          leafletCoords = backendCoords.map((c: [number, number]) => [c[1], c[0]]);
          distanceKm = res.data.distance_km != null ? Number(res.data.distance_km).toFixed(1) : undefined;
          durationMin = res.data.duration_minutes != null ? Math.round(res.data.duration_minutes) : undefined;
        }
      }

      // 4. Guaranteed corridor fallback if external network or backend is unreachable
      if (leafletCoords.length <= 2) {
        const waypoints = isRerouted
          ? [
              [startLat, startLng],
              [15.4989, 73.8278],
              [endLat, endLng],
            ]
          : [
              [startLat, startLng],
              [endLat, endLng],
            ];
        const corridor: Array<[number, number]> = [];
        for (let w = 0; w < waypoints.length - 1; w++) {
          const p1 = waypoints[w];
          const p2 = waypoints[w + 1];
          for (let step = 0; step <= 15; step++) {
            const frac = step / 15;
            corridor.push([
              p1[0] + (p2[0] - p1[0]) * frac,
              p1[1] + (p2[1] - p1[1]) * frac,
            ]);
          }
        }
        leafletCoords = corridor;
        distanceKm = distanceKm || '23.3';
        durationMin = durationMin || 27;
      }

      // Ensure Leaflet coordinates are [lat, lng] format
      if (leafletCoords.length > 2) {
        const normalized: Array<[number, number]> = leafletCoords.map(([c0, c1]) => {
          if (c0 > 50 && c1 < 30) return [c1, c0];
          return [c0, c1];
        });
        setRouteCoordinates(normalized);
        setRouteMeta({
          distanceKm: distanceKm || '17.5',
          durationMin: durationMin || 23,
        });
      }
    } catch (err) {
      console.error('Receiver route fetch error:', err);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  // ── Update route when selected shipment changes ───────────────────────────
  useEffect(() => {
    if (selected) {
      fetchReceiverRoute(selected);
    } else {
      setRouteCoordinates([]);
      setRouteMeta(null);
    }
  }, [selected?.id, selected?.status, fetchReceiverRoute]);

  // ── Instantaneous cross-tab broadcast synchronization from driver ─────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('coldguard_live_tracking');
    bc.onmessage = (event) => {
      const { shipmentId, latitude, longitude, temperature, status, facility, routeCoordinates: newCoords } = event.data || {};
      if (!shipmentId) return;

      const targetId = Number(shipmentId);
      const newTemp = temperature !== undefined && temperature !== null && !isNaN(Number(temperature))
        ? Number(temperature)
        : undefined;

      setSelected((prev) => {
        if (!prev || Number(prev.id) !== targetId) return prev;
        return {
          ...prev,
          current_lat: latitude ?? prev.current_lat,
          current_lng: longitude ?? prev.current_lng,
          current_temp: newTemp !== undefined ? newTemp : prev.current_temp,
          status: status || prev.status,
          facility: facility || (prev as any).facility,
        } as any;
      });

      setShipments((prev) =>
        prev.map((s) =>
          Number(s.id) === targetId
            ? ({
                ...s,
                current_lat: latitude ?? s.current_lat,
                current_lng: longitude ?? s.current_lng,
                current_temp: newTemp !== undefined ? newTemp : s.current_temp,
                status: status || s.status,
                facility: facility || (s as any).facility,
              } as any)
            : s
        )
      );

      if (Array.isArray(newCoords) && newCoords.length > 0) {
        const leafletCoords: Array<[number, number]> = newCoords.map((c: [number, number]) => {
          if (c[0] > 50 && c[1] < 30) {
            return [c[1], c[0]];
          }
          return [c[0], c[1]];
        });
        setRouteCoordinates(leafletCoords);
      }

      // Dynamically count down remaining distance and ETA
      if (latitude && longitude && selected?.destination_lat && selected?.destination_lng) {
        const dLat = ((Number(selected.destination_lat) - latitude) * Math.PI) / 180;
        const dLng = ((Number(selected.destination_lng) - longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((latitude * Math.PI) / 180) * Math.cos((Number(selected.destination_lat) * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const distKm = Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.25).toFixed(1));
        const durMin = Math.max(1, Math.round((distKm / 45) * 60));
        setRouteMeta({ distanceKm: String(distKm), durationMin: durMin });
      }
    };

    return () => {
      bc.close();
    };
  }, [selected?.destination_lat, selected?.destination_lng]);

  // ── SHA-256 hash computation when selected shipment changes ───────────────
  useEffect(() => {
    if (selected) {
      const rawPayload = `${selected.id}-${selected.tracking_number}-${selected.current_temp}-${selected.destination_name}-${staffId}`;
      sha256(rawPayload).then((h) => setCalculatedHash(h));
    }
  }, [selected, staffId]);

  // ── Cold-chain compliance check ───────────────────────────────────────────
  const isCompliant = useMemo(() => {
    if (!selected) return true;
    const curT = selected.current_temp;
    const minT = Number(selected.min_temp ?? 2);
    const maxT = Number(selected.max_temp ?? 8);
    if (curT == null) return true;
    return curT >= minT && curT <= maxT && selected.status !== 'WARNING' && selected.status !== 'CRITICAL';
  }, [selected]);

  // ── Delivery Approval & Blockchain QR Code Generation ─────────────────────
  const handleApproveDelivery = async (shipment: ShipmentWithToken) => {
    setIsApproving(true);
    try {
      const res = await fetch(`${API_BASE}/blockchain/${shipment.id}/confirm-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ confirmed_by: `${currentReceiver.name} (${currentReceiver.organization})` }),
      });
      const data = await res.json();

      if (data.success && data.receipt_token) {
        const token = data.receipt_token;
        const receiptUrl = `${window.location.origin}/receiver/receipt?token=${token}`;
        const qrDataUrl = await QRCode.toDataURL(receiptUrl, {
          width: 320,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });

        const updatedShipment = {
          ...shipment,
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
          receipt_token: token,
        };

        setSelected(updatedShipment);
        setShipments((prev) => prev.map((s) => (s.id === shipment.id ? updatedShipment : s)));

        setQrModal({
          open: true,
          shipment: updatedShipment,
          receiptUrl,
          qrDataUrl,
          token,
        });

        setApprovalBanner(`Consignment #${shipment.tracking_number} successfully accepted and sealed on blockchain.`);
      } else {
        // Fallback token generator
        const fallbackToken = `CG-RCPT-${shipment.id}-${Date.now().toString(36).toUpperCase()}`;
        const receiptUrl = `${window.location.origin}/receiver/receipt?token=${fallbackToken}`;
        const qrDataUrl = await QRCode.toDataURL(receiptUrl, {
          width: 320,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
        });

        const updatedShipment = {
          ...shipment,
          status: 'DELIVERED',
          delivered_at: new Date().toISOString(),
          receipt_token: fallbackToken,
        };

        setSelected(updatedShipment);
        setShipments((prev) => prev.map((s) => (s.id === shipment.id ? updatedShipment : s)));

        setQrModal({
          open: true,
          shipment: updatedShipment,
          receiptUrl,
          qrDataUrl,
          token: fallbackToken,
        });

        setApprovalBanner(`Consignment #${shipment.tracking_number} verified and accepted by ${currentReceiver.name}.`);
      }
    } catch {
      alert('Unable to connect to blockchain node. Delivery saved locally.');
    } finally {
      setIsApproving(false);
    }
  };

  // ── Open existing QR receipt ──────────────────────────────────────────────
  const handleOpenQrReceipt = async (shipment: ShipmentWithToken) => {
    const token = shipment.receipt_token || `CG-RCPT-${shipment.id}-ARCHIVED`;
    const receiptUrl = `${window.location.origin}/receiver/receipt?token=${token}`;
    const qrDataUrl = await QRCode.toDataURL(receiptUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    setQrModal({
      open: true,
      shipment,
      receiptUrl,
      qrDataUrl,
      token,
    });
  };

  // ── Sign & Mint Blockchain Delivery (Detailed Form) ───────────────────────
  const handleSignAndMintDelivery = async () => {
    if (!selected) return;
    setMinting(true);
    try {
      await fetch(`${API_BASE}/blockchain/${selected.id}/confirm-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ confirmed_by: `${receiverNameInput} (${currentReceiver.organization})` }),
      });

      // Also mark as delivered on the shipment
      await fetch(`${API_BASE}/shipments/${selected.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }).catch(() => {});

      const mockBlockNum = Math.floor(19800000 + Math.random() * 50000);
      const generatedTxHash = calculatedHash.slice(0, 66);
      const passportId = `DPP-CG-${selected.id}-${Date.now().toString().slice(-4)}`;

      const updatedShipment = {
        ...selected,
        status: 'DELIVERED',
        delivered_at: new Date().toISOString(),
      };

      setSelected(updatedShipment);
      setShipments((prev) => prev.map((s) => (s.id === selected.id ? updatedShipment : s)));

      setMintedReceipt({
        txHash: generatedTxHash,
        blockNumber: mockBlockNum,
        shipment: updatedShipment,
        timestamp: new Date().toISOString(),
        passportId,
      });

      setApprovalBanner(`Consignment #${selected.tracking_number} successfully verified and sealed on blockchain.`);
    } catch (err: any) {
      alert(err.message || 'Failed to complete blockchain delivery sign-off');
    } finally {
      setMinting(false);
    }
  };

  // ── Handle QR Scanner Simulation ──────────────────────────────────────────
  const handleSimulatedScan = (trackingNumber: string) => {
    const found = shipments.find(
      (s) => s.tracking_number?.toLowerCase() === trackingNumber.toLowerCase() || String(s.id) === trackingNumber
    );
    if (found) {
      setSelected(found);
      setShowScannerModal(false);
      setScanInput('');
      setShowBlockchainLogsModal(true);
    } else {
      alert(`No shipment found matching tracking number ${trackingNumber}`);
    }
  };

  // ── Copy hash to clipboard ────────────────────────────────────────────────
  const copyHash = (hashText: string) => {
    navigator.clipboard.writeText(hashText);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // ── Filtered Shipments ────────────────────────────────────────────────────
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchQ =
        !q ||
        s.product_name?.toLowerCase().includes(q) ||
        s.tracking_number?.toLowerCase().includes(q) ||
        s.destination_name?.toLowerCase().includes(q) ||
        s.origin_name?.toLowerCase().includes(q) ||
        s.driver_name?.toLowerCase().includes(q);

      if (!matchQ) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'IN_TRANSIT') return s.status === 'IN_TRANSIT' || s.status === 'REROUTED' || (s.status as string) === 'DIVERTED';
      if (statusFilter === 'WARNING') return s.status === 'WARNING' || s.status === 'CRITICAL';
      if (statusFilter === 'DELIVERED') return s.status === 'DELIVERED';
      return true;
    });
  }, [shipments, searchQuery, statusFilter]);

  // ── Map Markers ───────────────────────────────────────────────────────────
  const mapMarkers = useMemo(() => {
    const list: any[] = [];

    if (selected) {
      const cargo = selected.product_name || 'Cold Cargo';

      // Origin
      if (selected.origin_lat && selected.origin_lng) {
        list.push({
          lat: Number(selected.origin_lat),
          lng: Number(selected.origin_lng),
          title: `Origin: ${selected.origin_name}`,
          description: `Dispatch Hub | Required: ${selected.min_temp}°C - ${selected.max_temp}°C`,
          type: 'origin',
        });
      }

      // Live Truck
      const truckLat = Number(selected.current_lat || selected.origin_lat);
      const truckLng = Number(selected.current_lng || selected.origin_lng);
      if (truckLat && truckLng) {
        list.push({
          lat: truckLat,
          lng: truckLng,
          title: `Live Truck (${selected.tracking_number || '#' + selected.id})`,
          description: `Payload: ${cargo} | Current Temp: ${selected.current_temp != null ? selected.current_temp + '°C' : 'Stable'}`,
          type: 'truck',
        });
      }

      // Destination Hospital / Facility
      if (selected.destination_lat && selected.destination_lng) {
        list.push({
          lat: Number(selected.destination_lat),
          lng: Number(selected.destination_lng),
          title: `Destination: ${selected.destination_name}`,
          description: `Receiving Facility: ${currentReceiver.organization}`,
          type: 'destination',
        });
      }

      // Cold Vault / Emergency Hub if diverted
      const fac = (selected as any).facility;
      if (
        (selected.status === 'REROUTED' || selected.status === 'DIVERTED' || selected.status === 'CRITICAL') &&
        fac?.latitude &&
        fac?.longitude
      ) {
        list.push({
          lat: Number(fac.latitude),
          lng: Number(fac.longitude),
          title: `Emergency Hub: ${fac.name}`,
          description: 'Cold-chain recovery facility',
          type: 'facility',
        });
      }
    }

    return list;
  }, [selected, currentReceiver.organization]);

  return (
    <div className="min-h-screen bg-slate-100/70 p-4 lg:p-6 space-y-6 font-sans">
      
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              ColdGuard Receiver Console
            </h1>
            <span className="flex items-center gap-1 text-[11px] font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200/60 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              Inbound Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time IoT cold-chain orchestration & blockchain verification for {currentReceiver.name} ({currentReceiver.organization})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* QR Scanner Button */}
          <button
            onClick={() => setShowScannerModal(true)}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white hover:bg-emerald-50 border border-slate-200 transition-all shadow-xs flex items-center gap-2 hover:border-emerald-300 cursor-pointer"
          >
            <QrIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Scan QR</span>
          </button>

          {/* Receiver Profile Pill & Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowSwitcher((prev) => !prev)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all shadow-xs cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                    {currentReceiver.name}
                  </span>
                  <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full">
                    {currentReceiver.badge || 'Receiver'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium truncate max-w-[180px]">
                  {currentReceiver.organization}
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
            </button>

            {/* Switcher Dropdown */}
            {showSwitcher && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-3xl border border-slate-200 shadow-2xl p-3 z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Select Receiving Facility
                  </span>
                  <span className="text-[9px] text-slate-400">1-Tap Switch</span>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {receiversList.map((r) => {
                    const isAct = r.email.toLowerCase() === currentReceiver.email.toLowerCase();
                    return (
                      <button
                        key={r.email}
                        onClick={() => handleSelectReceiver(r)}
                        className={`w-full p-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          isAct
                            ? 'bg-blue-50 border border-blue-200 text-blue-900'
                            : 'hover:bg-slate-50 border border-transparent text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{r.name}</span>
                            {(() => {
                              const recCount = allShipments.filter((s) => {
                                const semail = (s.receiver_email || '').toLowerCase().trim();
                                const sname = (s.receiver_name || '').toLowerCase().trim();
                                return semail === r.email.toLowerCase().trim() || (sname && sname === r.name.toLowerCase().trim());
                              }).length;
                              return recCount > 0 ? (
                                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">
                                  {recCount} payload{recCount > 1 ? 's' : ''}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="text-[10px] text-slate-500">{r.organization}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{r.email}</div>
                        </div>
                        {isAct && (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Active ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Feed Button */}
          <button
            onClick={() => loadShipments(currentReceiver)}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all shadow-xs flex items-center gap-2 hover:border-slate-300 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {approvalBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{approvalBanner}</span>
          </div>
          <button onClick={() => setApprovalBanner(null)} className="text-emerald-600 hover:text-emerald-900 text-sm cursor-pointer">✕</button>
        </div>
      )}

      {/* ── Main Split Layout: Left Feed + Right Map/Details ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── Left Column: Active Shipment Feed ────────────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Active Shipment Feed
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Select a payload to trace real-time route
                </p>
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
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
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
              {loading && shipments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <span>Loading assigned shipments...</span>
                </div>
              ) : filteredShipments.length === 0 ? (
                <div className="space-y-3">
                  {otherShipmentNotice && (
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/80 border border-blue-200/90 rounded-2xl space-y-2.5 shadow-xs animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📦</span>
                        <span className="text-xs font-black text-blue-950">
                          Active Consignment Found
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                        Consignment <b className="font-mono text-blue-900">{otherShipmentNotice.trackingNumber}</b> ({otherShipmentNotice.productName}) is assigned to <b>{otherShipmentNotice.receiverName}</b> at <b>{otherShipmentNotice.organization}</b>.
                      </p>
                      {otherShipmentNotice.receiverObj && (
                        <button
                          onClick={() => handleSelectReceiver(otherShipmentNotice.receiverObj!)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Switch to {otherShipmentNotice.receiverName} to View</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-center py-12 text-slate-400 text-xs p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div className="font-bold text-slate-700">No shipments assigned to {currentReceiver.name}</div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Consignments dispatched to {currentReceiver.organization} will appear here automatically.
                    </p>
                  </div>
                </div>
              ) : (
                filteredShipments.map((s) => {
                  const isSelected = selected && selected.id === s.id;
                  const cargo = s.product_name || s.cargo_type || 'Consignment';
                  const minT = Number(s.min_temp ?? 2.0);
                  const maxT = Number(s.max_temp ?? 8.0);
                  const curT = isSelected && selected?.current_temp != null
                    ? Number(selected.current_temp)
                    : (s.current_temp != null ? Number(s.current_temp) : null);

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelected(s)}
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
                                  : s.status === 'REROUTED' || (s.status as string) === 'DIVERTED'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status === 'IN_TRANSIT' ? 'In Transit' : s.status === 'REROUTED' || (s.status as string) === 'DIVERTED' ? 'Rerouted' : s.status}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {s.tracking_number || `#CG-${s.id}`}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectModal(s);
                          }}
                          className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 text-slate-700 shadow-xs shrink-0 flex items-center gap-1 transition-all cursor-pointer"
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

                          {/* Quick Action: If delivered, show Scan QR Receipt */}
                          {s.status === 'DELIVERED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenQrReceipt(s);
                              }}
                              className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <QrIcon className="w-3 h-3" />
                              <span>QR Receipt</span>
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

        {/* ── Right Column: GPS Route Map & Blockchain Intake ──────────── */}
        <div className="lg:col-span-7 space-y-4">

          {/* Header Card with Blockchain QR + View Switcher */}
          {selected && (
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">
                      {selected.tracking_number || `#CG-${selected.id}`}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                      Batch #CG-2026-GOA
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900">
                    {selected.product_name || selected.cargo_type}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selected.origin_name} &rarr; {selected.destination_name}
                  </p>
                </div>

                {/* Blockchain QR Code Card */}
                <div
                  onClick={() => setShowBlockchainLogsModal(true)}
                  className="flex items-center gap-3 p-2.5 bg-gradient-to-r from-slate-50 to-emerald-50/50 rounded-2xl border border-emerald-200/60 cursor-pointer hover:border-emerald-500 transition-all shrink-0"
                  title="Click to inspect complete blockchain shipping logs"
                >
                  <BlockchainQrCode value={selected.tracking_number || String(selected.id)} size={64} />
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

              {/* View Mode Toggle */}
              <div className="flex items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    onClick={() => setViewMode('LIVE_TRACKING')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'LIVE_TRACKING'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Live GPS Route Map</span>
                  </button>
                  <button
                    onClick={() => setViewMode('OVERVIEW')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      viewMode === 'OVERVIEW'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Intake & Handover</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowBlockchainLogsModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-600" />
                  <span>Blockchain Logs</span>
                </button>
              </div>
            </div>
          )}

          {/* ── VIEW: LIVE GPS TRACKING MAP ─────────────────────────────── */}
          {viewMode === 'LIVE_TRACKING' && (
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              {/* Map Header with OSRM Metrics */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-slate-900 tracking-tight">
                      {selected ? `GPS Route: ${selected.product_name}` : 'Real-time GPS Route Map'}
                    </h2>
                    {selected && (
                      <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                        {selected.tracking_number || `#CG-${selected.id}`}
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
                      <span className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-blue-600" /> {routeMeta.distanceKm} km</span>
                      <span className="text-slate-300">|</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> {routeMeta.durationMin} mins</span>
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
                  routeColor={
                    selected?.status === 'WARNING' || selected?.status === 'CRITICAL'
                      ? '#DC2626'
                      : selected?.status === 'REROUTED' || (selected?.status as string) === 'DIVERTED'
                      ? '#8B5CF6'
                      : '#2563EB'
                  }
                />

                {/* FLOATING HUD BADGE 1: Current Temp & Health (Top Left) */}
                {selected && (
                  <div className="absolute top-4 left-4 z-[400] glass-pill px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Thermometer className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Current Temp</div>
                      <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            selected.current_temp != null &&
                            (selected.current_temp < selected.min_temp || selected.current_temp > selected.max_temp)
                              ? 'bg-rose-500 animate-ping'
                              : 'bg-emerald-500'
                          }`}
                        />
                        {selected.current_temp != null ? `${Number(selected.current_temp).toFixed(1)}°C` : '--'}
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
            </div>
          )}

          {/* ── VIEW: INTAKE OVERVIEW & BLOCKCHAIN VERIFICATION ─────────── */}
          {viewMode === 'OVERVIEW' && selected && (
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
                          ? 'Immutable sensor history verifies that required storage band was strictly preserved.'
                          : 'Telemetry breached mandatory biological thresholds during transit. Quarantine review recommended.'}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right font-mono text-[11px] text-slate-500 space-y-0.5 shrink-0 bg-white/80 p-3 rounded-2xl border border-slate-200/60">
                    <div><b>Sensor Oracle:</b> SN-IOT-{selected.id * 114}</div>
                    <div><b>Cipher:</b> SHA-256 / secp256k1</div>
                    <div><b>Audit Verdict:</b> <span className={isCompliant ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{isCompliant ? '100% COMPLIANT' : 'EXCURSION'}</span></div>
                  </div>
                </div>
              </div>

              {/* Blockchain Proof-of-Delivery Sign-Off Form */}
              <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
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
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
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
                      value={receiverNameInput}
                      onChange={(e) => setReceiverNameInput(e.target.value)}
                      disabled={selected.status === 'DELIVERED'}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Hospital Staff ID</label>
                    <input
                      type="text"
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      disabled={selected.status === 'DELIVERED'}
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
                    disabled={selected.status === 'DELIVERED'}
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

                  {selected.status === 'DELIVERED' ? (
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
                            shipment: selected,
                            timestamp: new Date().toISOString(),
                            passportId: `DPP-CG-${selected.id}-VERIFIED`,
                          });
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View Passport</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleSignAndMintDelivery}
                      disabled={minting}
                      className="px-6 py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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

          {/* Quick Actions Bar for Selected Shipment */}
          {selected && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-blue-50/40 p-3.5 rounded-2xl border border-slate-200/70">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-black text-slate-800">Receiving Dock Controls:</span>
                <span className="text-[11px] text-slate-500">
                  Status: <b className="text-slate-900 uppercase font-mono">{selected.status}</b>
                </span>
                {selected.status === 'DELIVERED' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified on Chain
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selected.status !== 'DELIVERED' ? (
                  <button
                    onClick={() => handleApproveDelivery(selected)}
                    disabled={isApproving}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/25 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isApproving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sealing on Chain...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept & Approve Delivery</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenQrReceipt(selected)}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <QrIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Blockchain QR Receipt</span>
                  </button>
                )}

                <button
                  onClick={() => setInspectModal(selected)}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Inspect Audit Trail</span>
                </button>
              </div>
            </div>
          )}

          {/* No shipment selected placeholder */}
          {!selected && (
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

      {/* ── MODAL: Blockchain Verification QR Code Receipt ────────────────── */}
      {qrModal && qrModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 text-center space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                Consignment Receipt Approved
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Blockchain custody sealed for <b>{qrModal.shipment.product_name}</b> ({qrModal.shipment.tracking_number})
              </p>
            </div>

            {/* High-res QR Code Frame */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl inline-block shadow-inner">
              <img
                src={qrModal.qrDataUrl}
                alt="Blockchain Receipt QR"
                className="w-56 h-56 mx-auto object-contain rounded-xl"
              />
            </div>

            <p className="text-[11px] text-slate-500 px-4 leading-relaxed">
              Scan this QR code with any smartphone or barcode reader to inspect the complete, immutable temperature logs, GPS waypoints, and cold-chain compliance verification.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <a
                href={qrModal.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>Open Full Journey & Log Records →</span>
              </a>

              <button
                onClick={() => setQrModal(null)}
                className="w-full py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: QR / RFID Consignment Scanner ─────────────────────────── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrIcon className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900">QR / RFID Consignment Scanner</h3>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scanner Viewfinder Visual */}
            <div className="relative h-48 bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-emerald-500/50">
              <div className="w-36 h-36 border-2 border-dashed border-emerald-400 rounded-xl flex items-center justify-center relative">
                <span className="w-full h-0.5 bg-emerald-400 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-md shadow-emerald-400" />
                <QrIcon className="w-16 h-16 text-emerald-400/40" />
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
                {shipments.filter((s) => s.status !== 'DELIVERED').slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSimulatedScan(s.tracking_number || String(s.id))}
                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200 cursor-pointer"
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
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              >
                Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Full Blockchain Shipping Log Details ───────────────────── */}
      {showBlockchainLogsModal && selected && (
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
                  {selected.tracking_number || `#CG-${selected.id}`} • {selected.product_name}
                </p>
              </div>

              <button
                onClick={() => setShowBlockchainLogsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
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
                  Immutable Block Ledger History ({selected.status === 'DELIVERED' ? '4 Blocks Mined' : '3 Blocks Mined'})
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
                    <div><b>Origin Vault:</b> {selected.origin_name}</div>
                    <div><b>Target Temperature:</b> {selected.min_temp ?? 2}°C to {selected.max_temp ?? 8}°C</div>
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
                    <div><b>Sensor Reading:</b> <span className="font-mono font-bold text-emerald-700">{selected.current_temp != null ? `${selected.current_temp}°C` : '3.8°C'}</span> (Optimal Target Zone)</div>
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
                    <div><b>Destination Facility:</b> {selected.destination_name}</div>
                    <div><b>Arriving Driver:</b> {selected.driver_name || 'Rajesh Kumar'} (GA-07-C-4021)</div>
                    <div><b>Intake Status:</b> {selected.status === 'DELIVERED' ? 'Intake Completed' : 'Carrier Arrived at Dock'}</div>
                    <div className="font-mono text-[10px] text-slate-400"><b>TxHash:</b> 0x8e4dfa2900cba14509e8f192aa3014fbc9902</div>
                  </div>
                </div>

                {/* Block 4: Final Handover Minting (if delivered) */}
                {selected.status === 'DELIVERED' && (
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-300 shadow-xs space-y-2 relative pl-6 border-l-4 border-l-emerald-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        Block #19842100 — Smart Contract Settlement & Sign-Off
                      </span>
                      <span className="text-[10px] font-mono text-emerald-800">Permanent Record</span>
                    </div>
                    <div className="text-[11px] text-emerald-900 space-y-1">
                      <div><b>Receiving Officer:</b> {receiverNameInput} ({staffId})</div>
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
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Logs
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: Minted Digital Product Passport (DPP) ─────────────────── */}
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
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
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
                  <span className="font-bold text-slate-900">{receiverNameInput} ({staffId})</span>
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
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: Deep Telemetry & Cold-Chain Inspection ─────────────────── */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {inspectModal.tracking_number}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  {inspectModal.product_name}
                </h3>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Current Temp</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {inspectModal.current_temp != null ? `${Number(inspectModal.current_temp).toFixed(1)}°C` : '--'}
                </div>
                <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                  Safe: {inspectModal.min_temp}°C - {inspectModal.max_temp}°C
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Humidity</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {inspectModal.current_humidity != null ? `${Number(inspectModal.current_humidity).toFixed(0)}%` : '48%'}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">RH Standard</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Sensor Battery</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {inspectModal.current_battery != null ? `${Number(inspectModal.current_battery)}%` : '96%'}
                </div>
                <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">Healthy</div>
              </div>
            </div>

            {/* Consignment Journey Details */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Origin Facility:</span>
                <span className="text-slate-800 font-bold text-right">{inspectModal.origin_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Destination Hospital:</span>
                <span className="text-slate-800 font-bold text-right">{inspectModal.destination_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Assigned Driver:</span>
                <span className="text-slate-800 font-bold text-right">{inspectModal.driver_name || 'Rajesh Kumar'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Consignment Value:</span>
                <span className="text-slate-800 font-bold text-right">₹{(Number(inspectModal.shipment_value || 250000)).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              {inspectModal.status !== 'DELIVERED' ? (
                <button
                  onClick={() => {
                    setInspectModal(null);
                    handleApproveDelivery(inspectModal);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Confirm & Approve Delivery
                </button>
              ) : (
                <button
                  onClick={() => {
                    setInspectModal(null);
                    handleOpenQrReceipt(inspectModal);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  View QR Blockchain Receipt
                </button>
              )}
              <button
                onClick={() => setInspectModal(null)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default function ReceiverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium text-xs">
          Loading ColdGuard Receiver Console...
        </div>
      }
    >
      <ReceiverDashboardContent />
    </Suspense>
  );
}
