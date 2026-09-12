'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch, setAuthSession } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('manager@coldguard.ai');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response?.data?.token && response?.data?.user) {
        setAuthSession(response.data.token, response.data.user);
        const role = response.data.user.role;
        if (role === 'driver') {
          router.push('/driver');
        } else if (role === 'receiver') {
          router.push('/receiver');
        } else {
          router.push('/manager');
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials or API status.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: 'manager' | 'driver' | 'receiver') => {
    setEmail(${role}@coldguard.ai);
    setPassword('password123');
  };

  return (
    <div className=" min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 selection:bg-blue-600 selection:text-white\>
 <div className=\w-full max-w-md bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl shadow-slate-200/50\>
 
 {/* Brand Header */}
 <div className=\text-center mb-6\>
 <Link href=\/\ className=\inline-flex items-center gap-2 mb-3\>
 <div className=\w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20\>
 <svg className=\w-6 h-6\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\ strokeWidth={2.5}>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ d=\M12 4v16m8-8H4\ />
 </svg>
 </div>
 <span className=\text-xl font-black tracking-tight text-slate-900\>
 COLD<span className=\text-blue-600\>GUARD</span>
 </span>
 </Link>
 <h2 className=\text-xl font-black text-slate-900\>Welcome Back</h2>
 <p className=\text-xs text-slate-500 mt-1\>
 Sign in to access your cold-chain logistics console.
 </p>
 </div>

 {error && (
 <div className=\mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2\>
 <svg className=\w-4 h-4 shrink-0\ fill=\none\ viewBox=\0 0 24 24\ stroke=\currentColor\>
 <path strokeLinecap=\round\ strokeLinejoin=\round\ strokeWidth={2} d=\M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z\ />
 </svg>
 <span>{error}</span>
 </div>
 )}

 {/* Quick Credentials Buttons */}
 <div className=\mb-5\>
 <span className=\text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2\>
 Quick Fill Demo Accounts
 </span>
 <div className=\grid grid-cols-3 gap-2\>
 <button
 type=\button\
 onClick={() => handleQuickFill('manager')}
 className={px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors }
 >
 Manager
 </button>
 <button
 type=\button\
 onClick={() => handleQuickFill('driver')}
 className={px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors }
 >
 Driver
 </button>
 <button
 type=\button\
 onClick={() => handleQuickFill('receiver')}
 className={px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors }
 >
 Receiver
 </button>
 </div>
 </div>

 {/* Form */}
 <form onSubmit={handleLogin} className=\space-y-4\>
 <div>
 <label className=\block text-xs font-bold text-slate-700 mb-1\>Email Address</label>
 <input
 type=\email\
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 className=\w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-medium\
 />
 </div>

 <div>
 <label className=\block text-xs font-bold text-slate-700 mb-1\>Password</label>
 <input
 type=\password\
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className=\w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-medium\
 />
 </div>

 <button
 type=\submit\
 disabled={loading}
 className=\w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer\
 >
 {loading ? (
 <span className=\inline-flex items-center gap-2\>
 <span className=\w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin\ />
 Authenticating...
 </span>
 ) : (
 'Sign In with Sanctum'
 )}
 </button>
 </form>

 <div className=\mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400\>
 Connected to Render Production Backend &bull; Sanctum Token Auth
 </div>
 </div>
 </div>
 );
}
