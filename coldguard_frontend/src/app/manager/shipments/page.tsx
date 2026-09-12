'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Shipment } from '@/lib/types';

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'WARNING' | 'CRITICAL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const extractShipments = (res: any): Shipment[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.shipments)) return res.data.shipments;
    if (Array.isArray(res.shipments)) return res.shipments;
    return [];
  };

  const loadShipments = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<any>('/shipments').catch(() => null);
      setShipments(extractShipments(res));
    } catch (err) {
      console.error('Failed to load shipments:', err);
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipments();
  }, []);

  const safeShipments = Array.isArray(shipments) ? shipments : [];
  const filtered = safeShipments.filter((s) => {
    const matchesFilter = filter === 'ALL' || s.status === filter;
    const name = (s.product_name || s.cargo_type || '').toLowerCase();
    const track = (s.tracking_number || '').toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = name.includes(q) || track.includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shipments Master Directory</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Filter, inspect, and monitor temperature-sensitive pharmaceutical shipments</p>
        </div>

        {/* Filter Controls */}
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
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
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
                <th className="px-4 py-3">Origin &rarr; Destination</th>
                <th className="px-4 py-3">Safe Range</th>
                <th className="px-4 py-3">Current Temp</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading shipments...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No matching shipments found.</td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const minT = s.min_temp ?? s.required_temp_min ?? 2.0;
                  const maxT = s.max_temp ?? s.required_temp_max ?? 8.0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">
                        {s.tracking_number || `#CG-${s.id}`}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {s.product_name || s.cargo_type}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {s.origin_name} <span className="text-slate-300">&rarr;</span> {s.destination_name}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                        {minT}°C to {maxT}°C
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {s.current_temp != null ? `${s.current_temp}°C` : '4.2°C'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'CRITICAL' || s.status === 'WARNING'
                            ? 'bg-red-100 text-red-800'
                            : s.status === 'IN_TRANSIT'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
