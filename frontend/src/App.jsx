import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PortalSelectionModal from './components/PortalSelectionModal';
import AIDetectionView from './components/AIDetectionView';
import DigitalTwinMapView from './components/DigitalTwinMapView';
import TrafficRerouteView from './components/TrafficRerouteView';
import RiskCalculatorView from './components/RiskCalculatorView';
import ReportGeneratorView from './components/ReportGeneratorView';
import { Camera, Map, ShieldAlert, Cpu, FileText, Activity, Lock, KeyRound, ArrowUpRight } from 'lucide-react';

export default function App() {
  const [userRole, setUserRole] = useState(() => {
    return sessionStorage.getItem('road_guardian_role') || null;
  });

  const [activeTab, setActiveTab] = useState(() => {
    const role = sessionStorage.getItem('road_guardian_role');
    return role === 'admin' ? 'digital-twin' : 'detection';
  });
  const [summaryStats, setSummaryStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats/summary')
      .then((res) => res.json())
      .then((data) => setSummaryStats(data))
      .catch((err) => console.error('Stats sync error:', err));
  }, []);

  const handleSelectRole = (role) => {
    setUserRole(role);
    sessionStorage.setItem('road_guardian_role', role);
    if (role === 'public' && ['traffic-reroute', 'risk-calculator', 'municipal-report'].includes(activeTab)) {
      setActiveTab('detection');
    } else if (role === 'admin' && activeTab === 'detection') {
      setActiveTab('digital-twin');
    }
  };

  const handleSwitchPortal = () => {
    setUserRole(null);
    sessionStorage.removeItem('road_guardian_role');
  };

  const getTabHeader = () => {
    switch (activeTab) {
      case 'detection':
        return {
          title: 'AI Hazard Perception & Computer Vision',
          subtitle: 'Real-time pothole and road damage detection using PyTorch YOLOv8 with EXIF GPS Geotagging'
        };
      case 'digital-twin':
        return {
          title: '3D Digital Twin Spatial Road Network',
          subtitle: 'Interactive spatial map of city road segments with real-time risk classification and traffic telemetry'
        };
      case 'traffic-reroute':
        return {
          title: 'Predictive Traffic Intelligence & Rerouting',
          subtitle: 'Simulate road segment maintenance closures and predict citywide capacity redistribution'
        };
      case 'risk-calculator':
        return {
          title: 'Multi-Factor Road Risk Evaluator',
          subtitle: 'Dynamic 0-100 risk scoring algorithm combining perception, vehicle speed, weather, and school proximity'
        };
      case 'municipal-report':
        return {
          title: 'Municipal PDF Audit Report Generator',
          subtitle: 'Generate and download executive-ready municipal audit reports for road maintenance authorities'
        };
      default:
        return { title: 'Road Guardian AI', subtitle: 'Real-Time Road Health & Traffic Digital Twin' };
    }
  };

  const headerInfo = getTabHeader();

  if (!userRole) {
    return <PortalSelectionModal onSelectRole={handleSelectRole} />;
  }

  const renderRestrictedAccessNotice = () => (
    <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', maxWidth: '560px', margin: '40px auto' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <Lock size={28} color="#F59E0B" />
      </div>
      <h2 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '8px' }}>Authority Restricted Module</h2>
      <p style={{ color: '#a1a1aa', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
        This module requires Authority Admin credentials. Please authenticate using your official passcode to access city traffic simulations, multi-factor risk engines, and municipal audit reports.
      </p>
      <button 
        className="btn-primary" 
        onClick={handleSwitchPortal}
        style={{ background: '#F59E0B', color: '#09090b', fontWeight: 600, width: '100%', justifyContent: 'center' }}
      >
        <KeyRound size={16} /> Authenticate Authority Admin Access
      </button>
    </div>
  );

  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole}
        onSwitchPortal={handleSwitchPortal}
      />
      
      <div className="main-content">
        <Header 
          title={headerInfo.title} 
          subtitle={headerInfo.subtitle} 
          summaryStats={summaryStats} 
          userRole={userRole}
          onSwitchPortal={handleSwitchPortal}
        />

        {/* Global Summary Metric Banner — shadcn Stat Cards */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div>
              <div className="stat-label">Scanned Segments</div>
              <div className="stat-val">{summaryStats?.total_scanned || 142}</div>
              <div style={{ fontSize: '0.72rem', color: '#00E6B4', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <ArrowUpRight size={12} /> +14.2% from last week
              </div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(0,230,180,0.1)' }}>
              <Activity size={20} color="#00E6B4" />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Critical Potholes</div>
              <div className="stat-val" style={{ color: '#EF4444' }}>{summaryStats?.critical_potholes || 18}</div>
              <div style={{ fontSize: '0.72rem', color: '#EF4444', marginTop: '4px' }}>
                Action Required
              </div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <ShieldAlert size={20} color="#EF4444" />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">City Risk Score</div>
              <div className="stat-val" style={{ color: '#F59E0B' }}>{summaryStats?.active_road_risk_score || 68.4}</div>
              <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginTop: '4px' }}>
                High Risk Level
              </div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Cpu size={20} color="#F59E0B" />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Digital Twin Nodes</div>
              <div className="stat-val" style={{ color: '#38BDF8' }}>{summaryStats?.digital_twin_nodes || 6}</div>
              <div style={{ fontSize: '0.72rem', color: '#38BDF8', marginTop: '4px' }}>
                Live Spatial Stream
              </div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(56,189,248,0.1)' }}>
              <Map size={20} color="#38BDF8" />
            </div>
          </div>
        </div>

        {/* Dynamic View Component */}
        {activeTab === 'detection' && <AIDetectionView />}
        {activeTab === 'digital-twin' && <DigitalTwinMapView />}
        {activeTab === 'traffic-reroute' && (userRole === 'admin' ? <TrafficRerouteView /> : renderRestrictedAccessNotice())}
        {activeTab === 'risk-calculator' && (userRole === 'admin' ? <RiskCalculatorView /> : renderRestrictedAccessNotice())}
        {activeTab === 'municipal-report' && (userRole === 'admin' ? <ReportGeneratorView /> : renderRestrictedAccessNotice())}
      </div>
    </div>
  );
}
