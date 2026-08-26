import React, { useState } from 'react';
import { ShieldAlert, Users, Lock, ArrowRight, Activity, CheckCircle2, KeyRound, AlertCircle, Info } from 'lucide-react';

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
          <div className="brand-icon" style={{ margin: '0 auto 14px', width: '48px', height: '48px' }}>
            <Activity size={26} color="#00E6B4" />
          </div>
          <h1 className="portal-title">Road Guardian AI</h1>
          <p className="portal-subtitle">
            Real-Time Road Health Perception & Digital Twin Spatial Intelligence Platform
          </p>
          <div className="portal-tag">Select Access Portal to Continue</div>
        </div>

        {/* Portal Options Grid */}
        <div className="portal-grid">
          {/* Public Citizen Card */}
          <div className="portal-card public-card" onClick={handlePublicClick}>
            <div className="portal-card-badge public-badge">Public Access</div>
            <div className="portal-icon-wrapper" style={{ background: 'rgba(0, 230, 180, 0.1)', borderColor: 'rgba(0, 230, 180, 0.25)' }}>
              <Users size={28} color="#00E6B4" />
            </div>
            <h2>Public Citizen Portal</h2>
            <p>
              Report road hazards, stream camera feeds for pothole AI scanning, and view interactive public road safety maps.
            </p>
            <ul className="portal-features">
              <li><CheckCircle2 size={14} color="#00E6B4" /> Pothole Camera AI Perception</li>
              <li><CheckCircle2 size={14} color="#00E6B4" /> Public Road GIS Telemetry Map</li>
              <li><CheckCircle2 size={14} color="#00E6B4" /> Instant Hazard Reporting</li>
            </ul>
            <button className="btn-primary portal-btn" style={{ width: '100%', marginTop: '14px' }}>
              Enter Citizen Portal <ArrowRight size={16} />
            </button>
          </div>

          {/* Road Infrastructure Authority Card */}
          <div className="portal-card admin-card">
            <div className="portal-card-badge admin-badge">Authority Restricted</div>
            <div className="portal-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
              <ShieldAlert size={28} color="#F59E0B" />
            </div>
            <h2>Authority Admin Portal</h2>
            <p>
              Full executive control room: 3D Digital Twin, capacity rerouting simulator, risk engine, & audit PDF reports.
            </p>
            <ul className="portal-features">
              <li><CheckCircle2 size={14} color="#F59E0B" /> 3D Digital Twin Spatial Network</li>
              <li><CheckCircle2 size={14} color="#F59E0B" /> Maintenance Traffic Simulator</li>
              <li><CheckCircle2 size={14} color="#F59E0B" /> Certified PDF Audit Report Generator</li>
            </ul>

            {!showAdminPasscode ? (
              <div>
                <button 
                  className="btn-secondary portal-btn" 
                  style={{ width: '100%', marginTop: '14px', borderColor: '#F59E0B', color: '#F59E0B' }}
                  onClick={() => setShowAdminPasscode(true)}
                >
                  <Lock size={15} /> Authenticate Authority Access
                </button>
                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Info size={12} color="#F59E0B" /> Default Passcode: <strong style={{ color: '#F59E0B' }}>Admin@RoadGuardian2026</strong>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminAuth} style={{ marginTop: '14px', width: '100%' }}>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <KeyRound size={15} color="#F59E0B" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    placeholder="Enter Authority Passcode"
                    className="form-select"
                    style={{ paddingLeft: '34px', width: '100%', borderColor: errorMsg ? '#EF4444' : '#F59E0B' }}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginBottom: '8px', textAlign: 'left' }}>
                  Passcode: <code style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Admin@RoadGuardian2026</code>
                </div>

                {errorMsg && (
                  <div style={{ color: '#EF4444', fontSize: '0.75rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> {errorMsg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn-primary" style={{ flex: 1, background: '#F59E0B', color: '#09090b', fontWeight: 600 }} disabled={isVerifying}>
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
