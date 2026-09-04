import React from 'react';
import { ShieldAlert, Users, ArrowRight, Activity, CheckCircle2, User as UserIcon, LogIn } from 'lucide-react';

export default function PortalSelectionModal({ user, onSelectRole, onOpenAuth }) {
  return (
    <div className="portal-overlay">
      <div className="portal-container">
        {/* User Account Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(24, 24, 27, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '10px 16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(0, 230, 180, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserIcon size={16} color="#00E6B4" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{user?.name || 'Public Citizen (Guest)'}</div>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>{user?.email || 'Not Logged In — Click Sign In'}</div>
            </div>
          </div>

          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '6px' }}
            >
              <LogIn size={13} color="#00E6B4" /> Sign In / Register (Supabase)
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
          <div className="portal-card admin-card" onClick={() => onSelectRole('admin')}>
            <div className="portal-card-badge admin-badge">Authority Control Room</div>
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
              Enter Authority Portal <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
