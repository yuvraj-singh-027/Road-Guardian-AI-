import React from 'react';
import { Wifi, CloudRain, ShieldAlert, Users, Bell, User } from 'lucide-react';

export default function Header({ title, subtitle, summaryStats, userRole, user, onSwitchPortal }) {
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
        <div className="telemetry-chip">
          <Wifi size={15} color="#10B981" />
          <span>Server Status:</span>
          <span className="telemetry-val" style={{ color: '#10B981' }}>Connected</span>
        </div>

        <div className="telemetry-chip">
          <CloudRain size={15} color="#38BDF8" />
          <span>Weather:</span>
          <span className="telemetry-val" style={{ color: '#38BDF8' }}>
            {summaryStats?.weather_condition || 'Live GIS'}
          </span>
        </div>

        {/* User Account / Profile Card */}
        {user && (
          <button 
            className="telemetry-chip"
            onClick={onSwitchPortal}
            style={{ 
              cursor: 'pointer', 
              padding: '4px 10px', 
              borderRadius: 'var(--radius-md)', 
              background: 'rgba(24, 24, 27, 0.7)',
              border: '1px solid var(--border-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
            title="View Profile Settings"
          >
            {user.profile_picture ? (
              <img 
                src={user.profile_picture} 
                style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} 
                alt={user.name} 
              />
            ) : (
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0, 230, 180, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#e4e4e7' }}>{user.name.split(' ')[0]}</span>
          </button>
        )}
      </div>
    </header>
  );
}
