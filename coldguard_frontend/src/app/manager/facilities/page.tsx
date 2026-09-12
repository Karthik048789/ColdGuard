'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Facility } from '@/lib/types';

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  const extractFacilities = (res: any): Facility[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    return [];
  };

  useEffect(() => {
    apiFetch<any>('/facilities')
      .then((res) => {
        setFacilities(extractFacilities(res));
      })
      .catch((err) => {
        console.error('Failed to load facilities:', err);
        setFacilities([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const safeFacilities = Array.isArray(facilities) ? facilities : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cold-Storage Facilities Directory</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">Certified emergency cold storage hubs for autonomous route diversions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-slate-400">Loading cold-storage facilities...</div>
        ) : safeFacilities.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-400">No facilities registered.</div>
        ) : (
          safeFacilities.map((f) => (
            <div key={f.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200/60 uppercase">
                    {f.type || 'Emergency Hub'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                    {f.status || 'OPERATIONAL'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{f.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Lat: {f.latitude}, Lng: {f.longitude}
                </p>
              </div>

              <div className="space-y-2 border-t pt-3 border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Temp Range:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {(f as any).min_temp_celsius ?? (f as any).temp_min ?? 2.0}°C to {(f as any).max_temp_celsius ?? (f as any).temp_max ?? 8.0}°C
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Available Capacity:</span>
                  <span className="font-bold text-emerald-600">{f.available_capacity ?? (f.capacity ? f.capacity - 100 : 800)} / {f.capacity || 1000} units</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
