import React from 'react';
import { Camera, Map, ShieldAlert, Cpu, FileText, Activity, RefreshCw, Lock, Users, User, ChevronRight, Layers, ShieldCheck } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, userRole, onSwitchPortal }) {
  const allNavItems = [
    { id: 'detection', label: 'AI Hazard Perception', icon: Camera, publicAccess: true, badge: 'AI Vision' },
    { id: 'authenticity', label: 'Authenticity Verifier', icon: ShieldCheck, publicAccess: true, badge: 'Forensics' },
    { id: 'digital-twin', label: 'Digital Twin City Map', icon: Map, publicAccess: true, badge: 'Spatial' },
    { id: 'traffic-reroute', label: 'Traffic Simulator', icon: Cpu, publicAccess: false, badge: 'Layer 4' },
    { id: 'risk-calculator', label: 'Risk Engine Evaluator', icon: ShieldAlert, publicAccess: false, badge: 'Layer 2' },
    { id: 'municipal-report', label: 'Audit PDF Generator', icon: FileText, publicAccess: false, badge: 'Export' },
  ];

  const navItems = allNavItems.filter(item => {
    if (userRole === 'public') {
      return item.id === 'detection' || item.id === 'authenticity';
    } else {
      return item.id !== 'detection';
    }
  });

  return (
    <aside className="sidebar">
      <div>
        {/* Brand Header */}
        <div className="brand-header">
          <div className="brand-icon">
            <Activity size={22} color="#00E6B4" />
          </div>
          <div>
            <div className="brand-title">Road Guardian</div>
            <div className="brand-subtitle">AI Twin Intelligence</div>
          </div>
        </div>

        {/* User Role Pill Box */}
        <div className="sidebar-role-box" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {userRole === 'admin' ? <ShieldAlert size={16} color="#F59E0B" /> : <Users size={16} color="#00E6B4" />}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: userRole === 'admin' ? '#F59E0B' : '#00E6B4' }}>
                  {userRole === 'admin' ? 'Authority Admin' : 'Public Citizen'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#71717a' }}>
                  {userRole === 'admin' ? 'Full Audit Access' : 'Public Telemetry'}
                </div>
              </div>
            </div>
            <button 
              onClick={onSwitchPortal}
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
              title="View Account Profile"
            >
              <User size={14} />
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 10px 4px' }}>
          Platform Modules
        </div>

        <ul className="nav-list" style={{ marginTop: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} color={isActive ? '#00E6B4' : '#71717a'} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: isActive ? 'rgba(0, 230, 180, 0.15)' : '#27272a', color: isActive ? '#00E6B4' : '#a1a1aa' }}>
                    {item.badge}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* Public Teaser Box */}
        {userRole === 'public' && (
          <div className="public-teaser-box" onClick={onSwitchPortal} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontWeight: 600, fontSize: '0.78rem' }}>
              <Lock size={14} /> Authority Tools Locked
            </div>
            <div style={{ fontSize: '0.72rem', color: '#a1a1aa', marginTop: '4px', lineHeight: 1.4 }}>
              Unlock Traffic Simulator, Risk Evaluator & Official Audit PDF reports with Admin Passcode.
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button 
          className="btn-secondary" 
          style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem', justifyContent: 'center', gap: '6px' }}
          onClick={onSwitchPortal}
        >
          <User size={14} /> Account Settings
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#71717a' }}>
          <div className="status-dot"></div>
          <span>System Engine Online</span>
        </div>
      </div>
    </aside>
  );
}
