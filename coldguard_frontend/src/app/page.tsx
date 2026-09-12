import Link from 'next/link';

export default function HomePage() {
  return (
    <div className=" min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-red-500 selection:text-white\>
 {/* Navigation Header */}
 <header className=\border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50\>
 <div className=\max-w-7xl mx-auto px-6 h-16 flex items-center justify-between\>
 <div className=\flex items-center gap-3\>
 <div className=\w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold shadow-md shadow-red-500/20\>
 <svg className=\w-5 h-5\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2.5}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M12 4v16m8-8H4\ />
 </svg>
 </div>
 <div>
 <span className=\text-lg font-black tracking-tight text-slate-900\>COLD<span className=\text-red-600\>GUARD</span></span>
 <span className=\text-[10px] font-semibold tracking-widest text-blue-600 ml-1 uppercase block -mt-1\>Pharma Cold Chain</span>
 </div>
 </div>

 <div className=\flex items-center gap-4\>
 <Link
 href=\/login\
 className=\px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50/50 transition-all\
 >
 Sign In
 </Link>
 <Link
 href=\/manager\
 className=\px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 transition-all\
 >
 Live Console
 </Link>
 </div>
 </div>
 </header>

 {/* Hero Section */}
 <main className=\flex-1 max-w-7xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center\>
 <div className=\inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200/60 text-red-700 text-xs font-semibold mb-6 animate-pulse\>
 <span className=\w-2 h-2 rounded-full bg-red-600\></span>
 Autonomous Bio-Pharma Cold-Chain Protection
 </div>

 <h1 className=\text-4xl sm:text-6xl font-black tracking-tight text-slate-900 max-w-4xl leading-tight\>
 Autonomous Temperature & Logistics Guard for <span className=\text-red-600\>Critical Vaccines</span>
 </h1>

 <p className=\mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl font-normal leading-relaxed\>
 Real-time IoT telemetry, AI excursion risk prediction, and instant OSRM emergency rerouting to certified cold-storage facilities.
 </p>

 {/* Modular Role Cards */}
 <div className=\grid grid-cols-1 md:grid-cols-3 gap-6 mt-14 w-full max-w-5xl text-left\>
 {/* Manager Role Card */}
 <Link
 href=\/manager\
 className=\group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-red-300 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden\
 >
 <div className=\absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all\ />
 <div className=\w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 font-bold mb-5 group-hover:scale-110 transition-transform\>
 <svg className=\w-6 h-6\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z\ />
 </svg>
 </div>
 <div className=\flex items-center justify-between\>
 <h3 className=\text-lg font-bold text-slate-900 group-hover:text-red-600 transition-colors\>Manager Module</h3>
 <span className=\text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600\>HQ Portal</span>
 </div>
 <p className=\mt-2 text-sm text-slate-500 leading-relaxed\>
 Fleet-wide tracking, predictive risk heatmaps, cold-facility inventory, and incident resolution.
 </p>
 <div className=\mt-5 flex items-center text-sm font-semibold text-red-600 group-hover:translate-x-1 transition-transform\>
 Launch Manager Console &rarr;
 </div>
 </Link>

 {/* Driver Role Card */}
 <Link
 href=\/driver\
 className=\group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden\
 >
 <div className=\absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all\ />
 <div className=\w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold mb-5 group-hover:scale-110 transition-transform\>
 <svg className=\w-6 h-6\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7\ />
 </svg>
 </div>
 <div className=\flex items-center justify-between\>
 <h3 className=\text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors\>Driver Module</h3>
 <span className=\text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600\>Mobile HUD</span>
 </div>
 <p className=\mt-2 text-sm text-slate-500 leading-relaxed\>
 Turn-by-turn navigation, live temperature breach alerts, and built-in telemetry simulation.
 </p>
 <div className=\mt-5 flex items-center text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform\>
 Launch Driver HUD &rarr;
 </div>
 </Link>

 {/* Receiver Role Card */}
 <Link
 href=\/receiver\
 className=\group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden\
 >
 <div className=\absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all\ />
 <div className=\w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold mb-5 group-hover:scale-110 transition-transform\>
 <svg className=\w-6 h-6\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z\ />
 </svg>
 </div>
 <div className=\flex items-center justify-between\>
 <h3 className=\text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors\>Receiver Module</h3>
 <span className=\text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600\>Clinic View</span>
 </div>
 <p className=\mt-2 text-sm text-slate-500 leading-relaxed\>
 Delivery countdown, cold-chain integrity verification passport, and route diversion notices.
 </p>
 <div className=\mt-5 flex items-center text-sm font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform\>
 Track Incoming Cargo &rarr;
 </div>
 </Link>
 </div>
 </main>

 {/* Footer */}
 <footer className=\border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500\>
 ColdGuard AI &copy; 2026 &bull; High-Integrity Medical Cold-Chain System &bull; Connected to Laravel Engine
 </footer>
 </div>
 );
}
