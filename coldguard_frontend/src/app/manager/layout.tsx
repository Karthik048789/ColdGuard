'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ManagerNavbar from '@/components/common/ManagerNavbar';
import { getAuthToken } from '@/lib/api';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-700">Loading Manager Console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <ManagerNavbar />
      <main className="flex-1 max-w-[1500px] w-full mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
