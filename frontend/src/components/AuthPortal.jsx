import React, { useState, useEffect } from 'react';
import { Activity, Mail, Lock, User, ArrowRight, ShieldCheck, AlertCircle, Loader, KeyRound, CheckCircle2, ChevronLeft, Zap } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export default function AuthPortal({ onAuthSuccess, initialAction, initialToken }) {
  const [view, setView] = useState('login'); // login | signup | forgot | reset | verify
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);

  // Verification & Reset states
  const [token, setToken] = useState('');
  const [showSandbox, setShowSandbox] = useState(false);

  useEffect(() => {
    if (initialAction) {
      setView(initialAction);
    }
    if (initialToken) {
      setToken(initialToken);
      if (initialAction === 'verify-email') {
        handleEmailVerification(initialToken);
      }
    }
  }, [initialAction, initialToken]);

  // Global action helper to reset messages
  const switchView = (newView) => {
    setView(newView);
    setErrorMsg('');
    setSuccessMsg('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setAdminPasscode('');
    setShowAdminField(false);
  };

  // 1. Email Verification Trigger
  const handleEmailVerification = async (verifyToken) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/auth/verify-email?token=${verifyToken}`);
      if (res.ok) {
        setSuccessMsg('Email verified successfully! You can now log into your account.');
      } else {
        setErrorMsg('Email verification failed. The link may have expired or is invalid.');
      }
    } catch (err) {
      setErrorMsg('Network error verifying email. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Local Login Action
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });

      const data = await res.json();

      if (res.ok) {
        // Save token to localStorage
        localStorage.setItem('road_guardian_token', data.token);
        sessionStorage.setItem('road_guardian_role', data.user.role);
        onAuthSuccess(data.user);
      } else {
        if (data.detail === "EMAIL_UNVERIFIED") {
          // Keep email field for resending
          setView('unverified-notice');
          setEmail(email.trim());
        } else {
          setErrorMsg(data.detail || 'Login failed. Please verify credentials.');
        }
      }
    } catch (err) {
      setErrorMsg('Network error. Failed to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Register Account Submit
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please enter a valid email.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Confirm password does not match.');
      return;
    }
    if (showAdminField && !adminPasscode.trim()) {
      setErrorMsg('Please provide the Authority Admin Passcode.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          adminPasscode: showAdminField ? adminPasscode.trim() : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(data.message || 'Account created successfully.');
        setView('verify-alert');
      } else {
        setErrorMsg(data.detail || 'Registration failed.');
      }
    } catch (err) {
      setErrorMsg('Network error creating account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Resend Verification Email
  const handleResendEmail = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSuccessMsg('A fresh verification link has been dispatched to your email.');
      } else {
        setErrorMsg('Failed to resend verification. Try again later.');
      }
    } catch (err) {
      setErrorMsg('Connection error. Could not reach server.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Forgot Password Request
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Password reset link sent.');
        setView('forgot-success');
      } else {
        setErrorMsg(data.detail || 'Error requesting reset.');
      }
    } catch (err) {
      setErrorMsg('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Reset Password Confirmation
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Confirm password does not match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Your password has been reset successfully! Redirecting...');
        setTimeout(() => {
          switchView('login');
          // Clear query params
          window.history.replaceState({}, document.title, window.location.pathname);
        }, 3000);
      } else {
        setErrorMsg(data.detail || 'Failed to reset password.');
      }
    } catch (err) {
      setErrorMsg('Network error resetting password.');
    } finally {
      setLoading(false);
    }
  };

  // 7. Google OAuth Login Redirect
  const handleGoogleRedirect = async () => {
    setErrorMsg('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : window.location.origin);
      // Direct redirect to backend endpoint
      window.location.href = `${baseUrl}/api/auth/google/login`;
    } catch (err) {
      setErrorMsg('Google Login failed.');
    }
  };

  // Check if standard keys are set by querying status or using Supabase
  const triggerGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
        return;
      }

      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          const baseUrl = import.meta.env.VITE_API_URL || 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
              ? 'http://localhost:8000' 
              : window.location.origin);
          // Direct browser navigation to start the OAuth redirect safely
          window.location.href = `${baseUrl}/api/auth/google/login`;
          return;
        }
      }
      setShowSandbox(true);
    } catch (err) {
      // Fallback to Sandbox picker directly on error/block
      setShowSandbox(true);
    } finally {
      setLoading(false);
    }
  };

  // Sandbox Profile Select Action
  const handleSandboxLogin = async (mockProfile) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/google/mock-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockProfile),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('road_guardian_token', data.token);
        sessionStorage.setItem('road_guardian_role', data.user.role);
        onAuthSuccess(data.user);
      } else {
        setErrorMsg('Mock Sandbox login failed.');
      }
    } catch (err) {
      setErrorMsg('Network connection error in sandbox.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-overlay">
      <div className="portal-container" style={{ maxWidth: '460px' }}>
        
        {/* Mock Sandbox Modal Dialog overlay */}
        {showSandbox && (
          <div className="portal-overlay" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 1000 }}>
            <div className="glass-card" style={{ maxWidth: '420px', width: '90%', margin: '0 auto', border: '1px solid rgba(56, 189, 248, 0.45)' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', marginBottom: '12px' }}>
                  <KeyRound size={22} color="#38BDF8" />
                </div>
                <h3 style={{ fontSize: '1.2rem', color: '#fff', fontFamily: 'var(--font-heading)' }}>Google OAuth Sandbox</h3>
                <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.4 }}>
                  No active Google API client keys detected in `.env`. Choose a mock profile to demonstrate Google Authenticated access.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => handleSandboxLogin({
                    name: 'Officer John Smith',
                    email: 'officer.smith@city.gov',
                    google_id: 'google_mock_11223344',
                    profile_picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
                    role: 'admin'
                  })}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', textAlign: 'left', background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                >
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>Authority Admin Portal</div>
                    <div style={{ color: '#F59E0B', fontSize: '0.72rem', fontWeight: 500 }}>Login as Officer John Smith</div>
                  </div>
                  <ArrowRight size={16} color="#F59E0B" />
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => handleSandboxLogin({
                    name: 'Jane Citizen',
                    email: 'citizen.jane@gmail.com',
                    google_id: 'google_mock_55667788',
                    profile_picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
                    role: 'public'
                  })}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', textAlign: 'left', background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(0, 230, 180, 0.3)' }}
                >
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600 }}>Public Citizen Portal</div>
                    <div style={{ color: '#00E6B4', fontSize: '0.72rem', fontWeight: 500 }}>Login as Jane Citizen</div>
                  </div>
                  <ArrowRight size={16} color="#00E6B4" />
                </button>
              </div>

              <button
                className="btn-secondary"
                onClick={() => setShowSandbox(false)}
                style={{ width: '100%', marginTop: '16px', justifyContent: 'center', borderColor: '#27272a' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Brand Header */}
        <div className="portal-header" style={{ marginBottom: '28px' }}>
          <div className="brand-icon" style={{ margin: '0 auto 12px', width: '44px', height: '44px' }}>
            <Activity size={24} color="#00E6B4" />
          </div>
          <h1 className="portal-title">Road Guardian AI</h1>
          <p className="portal-subtitle" style={{ fontSize: '0.82rem', color: '#a1a1aa' }}>
            Infrastructure AI & City Traffic Intelligence Twin
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#38BDF8', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '4px 12px', borderRadius: '12px', marginTop: '10px', fontWeight: 500 }}>
            <Zap size={12} color="#38BDF8" /> {isSupabaseConfigured ? 'Powered by Supabase Enterprise Auth' : 'Supabase & Hybrid Auth System Active'}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '28px 24px' }}>
          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', textAlign: 'left' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && view !== 'verify-alert' && view !== 'forgot-success' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontSize: '0.8rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', textAlign: 'left' }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <div>{successMsg}</div>
            </div>
          )}

          {/* VIEW: LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    placeholder="name@agency.gov"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                  <span onClick={() => switchView('forgot')} style={{ fontSize: '0.78rem', color: '#38BDF8', cursor: 'pointer', fontWeight: 500 }}>
                    Forgot Password?
                  </span>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', textAlign: 'left' }}>
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#00E6B4', cursor: 'pointer' }}
                  disabled={loading}
                />
                <label htmlFor="remember" style={{ fontSize: '0.8rem', color: '#a1a1aa', cursor: 'pointer', userSelect: 'none' }}>
                  Remember me for 30 days
                </label>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
                {loading ? <Loader size={18} className="animate-spin" /> : 'Log In'}
              </button>

              <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ height: '1px', background: '#27272a', flex: 1 }}></span>
                <span style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase' }}>or sign in with</span>
                <span style={{ height: '1px', background: '#27272a', flex: 1 }}></span>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={triggerGoogleLogin}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', gap: '10px', fontSize: '0.85rem' }}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
              </button>

              <div style={{ marginTop: '20px', fontSize: '0.82rem', color: '#a1a1aa', textAlign: 'center' }}>
                Don't have an account?{' '}
                <span onClick={() => switchView('signup')} style={{ color: '#00E6B4', cursor: 'pointer', fontWeight: 600 }}>
                  Sign Up
                </span>
              </div>
            </form>
          )}

          {/* VIEW: SIGNUP */}
          {view === 'signup' && (
            <form onSubmit={handleSignUpSubmit}>
              <div style={{ marginBottom: '14px', textAlign: 'left' }}>
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Inspector John Doe"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px', textAlign: 'left' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    placeholder="john.doe@agency.gov"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px', textAlign: 'left' }}>
                <label className="form-label">Password (Min. 6 chars)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="adminCheck"
                    checked={showAdminField}
                    onChange={(e) => {
                      setShowAdminField(e.target.checked);
                      setErrorMsg('');
                    }}
                    style={{ accentColor: '#F59E0B', cursor: 'pointer' }}
                    disabled={loading}
                  />
                  <label htmlFor="adminCheck" style={{ fontSize: '0.8rem', color: '#a1a1aa', cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
                    Register as Authority Admin
                  </label>
                </div>

                {showAdminField && (
                  <div style={{ marginTop: '10px' }}>
                    <label className="form-label" style={{ color: '#F59E0B' }}>Authority Admin Passcode</label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound size={16} color="#F59E0B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="password"
                        placeholder="Enter passcode to unlock admin roles"
                        className="form-input"
                        style={{ paddingLeft: '38px', borderColor: '#F59E0B' }}
                        value={adminPasscode}
                        onChange={(e) => setAdminPasscode(e.target.value)}
                        required={showAdminField}
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
                {loading ? <Loader size={18} className="animate-spin" /> : 'Create Account'}
              </button>

              <div style={{ margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <span style={{ height: '1px', background: '#27272a', flex: 1 }}></span>
                <span style={{ fontSize: '0.72rem', color: '#71717a' }}>or</span>
                <span style={{ height: '1px', background: '#27272a', flex: 1 }}></span>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={triggerGoogleLogin}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', gap: '10px' }}
                disabled={loading}
              >
                Continue with Google
              </button>

              <div style={{ marginTop: '20px', fontSize: '0.82rem', color: '#a1a1aa', textAlign: 'center' }}>
                Already have an account?{' '}
                <span onClick={() => switchView('login')} style={{ color: '#00E6B4', cursor: 'pointer', fontWeight: 600 }}>
                  Login
                </span>
              </div>
            </form>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotSubmit}>
              <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginBottom: '20px', lineHeight: 1.4, textAlign: 'left' }}>
                Enter your email address below, and we'll dispatch a secure verification link to safely reset your account password.
              </p>

              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    placeholder="name@agency.gov"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
                {loading ? <Loader size={18} className="animate-spin" /> : 'Send Reset Link'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => switchView('login')}
                style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
                disabled={loading}
              >
                Back to Login
              </button>
            </form>
          )}

          {/* VIEW: FORGOT SUCCESS */}
          {view === 'forgot-success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: '16px' }}>
                <CheckCircle2 size={24} color="#10B981" />
              </div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>Reset Link Dispatched</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '24px' }}>
                If this email is registered in our system, a password reset link has been sent. Check your inbox and spam folder.
              </p>
              <button onClick={() => switchView('login')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Return to Login
              </button>
            </div>
          )}

          {/* VIEW: RESET PASSWORD */}
          {view === 'reset-password' && (
            <form onSubmit={handleResetSubmit}>
              <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '8px', textAlign: 'left' }}>Choose New Password</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginBottom: '20px', lineHeight: 1.4, textAlign: 'left' }}>
                Provide a strong new password for your Road Guardian account to secure your credentials.
              </p>

              <div style={{ marginBottom: '14px', textAlign: 'left' }}>
                <label className="form-label">New Password (Min. 6 chars)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#71717a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
                {loading ? <Loader size={18} className="animate-spin" /> : 'Update Password'}
              </button>
            </form>
          )}

          {/* VIEW: EMAIL VERIFY ALERT ON REGISTRATION */}
          {view === 'verify-alert' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0,230,180,0.1)', border: '1px solid rgba(0,230,180,0.25)', marginBottom: '16px' }}>
                <Mail size={24} color="#00E6B4" />
              </div>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '8px' }}>Verify Your Email</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '20px' }}>
                Your account was created successfully! We sent a verification link to <strong style={{ color: '#fff' }}>{email}</strong>. 
                Please click it to activate your account.
              </p>
              
              <button 
                type="button" 
                onClick={handleResendEmail} 
                className="btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}
                disabled={loading}
              >
                {loading ? <Loader size={16} className="animate-spin" /> : 'Resend Verification Email'}
              </button>

              <button onClick={() => switchView('login')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Return to Login
              </button>
            </div>
          )}

          {/* VIEW: EMAIL UNVERIFIED NOTICE */}
          {view === 'unverified-notice' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: '16px' }}>
                <Mail size={24} color="#F59E0B" />
              </div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>Email Unverified</h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '20px' }}>
                Your email address <strong style={{ color: '#fff' }}>{email}</strong> is not yet verified. 
                Please verify it before accessing protected portal sections.
              </p>

              <button 
                type="button" 
                onClick={handleResendEmail} 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}
                disabled={loading}
              >
                {loading ? <Loader size={16} className="animate-spin" /> : 'Resend Verification Email'}
              </button>

              <button onClick={() => switchView('login')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                Back to Login
              </button>
            </div>
          )}

          {/* VIEW: INCOMING EMAIL VERIFICATION LINK STATE */}
          {view === 'verify-email' && (
            <div style={{ textAlign: 'center' }}>
              {loading ? (
                <div>
                  <Loader size={36} className="animate-spin" color="#00E6B4" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ color: '#fff' }}>Verifying Account...</h3>
                  <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '6px' }}>Contacting verification nodes</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: errorMsg ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: errorMsg ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.25)', marginBottom: '16px' }}>
                    {errorMsg ? <AlertCircle size={24} color="#EF4444" /> : <ShieldCheck size={24} color="#10B981" />}
                  </div>
                  <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>
                    {errorMsg ? 'Verification Failed' : 'Email Verified!'}
                  </h3>
                  <p style={{ color: '#a1a1aa', fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '24px' }}>
                    {errorMsg ? errorMsg : successMsg}
                  </p>
                  <button onClick={() => switchView('login')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Proceed to Login
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
