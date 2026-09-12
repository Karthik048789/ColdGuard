'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch, getAuthUser, clearAuthSession } from '@/lib/api';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'home' | 'features' | 'api' | 'about' | 'contact'>('home');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [activeShipmentCount, setActiveShipmentCount] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiHealthData, setApiHealthData] = useState<any>(null);

  useEffect(() => {
    // Check local auth user
    const user = getAuthUser();
    if (user) setCurrentUser(user);

    // Call Health Check API from ColdGuard backend
    apiFetch<any>('/health')
      .then((data) => {
        setBackendStatus('online');
        setApiHealthData(data);
      })
      .catch((err) => {
        console.warn('Backend check:', err);
        setBackendStatus('offline');
      });

    // Optionally check shipments count if available
    apiFetch<any>('/shipments')
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setActiveShipmentCount(res.data.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  return (
    <div className=" min-h-screen bg-white flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans\>
 
 {/* Top Navigation Bar */}
 <header className=\w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between z-30\>
 {/* Brand Logo */}
 <Link href=\/\ className=\flex items-center gap-3 group\>
 <div className=\w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform\>
 <svg className=\w-6 h-6\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2.5}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M12 4v16m8-8H4\ />
 </svg>
 </div>
 <div className=\flex flex-col\>
 <span className=\text-xl font-black tracking-tight text-slate-900 leading-tight\>
 COLD<span className=\text-blue-600\>GUARD</span>
 </span>
 <span className=\text-[9px] font-bold tracking-widest text-slate-400 uppercase\>Life Delivered</span>
 </div>
 </Link>

 {/* Center Nav Links */}
 <nav className=\hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600\>
 <button
 onClick={() => setActiveTab('home')}
 className={ ransition-colors relative py-1 }
 >
 Home
 {activeTab === 'home' && (
 <span className=\absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full animate-in fade-in duration-200\ />
 )}
 </button>
 <a
 href=\#features\
 onClick={() => setActiveTab('features')}
 className={ ransition-colors py-1 }
 >
 Features
 </a>
 <button
 onClick={() => {
 setActiveTab('api');
 setShowApiModal(true);
 }}
 className={ ransition-colors py-1 flex items-center gap-1.5 }
 >
 API
 <span className=\w-2 h-2 rounded-full bg-emerald-500 animate-pulse\ title=\API Live\ />
 </button>
 <a
 href=\#about\
 onClick={() => setActiveTab('about')}
 className={ ransition-colors py-1 }
 >
 About
 </a>
 <a
 href=\#contact\
 onClick={() => setActiveTab('contact')}
 className={ ransition-colors py-1 }
 >
 Contact
 </a>
 </nav>

 {/* Right Auth / Portal Controls */}
 <div className=\flex items-center gap-3\>
 {currentUser ? (
 <div className=\flex items-center gap-3\>
 <Link
 href={currentUser.role === 'manager' ? '/manager' : currentUser.role === 'driver' ? '/driver' : '/receiver'}
 className=\px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200/60\
 >
 Go to {currentUser.role?.toUpperCase()} &rarr;
 </Link>
 <button
 onClick={handleLogout}
 className=\px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors\
 >
 Sign Out
 </button>
 </div>
 ) : (
 <>
 <Link
 href=\/login\
 className=\px-5 py-2 rounded-xl text-sm font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 transition-all shadow-sm\
 >
 Login
 </Link>
 <button
 onClick={() => setShowRoleModal(true)}
 className=\px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all\
 >
 Sign Up
 </button>
 </>
 )}
 </div>
 </header>

 {/* Main Hero Section */}
 <main className=\relative flex-1 w-full overflow-hidden\>
 {/* Background Map & Graphic Overlay */}
 <div className=\absolute top-0 right-0 w-full lg:w-[65%] h-[550px] sm:h-[650px] z-0 pointer-events-none select-none opacity-90\>
 <div className=\relative w-full h-full\>
 {/* Real Truck Image */}
 <Image
 src=\/hero-truck.jpg\
 alt=\Cold Chain Logistics Truck\
 fill
 priority
 className=\object-cover object-right-bottom sm:object-contain sm:object-right\
 />
 {/* Gradient mask to blend smoothly into white background */}
 <div className=\absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent w-full sm:w-[60%]\ />
 <div className=\absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent\ />
 </div>
 </div>

 {/* Content Container */}
 <div className=\relative z-10 max-w-7xl mx-auto px-6 sm:px-10 pt-8 sm:pt-16 pb-20\>
 <div className=\max-w-xl\>
 {/* Top Category Tag */}
 <div className=\flex items-center gap-2 mb-3\>
 <span className=\text-xs font-black tracking-[0.2em] text-slate-400 uppercase\>
 Cold Chain Logistics
 </span>
 <span className=\h-1 w-1 rounded-full bg-blue-500\ />
 <span className=\text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60\>
 <span className=\w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse\ />
 {backendStatus === 'online' ? 'Engine Online' : 'Connecting Engine...'}
 </span>
 </div>

 {/* Bold Hero Title */}
 <h1 className=\text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.08]\>
 Temperature Controlled.<br />
 <span className=\text-blue-600\>Life Delivered.</span>
 </h1>

 {/* Subtitle Description */}
 <p className=\mt-6 text-base sm:text-lg text-slate-500 font-normal leading-relaxed max-w-lg\>
 Reliable truck transport for temperature-sensitive medicines and vaccines, with real-time tracking and intelligent logistics &mdash; across the country.
 </p>

 {/* CTA Button Group */}
 <div className=\mt-8 flex flex-wrap items-center gap-4\>
 <button
 onClick={() => setShowRoleModal(true)}
 className=\inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all hover:gap-3 cursor-pointer\
 >
 <span>Get Started</span>
 <svg className=\w-4 h-4\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2.5}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M14 5l7 7m0 0l-7 7m7-7H3\ />
 </svg>
 </button>

 <button
 onClick={() => setShowApiModal(true)}
 className=\inline-flex items-center gap-2 px-5 py-3.5 rounded-xl font-bold text-sm text-slate-700 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all cursor-pointer shadow-sm\
 >
 <svg className=\w-4 h-4 text-blue-600\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4\ />
 </svg>
 <span>Explore 27 APIs</span>
 </button>
 </div>

 {/* 4 Feature Badges at Bottom Left */}
 <div id=\features\ className=\grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-16 sm:mt-24 pt-8 border-t border-slate-100\>
 {/* Feature 1: Real-time Monitoring */}
 <div className=\flex flex-col gap-2 group cursor-default\>
 <div className=\w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform\>
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z\ />
 </svg>
 </div>
 <h4 className=\text-xs font-bold text-slate-900 leading-snug\>Real-time Monitoring</h4>
 <p className=\text-[11px] text-slate-400 leading-relaxed\>Track temperature and location live.</p>
 </div>

 {/* Feature 2: Secure Delivery */}
 <div className=\flex flex-col gap-2 group cursor-default\>
 <div className=\w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform\>
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z\ />
 </svg>
 </div>
 <h4 className=\text-xs font-bold text-slate-900 leading-snug\>Secure Delivery</h4>
 <p className=\text-[11px] text-slate-400 leading-relaxed\>Maintain cold chain integrity at every step.</p>
 </div>

 {/* Feature 3: Optimized Routes */}
 <div className=\flex flex-col gap-2 group cursor-default\>
 <div className=\w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform\>
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7\ />
 </svg>
 </div>
 <h4 className=\text-xs font-bold text-slate-900 leading-snug\>Optimized Routes</h4>
 <p className=\text-[11px] text-slate-400 leading-relaxed\>Faster, safer delivery across regions.</p>
 </div>

 {/* Feature 4: Powerful APIs */}
 <div
 onClick={() => setShowApiModal(true)}
 className=\flex flex-col gap-2 group cursor-pointer hover:opacity-80 transition-opacity\
 >
 <div className=\w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform\>
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4\ />
 </svg>
 </div>
 <h4 className=\text-xs font-bold text-blue-600 leading-snug flex items-center gap-1\>
 Powerful APIs &rarr;
 </h4>
 <p className=\text-[11px] text-slate-400 leading-relaxed\>Integrate with your systems seamlessly.</p>
 </div>
 </div>
 </div>
 </div>

 {/* Floating Quote in Bottom Right */}
 <div className=\hidden lg:block absolute bottom-8 right-12 z-20 pointer-events-none text-right\>
 <p className=\text-xs italic text-slate-400 tracking-wide\>
 &ldquo;Every dose matters.<br />
 <span className=\text-slate-600 font-semibold\>We move what keeps lives going.</span>&rdquo;
 </p>
 </div>
 </main>

 {/* About & Contact Section */}
 <section id=\about\ className=\border-t border-slate-100 bg-slate-50/60 py-16 px-6 sm:px-10\>
 <div className=\max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10\>
 <div className=\flex flex-col gap-3\>
 <h3 className=\text-sm font-black text-slate-900 uppercase tracking-widest\>Mission Critical Guard</h3>
 <p className=\text-xs text-slate-500 leading-relaxed\>
 ColdGuard AI utilizes state-of-the-art telemetry ingestion, deterministic risk evaluation, and emergency cold-facility diversion routing powered by OpenStreetMap OSRM.
 </p>
 </div>

 <div id=\contact\ className=\flex flex-col gap-3\>
 <h3 className=\text-sm font-black text-slate-900 uppercase tracking-widest\>Contact Logistics Support</h3>
 <p className=\text-xs text-slate-500 leading-relaxed\>
 HQ Logistics Support: <span className=\font-bold text-blue-600\>support@coldguard.ai</span><br />
 Emergency Cold Storage Hotline: <span className=\font-bold text-slate-700\>+91 98765 43210</span>
 </p>
 </div>

 <div className=\flex flex-col gap-3\>
 <h3 className=\text-sm font-black text-slate-900 uppercase tracking-widest\>Backend Engine Status</h3>
 <div className=\p-4 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col gap-2\>
 <div className=\flex items-center justify-between text-xs\>
 <span className=\text-slate-500\>Engine URL:</span>
 <span className=\font-mono font-bold text-blue-600 text-[10px] truncate max-w-[170px]\>
 coldguard-backend.onrender.com
 </span>
 </div>
 <div className=\flex items-center justify-between text-xs\>
 <span className=\text-slate-500\>Health Status:</span>
 <span className=\inline-flex items-center gap-1 font-bold text-emerald-600\>
 <span className=\w-2 h-2 rounded-full bg-emerald-500 animate-ping\ />
 {backendStatus === 'online' ? '200 OK' : 'Checking...'}
 </span>
 </div>
 {apiHealthData && (
 <div className=\text-[10px] font-mono text-slate-400 mt-1 border-t pt-1 border-slate-100\>
 Service: {apiHealthData.service}
 </div>
 )}
 </div>
 </div>
 </div>
 </section>

 {/* Role Selection Modal (Triggered by Get Started / Sign Up) */}
 {showRoleModal && (
 <div className=\fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200\>
 <div className=\bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200\>
 <button
 onClick={() => setShowRoleModal(false)}
 className=\absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors\
 >
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M6 18L18 6M6 6l12 12\ />
 </svg>
 </button>

 <div className=\text-center mb-6\>
 <div className=\w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3\>
 <svg className=\w-6 h-6\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2.5}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M12 4v16m8-8H4\ />
 </svg>
 </div>
 <h3 className=\text-xl font-black text-slate-900\>Select Your Portal</h3>
 <p className=\text-xs text-slate-500 mt-1\>
 Log in or launch directly into role-specific workflows.
 </p>
 </div>

 <div className=\flex flex-col gap-3\>
 <Link
 href=\/manager\
 onClick={() => setShowRoleModal(false)}
 className=\p-4 rounded-2xl border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between group transition-all\
 >
 <div className=\flex items-center gap-3\>
 <div className=\w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold\>
 M
 </div>
 <div>
 <h4 className=\text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors\>
 Logistics Manager
 </h4>
 <p className=\text-[11px] text-slate-400\>Fleet map, excursion alerts, facility directory</p>
 </div>
 </div>
 <span className=\text-blue-600 font-bold text-sm group-hover:translate-x-1 transition-transform\>&rarr;</span>
 </Link>

 <Link
 href=\/driver\
 onClick={() => setShowRoleModal(false)}
 className=\p-4 rounded-2xl border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between group transition-all\
 >
 <div className=\flex items-center gap-3\>
 <div className=\w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold\>
 D
 </div>
 <div>
 <h4 className=\text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors\>
 Transport Driver
 </h4>
 <p className=\text-[11px] text-slate-400\>Live turn guidance, GPS & temp simulation</p>
 </div>
 </div>
 <span className=\text-blue-600 font-bold text-sm group-hover:translate-x-1 transition-transform\>&rarr;</span>
 </Link>

 <Link
 href=\/receiver\
 onClick={() => setShowRoleModal(false)}
 className=\p-4 rounded-2xl border border-slate-200/80 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between group transition-all\
 >
 <div className=\flex items-center gap-3\>
 <div className=\w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold\>
 R
 </div>
 <div>
 <h4 className=\text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors\>
 Hospital / Receiver
 </h4>
 <p className=\text-[11px] text-slate-400\>Shipment tracking & cold-chain compliance</p>
 </div>
 </div>
 <span className=\text-blue-600 font-bold text-sm group-hover:translate-x-1 transition-transform\>&rarr;</span>
 </Link>
 </div>

 <div className=\mt-6 pt-4 border-t border-slate-100 text-center\>
 <Link
 href=\/login\
 onClick={() => setShowRoleModal(false)}
 className=\text-xs font-bold text-blue-600 hover:underline\
 >
 Already have credentials? Sign In here &rarr;
 </Link>
 </div>
 </div>
 </div>
 )}

 {/* API Explorer Modal (27 Endpoints from ColdGuard_API_Documentation.xlsx) */}
 {showApiModal && (
 <div className=\fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200\>
 <div className=\bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 relative animate-in zoom-in-95 duration-200\>
 {/* Header */}
 <div className=\p-6 border-b border-slate-100 flex items-center justify-between\>
 <div className=\flex items-center gap-3\>
 <div className=\w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold\>
 &lt;/&gt;
 </div>
 <div>
 <h3 className=\text-lg font-black text-slate-900\>ColdGuard API Engine (27 Endpoints)</h3>
 <p className=\text-xs text-slate-400 font-mono\>Base URL: https://coldguard-backend.onrender.com/api</p>
 </div>
 </div>
 <button
 onClick={() => setShowApiModal(false)}
 className=\text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors\
 >
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M6 18L18 6M6 6l12 12\ />
 </svg>
 </button>
 </div>

 {/* Endpoints Scrollable Body */}
 <div className=\p-6 overflow-y-auto space-y-3 font-mono text-xs\>
 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold\>GET</span>
 <span className=\font-bold text-slate-800\>/health</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Backend health verification</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold\>POST</span>
 <span className=\font-bold text-slate-800\>/auth/login</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Issue Bearer Sanctum token</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold\>GET</span>
 <span className=\font-bold text-slate-800\>/shipments</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>List all shipments</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold\>POST</span>
 <span className=\font-bold text-slate-800\>/shipments</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Create temperature-controlled shipment</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-bold\>POST</span>
 <span className=\font-bold text-slate-800\>/shipments/&#123;id&#125;/telemetry/simulate</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Simulate GPS & temp excursions</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold\>GET</span>
 <span className=\font-bold text-slate-800\>/shipments/&#123;id&#125;/route</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Dynamic OSRM route & ETA calculation</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold\>GET</span>
 <span className=\font-bold text-slate-800\>/shipments/&#123;id&#125;/intervention</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Active emergency diversion details</span>
 </div>

 <div className=\p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between\>
 <div className=\flex items-center gap-2\>
 <span className=\px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold\>GET</span>
 <span className=\font-bold text-slate-800\>/facilities</span>
 </div>
 <span className=\text-slate-500 font-sans text-[11px]\>Cold-storage facilities directory</span>
 </div>
 </div>

 {/* Footer */}
 <div className=\p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between rounded-b-3xl\>
 <span className=\text-xs text-slate-500 font-sans\>
 Full documentation documented in <span className=\font-mono font-bold\>ColdGuard_API_Documentation.xlsx</span>
 </span>
 <button
 onClick={() => setShowApiModal(false)}
 className=\px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors\
 >
 Close
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Modern Footer */}
 <footer className=\border-t border-slate-100 bg-white py-6 px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3\>
 <div className=\flex items-center gap-2\>
 <span className=\font-bold text-slate-700\>ColdGuard AI</span>
 <span>&bull;</span>
 <span>Pharma Cold-Chain Logistics</span>
 </div>
 <div>
 Connected to Render Production API &bull; Base URL: <code className=\text-blue-600 font-mono\>coldguard-backend.onrender.com</code>
 </div>
 </footer>
 </div>
 );
}
