import React from 'react';
import { ShieldAlert, Users, ArrowRight, Activity, CheckCircle2, User as UserIcon, LogIn, Lock, ShieldCheck } from 'lucide-react';

export default function PortalSelectionModal({ user, onSelectRole, onOpenAuth }) {
  const isAdmin = user && user.role === 'admin';

  return (
    <div className="portal-overlay">
      <div className="portal-container">
        {/* User Account Info Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(24, 24, 27, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: isAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 230, 180, 0.15)',
              border: isAdmin ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(0, 230, 180, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isAdmin ? <ShieldCheck size={18} color="#F59E0B" /> : <UserIcon size={18} color="#00E6B4" />}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {user?.name || (user?.email ? user.email.split('@')[0] : 'Public Citizen (Guest)')}
                {isAdmin && (
                  <span style={{ fontSize: '0.66rem', background: '#F59E0B', color: '#09090b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    AUTHORITY ADMIN
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.74rem', color: user?.email ? '#00E6B4' : '#a1a1aa' }}>
                {user?.email || 'Guest Mode — Sign in for full civic record tracking'}
              </div>
            </div>
          </div>

          {onOpenAuth && (
            <button
              onClick={() => onOpenAuth('login')}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '7px 14px', gap: '6px' }}
            >
              <LogIn size={13} color="#00E6B4" /> {user ? 'Switch Account' : 'Sign In / Register'}
            </button>
          )}
        </div>

        {/* Header Branding */}
        <div className="portal-header">
          <div className="brand-icon" style={{ margin: '0 auto 14px', width: '48px', height: '48px' }}>
            <Activity size={26} color="#00E6B4" />
          </div>
          <h1 className="portal-title">Road Guardian AI</h1>
          <p className="portal-subtitle">
            Real-Time Road Health Perception & Digital Twin Spatial Intelligence Platform
          </p>
          <div className="portal-tag">Select Access Portal to Continue</div>
        </div>

        {/* Portal Options Grid */}
        <div className="portal-grid">
          {/* Public Citizen Card */}
          <div className="portal-card public-card" onClick={() => onSelectRole('public')}>
            <div className="portal-card-badge public-badge">Public Access</div>
            <div className="portal-icon-wrapper" style={{ background: 'rgba(0, 230, 180, 0.1)', borderColor: 'rgba(0, 230, 180, 0.25)' }}>
              <Users size={28} color="#00E6B4" />
            </div>
            <h2>Public Citizen Portal</h2>
            <p>
              Report road hazards, stream camera feeds for pothole AI scanning, and track repair lifecycle status.
            </p>
            <ul className="portal-features">
              <li><CheckCircle2 size={14} color="#00E6B4" /> Pothole Camera AI Perception</li>
              <li><CheckCircle2 size={14} color="#00E6B4" /> Public Incident Report Feed</li>
              <li><CheckCircle2 size={14} color="#00E6B4" /> Instant Hazard Reporting</li>
            </ul>
            <button className="btn-primary portal-btn" style={{ width: '100%', marginTop: '14px' }}>
              Enter Citizen Portal <ArrowRight size={16} />
            </button>
          </div>

          {/* Road Infrastructure Authority Card */}
          <div 
            className="portal-card admin-card" 
            onClick={() => {
              if (isAdmin) {
                onSelectRole('admin');
              } else {
                if (onOpenAuth) onOpenAuth('admin-login');
                else onSelectRole('admin');
              }
            }}
          >
            <div className="portal-card-badge admin-badge">
              {isAdmin ? 'Admin Verified' : 'Admin Login Required'}
            </div>
            <div className="portal-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
              <ShieldAlert size={28} color="#F59E0B" />
            </div>
            <h2>Authority Admin Portal</h2>
            <p>
              Full executive control room: 3D Digital Twin, capacity rerouting simulator, risk engine, & audit PDF reports.
            </p>
            <ul className="portal-features">
              <li><CheckCircle2 size={14} color="#F59E0B" /> 3D Digital Twin Spatial Network</li>
              <li><CheckCircle2 size={14} color="#F59E0B" /> Maintenance Traffic Simulator</li>
              <li><CheckCircle2 size={14} color="#F59E0B" /> Certified PDF Audit Report Generator</li>
            </ul>
            <button 
              className="btn-primary portal-btn" 
              style={{ width: '100%', marginTop: '14px', background: '#F59E0B', color: '#09090b', fontWeight: 600 }}
            >
              {isAdmin ? (
                <>Enter Authority Control Room <ArrowRight size={16} /></>
              ) : (
                <><Lock size={15} /> Log In with Admin Email</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
