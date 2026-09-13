'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Shipment } from '@/lib/types';
import QRCode from 'qrcode';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://coldguard-backend.onrender.com/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BlockchainBlock {
  block_index: number;
  event_type: 'JOURNEY_STARTED' | 'TELEMETRY_OK' | 'TEMP_BREACH' | 'REROUTE' | 'DELIVERY_CONFIRMED';
  payload: Record<string, any>;
  previous_hash: string;
  block_hash: string;
  timestamp: string;
}

interface BlockchainLog {
  success: boolean;
  chain_valid: boolean;
  total_blocks: number;
  ledger: BlockchainBlock[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  JOURNEY_STARTED:    { icon: '🚀', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    label: 'Journey Started' },
  TELEMETRY_OK:       { icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'Telemetry OK' },
  TEMP_BREACH:        { icon: '🌡️', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       label: 'Temperature Breach' },
  REROUTE:            { icon: '🔀', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   label: 'Rerouted' },
  DELIVERY_CONFIRMED: { icon: '📦', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', label: 'Delivery Confirmed' },
};

function extractShipments(res: any): Shipment[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.shipments)) return res.data.shipments;
  if (Array.isArray(res.shipments)) return res.shipments;
  return [];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Blockchain modal state
  const [chainModal, setChainModal] = useState<{ open: boolean; shipmentId: number | null; log: BlockchainLog | null; loading: boolean }>({
    open: false, shipmentId: null, log: null, loading: false,
  });
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [receiptToken, setReceiptToken] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<any>('/shipments').catch(() => null);
      setShipments(extractShipments(res));
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadShipments(); }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ── Open blockchain log modal ────────────────────────────────────────────────
  const openChainLog = async (shipmentId: number) => {
    setChainModal({ open: true, shipmentId, log: null, loading: true });
    try {
      const res = await apiFetch<BlockchainLog>(`/blockchain/${shipmentId}/logs`);
      setChainModal({ open: true, shipmentId, log: res, loading: false });
    } catch {
      setChainModal({ open: true, shipmentId, log: null, loading: false });
    }
  };

  // ── Confirm delivery & generate QR ──────────────────────────────────────────
  const handleConfirmDelivery = async (shipmentId: number) => {
    setConfirmingId(shipmentId);
    try {
      const res = await apiFetch<any>(`/blockchain/${shipmentId}/confirm-delivery`, {
        method: 'POST',
        body: JSON.stringify({ confirmed_by: 'manager' }),
      });
      const token: string = res.receipt_token;
      setReceiptToken(token);

      // Generate QR code pointing to receiver page
      const url = `${window.location.origin}/receiver?token=${token}`;
      const qr = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1e293b', light: '#f8fafc' } });
      setQrDataUrl(qr);

      // Reload shipments to reflect DELIVERED status
      await loadShipments();
      showToast('✅ Delivery confirmed! QR code generated.');
    } catch (e: any) {
      showToast('❌ ' + (e.message || 'Failed to confirm delivery'));
    } finally {
      setConfirmingId(null);
    }
  };

  const safeShipments = Array.isArray(shipments) ? shipments : [];
  const filtered = safeShipments.filter((s) => {
    const matchesFilter = filter === 'ALL' || s.status === filter;
    const name = (s.product_name || '').toLowerCase();
    const track = (s.tracking_number || '').toLowerCase();
    const q = search.toLowerCase();
    return matchesFilter && (name.includes(q) || track.includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: '#0f172a', color: '#fff', padding: '12px 20px',
          borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'fadeInDown 0.3s ease',
        }}>
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shipments Master Directory</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Filter, inspect, and monitor temperature-sensitive pharmaceutical shipments</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search cargo or tracking..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-600 bg-white"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="CREATED">Created</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
            <option value="REROUTED">Rerouted</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Tracking Number</th>
                <th className="px-4 py-3">Cargo Type</th>
                <th className="px-4 py-3">Origin → Destination</th>
                <th className="px-4 py-3">Safe Range</th>
                <th className="px-4 py-3">Current Temp</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading shipments...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No matching shipments found.</td></tr>
              ) : (
                filtered.map((s) => {
                  const minT = s.min_temp ?? 2.0;
                  const maxT = s.max_temp ?? 8.0;
                  const isDelivered = s.status === 'DELIVERED';
                  const canConfirm = ['IN_TRANSIT', 'REROUTED', 'AT_COLD_STORAGE', 'WARNING', 'CRITICAL'].includes(s.status);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{s.tracking_number || `#CG-${s.id}`}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{s.product_name}</td>
                      <td className="px-4 py-3 text-slate-500">{s.origin_name} <span className="text-slate-300">→</span> {s.destination_name}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-700">{minT}°C – {maxT}°C</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {s.current_temp != null ? `${s.current_temp}°C` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isDelivered ? 'bg-emerald-100 text-emerald-800' :
                          s.status === 'CRITICAL' || s.status === 'WARNING' ? 'bg-red-100 text-red-800' :
                          s.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' :
                          s.status === 'REROUTED' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* View blockchain log */}
                          <button
                            onClick={() => openChainLog(s.id)}
                            title="View Blockchain Log"
                            style={{
                              padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                              color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            ⛓ Chain Log
                          </button>

                          {/* Confirm delivery */}
                          {canConfirm && (
                            <button
                              onClick={() => handleConfirmDelivery(s.id)}
                              disabled={confirmingId === s.id}
                              title="Confirm Delivery & Generate QR"
                              style={{
                                padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                                background: confirmingId === s.id ? '#94a3b8' : 'linear-gradient(135deg,#10b981,#059669)',
                                color: '#fff', border: 'none', cursor: confirmingId === s.id ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {confirmingId === s.id ? '...' : '✓ Deliver'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── QR Code Modal ─────────────────────────────────────────────────────── */}
      {qrDataUrl && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '40px 48px',
            maxWidth: 420, width: '90%', textAlign: 'center', boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Delivery Confirmed!</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>
              Blockchain record sealed. Share this QR with the receiver.
            </p>
            <img src={qrDataUrl} alt="Receipt QR" style={{ width: 240, height: 240, margin: '0 auto 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
            <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 24 }}>
              Token: {receiptToken}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href={`/receiver?token=${receiptToken}`} target="_blank" rel="noreferrer" style={{
                padding: '10px 20px', borderRadius: 10, background: '#6366f1', color: '#fff',
                fontWeight: 700, fontSize: 12, textDecoration: 'none',
              }}>
                Preview Receipt →
              </a>
              <button onClick={() => { setQrDataUrl(null); setReceiptToken(null); }} style={{
                padding: '10px 20px', borderRadius: 10, background: '#f1f5f9', color: '#475569',
                fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer',
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Blockchain Log Modal ───────────────────────────────────────────────── */}
      {chainModal.open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: '#0f172a', borderRadius: 24, padding: '32px',
            width: '90%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5)', color: '#f8fafc',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  ⛓ Blockchain Ledger
                </h2>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                  Shipment #{chainModal.shipmentId} — Immutable Cold-Chain Record
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {chainModal.log && (
                  <span style={{
                    padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: chainModal.log.chain_valid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: chainModal.log.chain_valid ? '#10b981' : '#ef4444',
                    border: `1px solid ${chainModal.log.chain_valid ? '#10b981' : '#ef4444'}`,
                  }}>
                    {chainModal.log.chain_valid ? '✅ Chain Valid' : '❌ TAMPERED'}
                  </span>
                )}
                <button onClick={() => setChainModal({ open: false, shipmentId: null, log: null, loading: false })}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}>
                  ✕ Close
                </button>
              </div>
            </div>

            {chainModal.loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
                Loading blockchain data...
              </div>
            ) : !chainModal.log ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>
                No blockchain records found for this shipment yet.
                <p style={{ fontSize: 12, marginTop: 8 }}>Dispatch the shipment to begin recording.</p>
              </div>
            ) : (
              <>
                {/* Stats bar */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  {[
                    { label: 'Total Blocks', value: chainModal.log.total_blocks },
                    { label: 'Breaches', value: chainModal.log.ledger.filter(b => b.event_type === 'TEMP_BREACH').length },
                    { label: 'Reroutes', value: chainModal.log.ledger.filter(b => b.event_type === 'REROUTE').length },
                    { label: 'Status', value: chainModal.log.chain_valid ? 'VALID' : 'TAMPERED' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 12,
                      padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc' }}>{stat.value}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Block timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {chainModal.log.ledger.map((block) => {
                    const cfg = EVENT_CONFIG[block.event_type] || { icon: '📝', color: 'text-slate-500', bg: '', label: block.event_type };
                    return (
                      <div key={block.block_index} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 16, flexShrink: 0,
                            background: block.event_type === 'TEMP_BREACH' ? 'rgba(239,68,68,0.15)' :
                                        block.event_type === 'JOURNEY_STARTED' ? 'rgba(99,102,241,0.15)' :
                                        block.event_type === 'DELIVERY_CONFIRMED' ? 'rgba(168,85,247,0.15)' :
                                        block.event_type === 'REROUTE' ? 'rgba(245,158,11,0.15)' :
                                        'rgba(16,185,129,0.15)',
                          }}>
                            {cfg.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc' }}>{cfg.label}</span>
                              <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>Block #{block.block_index}</span>
                              <span style={{ fontSize: 9, color: '#64748b' }}>{new Date(block.timestamp).toLocaleString()}</span>
                            </div>

                            {/* Payload preview */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {Object.entries(block.payload).slice(0, 6).map(([k, v]) => (
                                <span key={k} style={{
                                  padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                                  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                                  fontFamily: 'monospace',
                                }}>
                                  {k}: <span style={{ color: '#e2e8f0' }}>{typeof v === 'number' ? v.toFixed ? v.toFixed(2) : v : String(v)}</span>
                                </span>
                              ))}
                            </div>

                            {/* Hash preview */}
                            <div style={{ marginTop: 6, fontSize: 9, fontFamily: 'monospace', color: '#475569' }}>
                              <span style={{ color: '#334155' }}>hash:</span> {block.block_hash.slice(0, 32)}…
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
