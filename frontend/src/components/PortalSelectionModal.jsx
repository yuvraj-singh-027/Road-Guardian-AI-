import React, { useState } from 'react';
import { ShieldAlert, Users, Lock, ArrowRight, Activity, CheckCircle, KeyRound, AlertCircle, Info } from 'lucide-react';

export default function PortalSelectionModal({ onSelectRole }) {
  const [showAdminPasscode, setShowAdminPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handlePublicClick = () => {
    onSelectRole('public');
  };

  const handleAdminAuth = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMsg('Please enter the Authority Passcode.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      // Try verifying with backend if available
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onSelectRole('admin');
          return;
        }
      }

      // Fallback check
      if (['Admin@RoadGuardian2026', 'admin123', 'admin'].includes(passcode.trim())) {
        onSelectRole('admin');
      } else {
        setErrorMsg('Invalid Passcode. Default Passcode: Admin@RoadGuardian2026');
      }
    } catch (err) {
      if (['Admin@RoadGuardian2026', 'admin123', 'admin'].includes(passcode.trim())) {
        onSelectRole('admin');
      } else {
        setErrorMsg('Invalid Passcode. Default Passcode: Admin@RoadGuardian2026');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="portal-overlay">
      <div className="portal-container">
        {/* Header Branding */}
        <div className="portal-header">
          <div className="brand-icon pulse-glow" style={{ margin: '0 auto 16px', width: '56px', height: '56px' }}>
            <Activity size={32} color="#00E6B4" />
          </div>
          <h1 className="portal-title">Road Guardian AI</h1>
          <p className="portal-subtitle">
            Real-Time Road Perception & Digital Twin Intelligence Platform
          </p>
          <div className="portal-tag">Select Access Portal to Continue</div>
        </div>

        {/* Portal Options Grid */}
        <div className="portal-grid">
          {/* Public Citizen Card */}
          <div className="portal-card public-card" onClick={handlePublicClick}>
            <div className="portal-card-badge public-badge">Public Access</div>
            <div className="portal-icon-wrapper" style={{ background: 'rgba(0, 230, 180, 0.15)', borderColor: 'rgba(0, 230, 180, 0.3)' }}>
              <Users size={32} color="#00E6B4" />
            </div>
            <h2>Public Citizen Portal</h2>
            <p>
              Report road hazards, stream camera feeds for pothole AI scanning, and view interactive public road safety maps.
            </p>
            <ul className="portal-features">
              <li><CheckCircle size={14} color="#00E6B4" /> Pothole Camera AI Perception</li>
              <li><CheckCircle size={14} color="#00E6B4" /> Public Road GIS Telemetry Map</li>
              <li><CheckCircle size={14} color="#00E6B4" /> Instant Hazard Reporting</li>
            </ul>
            <button className="btn-primary portal-btn" style={{ width: '100%', marginTop: '16px' }}>
              Enter Citizen Portal <ArrowRight size={18} />
            </button>
          </div>

          {/* Road Infrastructure Authority Card */}
          <div className="portal-card admin-card">
            <div className="portal-card-badge admin-badge">Authority Restricted</div>
            <div className="portal-icon-wrapper" style={{ background: 'rgba(255, 183, 3, 0.15)', borderColor: 'rgba(255, 183, 3, 0.3)' }}>
              <ShieldAlert size={32} color="#FFB703" />
            </div>
            <h2>Authority Admin Portal</h2>
            <p>
              Full executive control room: 3D Digital Twin, capacity rerouting simulator, risk engine, & audit PDF reports.
            </p>
            <ul className="portal-features">
              <li><CheckCircle size={14} color="#FFB703" /> 3D Digital Twin Spatial Network</li>
              <li><CheckCircle size={14} color="#FFB703" /> Maintenance Traffic Simulator</li>
              <li><CheckCircle size={14} color="#FFB703" /> Certified PDF Audit Report Generator</li>
            </ul>

            {!showAdminPasscode ? (
              <div>
                <button 
                  className="btn-secondary portal-btn" 
                  style={{ width: '100%', marginTop: '16px', borderColor: '#FFB703', color: '#FFB703' }}
                  onClick={() => setShowAdminPasscode(true)}
                >
                  <Lock size={16} /> Authenticate Authority Access
                </button>
                <div style={{ marginTop: '8px', fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Info size={12} color="#FFB703" /> Default Passcode: <strong style={{ color: '#FFB703' }}>Admin@RoadGuardian2026</strong>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminAuth} style={{ marginTop: '16px', width: '100%' }}>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <KeyRound size={16} color="#FFB703" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="Enter Authority Passcode"
                    className="form-select"
                    style={{ paddingLeft: '36px', width: '100%', borderColor: errorMsg ? '#FF4757' : '#FFB703' }}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '8px', textAlign: 'left' }}>
                  Passcode: <code style={{ color: '#FFB703', background: 'rgba(255,183,3,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Admin@RoadGuardian2026</code>
                </div>

                {errorMsg && (
                  <div style={{ color: '#FF4757', fontSize: '0.78rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> {errorMsg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #FFB703 0%, #FB8500 100%)', color: '#000', fontWeight: 'bold' }} disabled={isVerifying}>
                    {isVerifying ? 'Verifying...' : 'Unlock Authority Control'}
                  </button>
                  <button type="button" className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => { setShowAdminPasscode(false); setErrorMsg(''); }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
