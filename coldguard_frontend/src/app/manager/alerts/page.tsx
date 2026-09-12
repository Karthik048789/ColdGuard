'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const extractAlerts = (res: any): any[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    return [];
  };

  const loadAlerts = async () => {
    try {
      setLoading(true);
      // Fetch alerts for active shipments
      const res = await apiFetch<any>('/shipments/1/alerts?role=MANAGER').catch(() => null);
      setAlerts(extractAlerts(res));
    } catch (err) {
      console.error('Failed to load alerts:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleAcknowledge = async (interventionId: number) => {
    try {
      await apiFetch<any>(`/interventions/${interventionId}/acknowledge`, { method: 'POST' });
      loadAlerts();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge alert');
    }
  };

  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">HQ Emergency Interventions & Alerts</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">Role-specific incident alerts generated during temperature excursions</p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading alerts feed...</div>
        ) : safeAlerts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-xs font-medium border border-slate-200/80">
            No active emergency alerts recorded.
          </div>
        ) : (
          safeAlerts.map((a) => (
            <div key={a.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    a.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {a.severity || 'ALERT'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : 'Recent'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{a.title || 'Temperature Warning'}</h3>
                <p className="text-xs text-slate-500">{a.message || 'Anomaly detected'}</p>
              </div>

              {a.intervention_id && (
                <button
                  onClick={() => handleAcknowledge(a.intervention_id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shrink-0"
                >
                  Acknowledge
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
