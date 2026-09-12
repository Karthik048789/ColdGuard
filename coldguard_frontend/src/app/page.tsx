'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiFetch, getAuthUser, setAuthSession, clearAuthSession } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'home' | 'features'>('home');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('manager@coldguard.ai');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'manager' | 'driver' | 'receiver'>('manager');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getAuthUser();
    if (user) setCurrentUser(user);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (authMode === 'login') {
        const response = await apiFetch<any>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        if (response?.data?.token && response?.data?.user) {
          setAuthSession(response.data.token, response.data.user);
          const userRole = response.data.user.role;
          setShowAuthModal(false);
          
          // Automatic Role Redirection
          if (userRole === 'driver') {
            router.push('/driver');
          } else if (userRole === 'receiver') {
            router.push('/receiver');
          } else {
            router.push('/manager');
          }
        } else {
          throw new Error('Invalid authentication response');
        }
      } else {
        // Sign Up Mode
        const response = await apiFetch<any>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: name || email.split('@')[0],
            email,
            password,
            role,
          }),
        });

        if (response?.data?.token && response?.data?.user) {
          setAuthSession(response.data.token, response.data.user);
          const userRole = response.data.user.role;
          setShowAuthModal(false);

          if (userRole === 'driver') {
            router.push('/driver');
          } else if (userRole === 'receiver') {
            router.push('/receiver');
          } else {
            router.push('/manager');
          }
        } else {
          throw new Error('Registration failed');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleChoice: 'manager' | 'driver' | 'receiver') => {
    setEmail(`${roleChoice}@coldguard.ai`);
    setPassword('password123');
    setRole(roleChoice);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans">
      
      {/* Top Navigation Bar */}
      <header className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-6 flex items-center justify-between z-30">
        {/* Official Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Image
              src="/logo-transparent.png"
              alt="ColdGuard Logo"
              width={40}
              height={40}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-slate-900 leading-tight">
              COLD<span className="text-blue-600">GUARD</span>
            </span>
            <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">Life Delivered</span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('home')}
            className={`transition-colors relative py-1 ${activeTab === 'home' ? 'text-blue-600' : 'hover:text-blue-600'}`}
          >
            Home
            {activeTab === 'home' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <a
            href="#features"
            onClick={() => setActiveTab('features')}
            className={`transition-colors py-1 ${activeTab === 'features' ? 'text-blue-600' : 'hover:text-blue-600'}`}
          >
            Features
          </a>
        </nav>

        {/* Right Auth / Portal Controls */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <Link
                href={currentUser.role === 'manager' ? '/manager' : currentUser.role === 'driver' ? '/driver' : '/receiver'}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200/60"
              >
                Go to {currentUser.role?.toUpperCase()} &rarr;
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setAuthMode('login');
                  setShowAuthModal(true);
                }}
                className="px-5 py-2 rounded-xl text-sm font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setAuthMode('register');
                  setShowAuthModal(true);
                }}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-10 flex flex-col justify-between">
        
        {/* 2-Column Hero Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          
          {/* Left Column: Text Content */}
          <div className="lg:col-span-5 flex flex-col items-start text-left pl-0 sm:pl-2 pt-8 sm:pt-16">
            
            {/* Tag */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-black tracking-[0.16em] text-slate-400 uppercase">
                COLD CHAIN FOR A HEALTHIER TOMORROW
              </span>
            </div>

            {/* Bold Hero Title */}
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.08]">
              Delivering<br />
              <span className="text-blue-600">Healthier Tomorrows.</span>
            </h1>

            {/* Subtitle Description */}
            <p className="mt-6 text-base sm:text-lg text-slate-500 font-normal leading-relaxed max-w-lg">
              Temperature Controlled Medical Logistics for vaccines, biologics, and critical pharmaceuticals &mdash; maintaining cold chain integrity at every step.
            </p>

            {/* CTA Button */}
            <div className="mt-8">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setShowAuthModal(true);
                }}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all hover:gap-3.5 cursor-pointer"
              >
                <span>Get Started</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Column: RAW CONTAINER IMAGE */}
          <div className="lg:col-span-7 flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-2xl">
              <Image
                src="/hero-container-transparent.png"
                alt="Medical Cold Chain Container"
                width={850}
                height={580}
                priority
                className="w-full h-auto object-contain hover:scale-[1.02] transition-transform duration-300 pointer-events-none drop-shadow-md"
              />
            </div>
          </div>

        </div>

        {/* 4 Feature Badges at Bottom */}
        <div id="features" className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 pt-8 border-t border-slate-100">
          <div className="flex flex-col gap-2 group cursor-default">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Real-time Monitoring</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">Track temperature and location live.</p>
          </div>

          <div className="flex flex-col gap-2 group cursor-default">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Secure Delivery</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">Maintain cold chain integrity at every step.</p>
          </div>

          <div className="flex flex-col gap-2 group cursor-default">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Optimized Routes</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">Faster, safer delivery across regions.</p>
          </div>

          <div className="flex flex-col gap-2 group cursor-default">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="text-xs font-bold text-slate-900 leading-snug">Smart Rerouting</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">Automatic cold-storage emergency diversion.</p>
          </div>
        </div>

      </main>

      {/* Direct Sign In / Sign Up Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Image src="/logo-transparent.png" alt="ColdGuard Logo" width={32} height={32} className="object-contain" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {authMode === 'login' ? 'Sign In to ColdGuard' : 'Create an Account'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {authMode === 'login' 
                  ? 'Enter credentials to automatically access your role dashboard'
                  : 'Register your account to access cold chain portals'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Quick Demo Fill Buttons (Login mode) */}
            {authMode === 'login' && (
              <div className="mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Quick Demo Login Accounts
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('manager')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      email.includes('manager')
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('driver')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      email.includes('driver')
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('receiver')}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      email.includes('receiver')
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Receiver
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. Anjali Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designated Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all font-medium bg-white"
                  >
                    <option value="manager">Logistics Manager (HQ Portal)</option>
                    <option value="driver">Transport Driver (Mobile HUD)</option>
                    <option value="receiver">Hospital / Clinic Receiver</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : authMode === 'login' ? (
                  'Sign In & Launch Dashboard'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Toggle Mode Footer */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs">
              {authMode === 'login' ? (
                <span className="text-slate-500">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError(null);
                    }}
                    className="font-bold text-blue-600 hover:underline cursor-pointer ml-1"
                  >
                    Sign Up here
                  </button>
                </span>
              ) : (
                <span className="text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError(null);
                    }}
                    className="font-bold text-blue-600 hover:underline cursor-pointer ml-1"
                  >
                    Sign In here
                  </button>
                </span>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
