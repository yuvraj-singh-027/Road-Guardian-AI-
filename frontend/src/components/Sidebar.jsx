import React from 'react';
import { Camera, Map, ShieldAlert, Cpu, FileText, Activity, RefreshCw, Lock, Users } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, userRole, onSwitchPortal }) {
  const allNavItems = [
    { id: 'detection', label: 'AI Hazard Perception', icon: Camera, publicAccess: true },
    { id: 'digital-twin', label: 'Digital Twin City Map', icon: Map, publicAccess: true },
    { id: 'traffic-reroute', label: 'Traffic Simulator', icon: Cpu, publicAccess: false },
    { id: 'risk-calculator', label: 'Risk Engine Evaluator', icon: ShieldAlert, publicAccess: false },
    { id: 'municipal-report', label: 'Audit PDF Generator', icon: FileText, publicAccess: false },
  ];

  // Filter items based on user role
  const navItems = userRole === 'public' 
    ? allNavItems.filter(item => item.publicAccess)
    : allNavItems;

  return (
    <div className="sidebar">
      <div>
        <div className="brand-header">
          <div className="brand-icon pulse-glow">
            <Activity size={24} color="#00E6B4" />
          </div>
          <div>
            <div className="brand-title">Road Guardian</div>
            <div className="brand-subtitle">AI Twin System</div>
          </div>
        </div>

        {/* User Role Badge in Sidebar */}
        <div className="sidebar-role-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {userRole === 'admin' ? <ShieldAlert size={16} color="#FFB703" /> : <Users size={16} color="#00E6B4" />}
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: userRole === 'admin' ? '#FFB703' : '#00E6B4' }}>
                {userRole === 'admin' ? 'Authority Admin' : 'Public Citizen'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                {userRole === 'admin' ? 'Full Control Access' : 'Public Portal View'}
              </div>
            </div>
          </div>
        </div>

        <ul className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} color={isActive ? '#00E6B4' : '#94a3b8'} />
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>

        {/* If Public Citizen, show locked feature teasers */}
        {userRole === 'public' && (
          <div className="public-teaser-box" onClick={onSwitchPortal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFB703', fontWeight: '600', fontSize: '0.8rem' }}>
              <Lock size={14} /> Authority Tools Restricted
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
              Traffic Simulation, Risk Evaluator & Audit Reports require Authority Passcode.
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer" style={{ flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
        <button 
          className="btn-secondary" 
          style={{ width: '100%', padding: '8px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={onSwitchPortal}
        >
          <RefreshCw size={14} /> Switch Access Portal
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="status-dot"></div>
          <span>FastAPI & YOLOv8 Engine</span>
        </div>
      </div>
    </div>
  );
}
