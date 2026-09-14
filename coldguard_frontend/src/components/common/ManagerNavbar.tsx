'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuthSession, getAuthUser } from '@/lib/api';

export default function ManagerNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getAuthUser();

  const handleLogout = () => {
    clearAuthSession();
    router.push('/');
  };

  const navItems = [
    { name: 'Dashboard Overview', path: '/manager' },
    { name: 'Shipments', path: '/manager/shipments' },
    { name: 'Facilities Directory', path: '/manager/facilities' },
    { name: 'Receiver Intake', path: '/receiver' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand Logo & Role Tag */}
        <div className="flex items-center gap-6">
          <Link href="/manager" className="flex items-center gap-3">
            <Image
              src="/logo-transparent.png"
              alt="ColdGuard Logo"
              width={36}
              height={36}
              className="object-contain"
            />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                COLD<span className="text-blue-600">GUARD</span>
              </span>
              <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">Logistics Manager Console</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 border border-blue-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: User Badge & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {user?.name?.[0] || 'M'}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900 leading-none">{user?.name || 'Logistics Manager'}</span>
              <span className="text-[10px] text-slate-400 font-semibold leading-none mt-0.5">Manager HQ</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
          >
            Logout
          </button>
        </div>

      </div>
    </header>
  );
}
