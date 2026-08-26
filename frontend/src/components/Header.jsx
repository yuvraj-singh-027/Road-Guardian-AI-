import React from 'react';
import { Wifi, CloudRain, Clock, RefreshCw, ShieldAlert, Users } from 'lucide-react';

export default function Header({ title, subtitle, summaryStats, userRole, onSwitchPortal }) {
  return (
    <div className="top-header">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{title}</h1>
          <div className={`role-pill ${userRole === 'admin' ? 'role-pill-admin' : 'role-pill-public'}`}>
            {userRole === 'admin' ? <ShieldAlert size={14} /> : <Users size={14} />}
            <span>{userRole === 'admin' ? 'Authority Admin' : 'Public Citizen'}</span>
          </div>
        </div>
        <p className="page-desc">{subtitle}</p>
      </div>

      <div className="header-telemetry">
        <button 
          className="btn-secondary" 
          style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'rgba(255,255,255,0.2)' }}
          onClick={onSwitchPortal}
          title="Switch between Public Citizen Portal and Authority Admin Portal"
        >
          <RefreshCw size={14} /> Switch Portal
        </button>

        <div className="telemetry-chip">
          <Wifi size={16} color="#10B981" />
          <span>API Status:</span>
          <span className="telemetry-val">Live (8000)</span>
        </div>

        <div className="telemetry-chip">
          <CloudRain size={16} color="#38BDF8" />
          <span>Weather:</span>
          <span className="telemetry-val">{summaryStats?.weather_condition || 'Rainy'}</span>
        </div>
      </div>
    </div>
  );
}
