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

  return (
    <div className="portal-overlay">
      <div className="portal-container" style={{ maxWidth: '460px' }}>

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
