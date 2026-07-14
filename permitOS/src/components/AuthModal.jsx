import React, { useState } from 'react';
import { login, register } from '../utils/api';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ShieldCheck, WarningCircle, CheckCircle } from '@phosphor-icons/react';

export default function AuthModal({ onAuth, sessionExpiredMessage = '' }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
        await register(email, password, name);
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" weight="duotone" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground font-heading">Brick PermitOS</h1>
              <p className="text-xs text-muted-foreground">Data Center Permitting Intelligence</p>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Data center permitting intelligence platform
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            First time? Simply register with your email and password to get started.
          </p>
        </div>

        {/* Form */}
        <Card className="w-full ring-1 ring-border">
          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {sessionExpiredMessage && (
                <div className="bg-destructive/10 border border-destructive/30 px-4 py-4 text-center">
                  <div className="text-destructive font-semibold text-xs uppercase tracking-wider mb-1">Session Expired</div>
                  <p className="text-destructive/70 text-xs">{sessionExpiredMessage}</p>
                </div>
              )}

              {registered && (
                <div className="bg-primary/10 border border-primary/30 px-4 py-4 text-center">
                  <div className="text-primary font-semibold text-xs uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" weight="duotone" />
                    Account created successfully
                  </div>
                  <p className="text-primary/70 text-xs">Redirecting to sign in...</p>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 px-4 py-3 text-xs text-destructive flex items-center gap-2">
                  <WarningCircle className="w-3.5 h-3.5 shrink-0" weight="duotone" />
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={registered}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter your password'}
                  required
                  minLength={8}
                  disabled={registered}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || registered}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="text-center pt-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={switchMode}
                className="text-foreground"
              >
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          Secure connection &bull; Data encrypted in transit and at rest
        </p>
      </div>
    </div>
  );
}