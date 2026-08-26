import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PortalSelectionModal from './components/PortalSelectionModal';
import AIDetectionView from './components/AIDetectionView';
import DigitalTwinMapView from './components/DigitalTwinMapView';
import TrafficRerouteView from './components/TrafficRerouteView';
import RiskCalculatorView from './components/RiskCalculatorView';
import ReportGeneratorView from './components/ReportGeneratorView';
import { Camera, Map, ShieldAlert, Cpu, FileText, Activity } from 'lucide-react';

export default function App() {
  // Portal Role State: null = Landing Screen, 'public' = Citizen, 'admin' = Admin
  const [userRole, setUserRole] = useState(() => {
    return sessionStorage.getItem('road_guardian_role') || null;
  });

  const [activeTab, setActiveTab] = useState('detection');
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
    // Reset active tab if public portal selected and current tab is restricted
    if (role === 'public' && ['traffic-reroute', 'risk-calculator', 'municipal-report'].includes(activeTab)) {
      setActiveTab('detection');
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

  // Render Portal Selection Modal if no role selected
  if (!userRole) {
    return <PortalSelectionModal onSelectRole={handleSelectRole} />;
  }

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

        {/* Global Summary Metric Banner */}
        <div className="grid-4" style={{ marginBottom: '28px' }}>
          <div className="stat-card">
            <div>
              <div className="stat-label">Scanned Segments</div>
              <div className="stat-val">{summaryStats?.total_scanned || 142}</div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(0,230,180,0.15)' }}>
              <Activity size={24} color="#00E6B4" />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Critical Potholes</div>
              <div className="stat-val" style={{ color: '#FF4757' }}>{summaryStats?.critical_potholes || 18}</div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(255,71,87,0.15)' }}>
              <ShieldAlert size={24} color="#FF4757" />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">City Risk Score</div>
              <div className="stat-val" style={{ color: '#FFB703' }}>{summaryStats?.active_road_risk_score || 68.4}</div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(255,183,3,0.15)' }}>
              <Cpu size={24} color="#FFB703" />
            </div>
          </div>

          <div className="stat-card">
            <div>
              <div className="stat-label">Digital Twin Nodes</div>
              <div className="stat-val" style={{ color: '#38BDF8' }}>{summaryStats?.digital_twin_nodes || 6}</div>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'rgba(56,189,248,0.15)' }}>
              <Map size={24} color="#38BDF8" />
            </div>
          </div>
        </div>

        {/* Dynamic View Component */}
        {activeTab === 'detection' && <AIDetectionView />}
        {activeTab === 'digital-twin' && <DigitalTwinMapView />}
        {activeTab === 'traffic-reroute' && (userRole === 'admin' ? <TrafficRerouteView /> : <AIDetectionView />)}
        {activeTab === 'risk-calculator' && (userRole === 'admin' ? <RiskCalculatorView /> : <AIDetectionView />)}
        {activeTab === 'municipal-report' && (userRole === 'admin' ? <ReportGeneratorView /> : <AIDetectionView />)}
      </div>
    </div>
  );
}
