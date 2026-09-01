import React from 'react';
import { 
  Camera, ClipboardList, ShieldCheck, Map, Activity, 
  User, ShieldAlert, LogOut, Sparkles, ChevronRight
} from 'lucide-react';

export default function PublicNavbar({ activeTab, setActiveTab, user, onSwitchPortal, onOpenProfile, onLogout }) {
  const navLinks = [
    { id: 'detection', label: 'Report Hazard & Scan', icon: Camera, badge: 'AI Vision' },
    { id: 'my-reports', label: 'My Reports & Tracking', icon: ClipboardList, badge: 'Lifecycle' },
    { id: 'digital-twin', label: 'Live City Map', icon: Map, badge: 'Spatial' },
  ];

  return (
    <nav style={{
      width: '100%',
      background: 'rgba(12, 12, 16, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0 24px'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Brand & Citizen Portal Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setActiveTab('detection')}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(0, 230, 180, 0.15)',
            border: '1px solid rgba(0, 230, 180, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0, 230, 180, 0.2)'
          }}>
            <Activity size={20} color="#00E6B4" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', fontFamily: 'Space Grotesk, sans-serif' }}>
                Road Guardian
              </span>
              <span style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(0, 230, 180, 0.12)',
                color: '#00E6B4',
                border: '1px solid rgba(0, 230, 180, 0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Citizen Portal
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#71717a' }}>
              Autonomous Public Road Safety & Complaint Tracking
            </div>
          </div>
        </div>

        {/* Center Navigation Links */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#18181b',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #27272a'
        }}>
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'rgba(0, 230, 180, 0.15)' : 'transparent',
                  color: isActive ? '#00E6B4' : '#a1a1aa',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 0 12px rgba(0, 230, 180, 0.15)' : 'none'
                }}
              >
                <Icon size={16} color={isActive ? '#00E6B4' : '#71717a'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Section: Citizen Profile & Switch to Authority */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Switch to Authority Portal Button */}
          <button
            onClick={onSwitchPortal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#F59E0B',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            title="Switch to Authority Admin Portal"
          >
            <ShieldAlert size={14} />
            <span>Authority Portal</span>
          </button>

          {/* User Account / Profile */}
          {user && (
            <button
              onClick={onOpenProfile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Account Profile & Settings"
            >
              {user.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt={user.name} 
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(0, 230, 180, 0.2)',
                  color: '#00E6B4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'C'}
                </div>
              )}
              <span>{user.name ? user.name.split(' ')[0] : 'Citizen'}</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
