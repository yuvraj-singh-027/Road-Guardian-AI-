import React from 'react';
import { Wifi, CloudRain, RefreshCw, ShieldAlert, Users, Layers, Bell } from 'lucide-react';

export default function Header({ title, subtitle, summaryStats, userRole, onSwitchPortal }) {
  return (
    <header className="top-header">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 className="page-title">{title}</h1>
          <div className={`role-pill ${userRole === 'admin' ? 'role-pill-admin' : 'role-pill-public'}`}>
            {userRole === 'admin' ? <ShieldAlert size={13} /> : <Users size={13} />}
            <span>{userRole === 'admin' ? 'Authority Admin' : 'Public Citizen'}</span>
          </div>
        </div>
        <p className="page-desc">{subtitle}</p>
      </div>

      <div className="header-telemetry">
        <button 
          className="btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}
          onClick={onSwitchPortal}
          title="Switch Access Portal"
        >
          <RefreshCw size={14} /> Switch Portal
        </button>

        <div className="telemetry-chip">
          <Wifi size={15} color="#10B981" />
          <span>FastAPI:</span>
          <span className="telemetry-val" style={{ color: '#10B981' }}>Live (8000)</span>
        </div>

        <div className="telemetry-chip">
          <CloudRain size={15} color="#38BDF8" />
          <span>Weather:</span>
          <span className="telemetry-val" style={{ color: '#38BDF8' }}>
            {summaryStats?.weather_condition || 'Live GIS'}
          </span>
        </div>
      </div>
    </header>
  );
}
