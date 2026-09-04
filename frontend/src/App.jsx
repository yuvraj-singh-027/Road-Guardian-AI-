import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PortalSelectionModal from './components/PortalSelectionModal';
import AIDetectionView from './components/AIDetectionView';
import DigitalTwinMapView from './components/DigitalTwinMapView';
import TrafficRerouteView from './components/TrafficRerouteView';
import RiskCalculatorView from './components/RiskCalculatorView';
import ReportGeneratorView from './components/ReportGeneratorView';
import MyReportsView from './components/MyReportsView';
import PublicFeedHistoryView from './components/PublicFeedHistoryView';
import N8nAutomationView from './components/N8nAutomationView';
import PublicNavbar from './components/PublicNavbar';
import UserProfileModal from './components/UserProfileModal';
import AuthPortal from './components/AuthPortal';
import CitizenGuideWidget from './components/CitizenGuideWidget';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Camera, Map, ShieldAlert, Cpu, FileText, Activity, Lock, KeyRound, ArrowUpRight, ArrowDownRight, Loader } from 'lucide-react';

// --- GLOBAL FETCH TOKEN INTERCEPTOR ---
if (typeof window !== 'undefined' && !window.__fetch_intercepted__) {
  window.__fetch_intercepted__ = true;
  const originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem('road_guardian_token');
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    
    const response = await originalFetch(url, options);
    
    // Handle session expiration (401)
    if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/signup')) {
      localStorage.removeItem('road_guardian_token');
      sessionStorage.removeItem('road_guardian_role');
      window.dispatchEvent(new Event('auth-unauthorized'));
    }
    
    return response;
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialAction, setAuthInitialAction] = useState('login');
  const [userRole, setUserRole] = useState(() => sessionStorage.getItem('road_guardian_role') || null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('detection');
  const [summaryStats, setSummaryStats] = useState(null);

  // Sync Supabase Auth session
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const detectedRole = session.user.user_metadata?.role || (session.user.email?.toLowerCase() === 'admin@roadguardian.gov' ? 'admin' : 'public');
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            email: session.user.email,
            role: detectedRole,
          });
          localStorage.setItem('road_guardian_token', session.access_token);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const detectedRole = session.user.user_metadata?.role || (session.user.email?.toLowerCase() === 'admin@roadguardian.gov' ? 'admin' : 'public');
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            email: session.user.email,
            role: detectedRole,
          });
          localStorage.setItem('road_guardian_token', session.access_token);
        }
      });

      return () => subscription?.unsubscribe();
    }
  }, []);

  // Fetch summary stats
  useEffect(() => {
    fetch('/api/stats/summary')
      .then((res) => res.json())
      .then((data) => setSummaryStats(data))
      .catch((err) => console.error('Stats sync error:', err));
  }, [activeTab]);

  const handleSelectRole = (role) => {
    if (role === 'admin' && (!user || user.role !== 'admin')) {
      setAuthInitialAction('admin-login');
      setShowAuthModal(true);
      return;
    }
    setUserRole(role);
    sessionStorage.setItem('road_guardian_role', role);
    setActiveTab(role === 'admin' ? 'digital-twin' : 'detection');
  };


  const handleSwitchPortal = () => {
    sessionStorage.removeItem('road_guardian_role');
    setUserRole(null); // Triggers PortalSelectionModal
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut().catch(() => null);
    }
    localStorage.removeItem('road_guardian_token');
    sessionStorage.removeItem('road_guardian_role');
    setUserRole(null);
    setShowProfileModal(false);
  };

  const getTabHeader = () => {
    switch (activeTab) {
      case 'detection':
        return {
          title: 'AI Hazard Perception',
          subtitle: 'Real-time road damage AI scanner'
        };
      case 'my-reports':
        return {
          title: userRole === 'admin' ? 'Authority Reports & Municipal Audit Hub' : 'My Road Hazard Reports & Tracking',
          subtitle: 'Track real-time lifecycle stages, municipal assignment, repair progress, PDF reports, and n8n workflows'
        };
      case 'public-feed':
        return {
          title: 'Recent Public Incident Reports (Live Feed)',
          subtitle: 'Live city-wide telemetry feed of verified road hazard reports, severity distribution, and spatial analytics'
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

  const renderRestrictedAccessNotice = () => (
    <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', maxWidth: '560px', margin: '40px auto' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
        <Lock size={28} color="#F59E0B" />
      </div>
      <h2 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '8px' }}>Authority Restricted Module</h2>
      <p style={{ color: '#a1a1aa', fontSize: '0.88rem', marginBottom: '24px', lineHeight: 1.5 }}>
        This module requires Authority Administrator credentials. Please log in or switch to an authorized municipal account to access city traffic simulations, multi-factor risk engines, and municipal audit reports.
      </p>
      <button 
        className="btn-primary" 
        onClick={handleSwitchPortal}
        style={{ background: '#F59E0B', color: '#09090b', fontWeight: 600, width: '100%', justifyContent: 'center' }}
      >
        <Lock size={16} /> Switch to Authority Portal
      </button>
    </div>
  );

  // If portal role is not selected yet, render PortalSelectionModal
  if (userRole === null) {
    return (
      <>
        <PortalSelectionModal 
          user={user}
          onSelectRole={handleSelectRole}
          onOpenAuth={(mode) => {
            setAuthInitialAction(mode || 'login');
            setShowAuthModal(true);
          }}
        />
        {showAuthModal && (
          <AuthPortal
            initialAction={authInitialAction}
            onAuthSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              setShowAuthModal(false);
              handleSelectRole(loggedInUser.role || 'public');
            }}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  // --- PUBLIC CITIZEN PORTAL (Clean UI with Sidebar & Header) ---
  if (userRole === 'public') {
    return (
      <div className="app-container">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userRole={userRole}
          onSwitchPortal={handleSwitchPortal}
          onOpenProfile={() => setShowProfileModal(true)}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        <div className="main-content">
          <Header 
            title={headerInfo.title} 
            subtitle={headerInfo.subtitle} 
            summaryStats={summaryStats} 
            userRole={userRole}
            user={user}
            onSwitchPortal={handleSwitchPortal}
            onOpenProfile={() => setShowProfileModal(true)}
            isMobileOpen={isMobileOpen}
            setIsMobileOpen={setIsMobileOpen}
          />

          <main style={{ flex: 1, maxWidth: '1240px', margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            {activeTab === 'my-reports' ? (
              <MyReportsView 
                userRole={userRole} 
                onNavigateToDetection={() => setActiveTab('detection')} 
              />
            ) : activeTab === 'public-feed' ? (
              <PublicFeedHistoryView 
                onNavigateToReport={() => setActiveTab('detection')} 
              />
            ) : (
              <AIDetectionView 
                userRole={userRole} 
                user={user}
                onNavigateToReports={() => setActiveTab('my-reports')}
              />
            )}
          </main>
        </div>

        {showProfileModal && (
          <UserProfileModal 
            user={user}
            onClose={() => setShowProfileModal(false)}
            onLogout={handleLogout}
            onUpgradeSuccess={(updatedUser) => {
              setUser(updatedUser);
              setUserRole(updatedUser.role);
            }}
          />
        )}

        {showAuthModal && (
          <AuthPortal
            onAuthSuccess={(loggedInUser) => {
              setUser(loggedInUser);
              setShowAuthModal(false);
            }}
            onClose={() => setShowAuthModal(false)}
          />
        )}

        <CitizenGuideWidget userRole={userRole} />
      </div>
    );
  }

  // --- AUTHORITY ADMIN PORTAL (Full Operations Dashboard with Sidebar & Telemetry) ---
  return (
    <div className="app-container">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole}
        onSwitchPortal={handleSwitchPortal}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      
      <div className="main-content">
        <Header 
          title={headerInfo.title} 
          subtitle={headerInfo.subtitle} 
          summaryStats={summaryStats} 
          userRole={userRole}
          user={user}
          onSwitchPortal={handleSwitchPortal}
          isMobileOpen={isMobileOpen}
          setIsMobileOpen={setIsMobileOpen}
        />

        {/* Global Summary Metric Banner — 3 Clean Metric Cards (Exclusively on Digital Twin Map view) */}
        {activeTab === 'digital-twin' && (
          <div className="grid-3" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div>
                <div className="stat-label">Total Scanned Hazards</div>
                <div className="stat-val">{summaryStats?.total_scanned ?? 0}</div>
                <div style={{ fontSize: '0.72rem', color: summaryStats?.trend_direction === 'down' ? '#10B981' : '#00E6B4', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {summaryStats?.trend_direction === 'down' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                  {summaryStats?.trend_percent !== undefined 
                    ? `${summaryStats.trend_percent >= 0 ? '+' : ''}${summaryStats.trend_percent}% from last week` 
                    : '+14.2% from last week'}
                </div>
              </div>
              <div className="stat-icon-wrapper" style={{ background: 'rgba(0,230,180,0.1)' }}>
                <Activity size={20} color="#00E6B4" />
              </div>
            </div>

            <div className="stat-card">
              <div>
                <div className="stat-label">Critical Potholes</div>
                <div className="stat-val" style={{ color: '#EF4444' }}>{summaryStats?.critical_potholes !== undefined ? summaryStats.critical_potholes : 18}</div>
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
                <div className="stat-label">Average City Risk (All Scans)</div>
                <div className="stat-val" style={{ color: '#F59E0B' }}>{summaryStats?.active_road_risk_score !== undefined ? summaryStats.active_road_risk_score : 68.4}</div>
                <div style={{ 
                  fontSize: '0.72rem', 
                  color: (summaryStats?.active_road_risk_score || 0) > 70 ? '#EF4444' : (summaryStats?.active_road_risk_score || 0) > 35 ? '#F59E0B' : '#10B981', 
                  marginTop: '4px',
                  fontWeight: 600 
                }}>
                  {(summaryStats?.active_road_risk_score || 0) > 70 ? 'High Risk Level' : (summaryStats?.active_road_risk_score || 0) > 35 ? 'Moderate Risk Level' : 'Low Risk Level'}
                </div>
              </div>
              <div className="stat-icon-wrapper" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <Cpu size={20} color="#F59E0B" />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic View Component */}
        {activeTab === 'detection' && (
          <AIDetectionView 
            userRole={userRole} 
            user={user}
            onNavigateToAuthenticity={() => setActiveTab('authenticity')}
            onNavigateToReports={() => setActiveTab('my-reports')}
          />
        )}
        {activeTab === 'my-reports' && (
          <MyReportsView 
            userRole={userRole} 
            onNavigateToDetection={() => setActiveTab('detection')} 
          />
        )}
        {activeTab === 'public-feed' && (
          <PublicFeedHistoryView 
            onNavigateToReport={() => setActiveTab('detection')} 
            onNavigateToMap={() => setActiveTab('digital-twin')} 
          />
        )}
        {activeTab === 'digital-twin' && <DigitalTwinMapView />}
        {activeTab === 'traffic-reroute' && (userRole === 'admin' ? <TrafficRerouteView /> : renderRestrictedAccessNotice())}
        {activeTab === 'risk-calculator' && (userRole === 'admin' ? <RiskCalculatorView /> : renderRestrictedAccessNotice())}
      </div>

      {showProfileModal && (
        <UserProfileModal 
          user={user}
          onClose={() => setShowProfileModal(false)}
          onLogout={handleLogout}
          onUpgradeSuccess={(updatedUser) => {
            setUser(updatedUser);
            setUserRole(updatedUser.role);
          }}
        />
      )}

      {showAuthModal && (
        <AuthPortal
          onAuthSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setShowAuthModal(false);
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      <CitizenGuideWidget userRole={userRole} />
    </div>
  );
}
