'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken, getAuthUser, clearAuthSession } from '@/lib/api';
import { ShieldCheck, LogOut, Building2, UserCheck, QrCode } from 'lucide-react';

export default function ReceiverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
    } else {
      const u = getAuthUser();
      setUser(u);
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-700">Loading Receiver Verification Portal...</span>
        </div>
      </div>
    );
  }

  const receiverName = user?.name || 'Dr. Priya Deshmukh';
  const hospitalName = user?.facility_name || 'South Goa District Hospital (GMC)';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Dedicated Receiver & Intake Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          
          {/* Left: Brand Logo & Role Tag */}
          <div className="flex items-center gap-3">
            <Link href="/receiver" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-slate-900 tracking-tight leading-none">
                  COLDGUARD <span className="text-emerald-600">INTAKE</span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
                  Verified Receiver Portal
                </span>
              </div>
            </Link>

            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200/80 uppercase tracking-wider ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Blockchain Proof-of-Delivery
            </span>
          </div>

          {/* Right: Hospital Identity & Receiver Profile */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-700 text-xs font-semibold">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[200px]">{hospitalName}</span>
            </div>

            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">
                {receiverName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-tight">{receiverName}</span>
                <span className="text-[10px] font-medium text-emerald-600">Authorized Receiver</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
