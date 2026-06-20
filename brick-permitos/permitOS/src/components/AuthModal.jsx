import React, { useState } from 'react';
import { login, register } from '../utils/api';

export default function AuthModal({ onAuth, onDemo }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onAuth();
      } else {
        await register(email, password, name, organizationName);
        setRegistered(true);
        setTimeout(() => {
          setMode('login');
          setRegistered(false);
        }, 2500);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setRegistered(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Brick PermitOS</h1>
              <p className="text-xs text-gray-500">Data Center Permitting Intelligence</p>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-200 mb-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p className="text-sm text-gray-500">
            Data center permitting intelligence platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-2xl">
          {registered && (
            <div className="bg-green-900/30 border border-green-800/40 rounded-xl px-4 py-4 text-center">
              <div className="text-green-400 font-semibold text-sm mb-1">Account created successfully!</div>
              <p className="text-green-300/70 text-xs">Redirecting to sign in...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800/40 rounded-xl px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Smith"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Organization</label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={e => setOrganizationName(e.target.value)}
                  placeholder="Acme Data Centers"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-xs text-gray-600 mt-1">A private workspace will be created for this organization.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={registered}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minimum 12 characters' : 'Enter your password'}
              required
              minLength={12}
              disabled={registered}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading || registered}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'login' && onDemo && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-[11px] uppercase tracking-widest text-gray-600">or</span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              <button
                type="button"
                onClick={onDemo}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                Explore the demo workspace
              </button>
              <p className="text-center text-xs text-gray-500">
                No account required. Your scenario is saved only in this browser.
              </p>
            </>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={switchMode}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Screening outputs are decision-support drafts and require qualified professional review.
        </p>
      </div>
    </div>
  );
}
