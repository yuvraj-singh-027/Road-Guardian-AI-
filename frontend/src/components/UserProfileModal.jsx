import React, { useState } from 'react';
import { X, ShieldAlert, Users, LogOut, CheckCircle2, ShieldCheck, AlertCircle, Loader, Building, UserCheck } from 'lucide-react';

export default function UserProfileModal({ user, onClose, onLogout, onUpgradeSuccess }) {
  const [showUpgradeField, setShowUpgradeField] = useState(false);
  const [agency, setAgency] = useState('');
  const [designation, setDesignation] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState(user.role_request || 'none');

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!agency.trim() || !designation.trim()) {
      setErrorMsg('Please specify your agency/department and official designation.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('road_guardian_token');
      const res = await fetch('/api/auth/request-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          agency: agency.trim(),
          designation: designation.trim(),
          reason: reason.trim() || undefined
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequestStatus('pending');
        setSuccessMsg(data.message || 'Authority access application submitted for administrative review.');
        setShowUpgradeField(false);
      } else {
        setErrorMsg(data.detail || 'Failed to submit authority application.');
      }
    } catch (err) {
      setErrorMsg('Network error submitting request.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = user.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="portal-overlay" style={{ zIndex: 500 }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '90%', padding: '24px', position: 'relative' }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        {/* Profile Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          {user.profile_picture ? (
            <img 
              src={user.profile_picture} 
              style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)', marginBottom: '10px' }} 
              alt={user.name} 
            />
          ) : (
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 230, 180, 0.1)', border: '2px solid var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem', marginBottom: '10px' }}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <h3 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 600 }}>{user.name}</h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginTop: '2px' }}>{user.email}</p>
        </div>

        {/* Info Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: '#71717a' }}>Account Status</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981', fontWeight: 500 }}>
              <CheckCircle2 size={14} /> Verified Account
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: '#71717a' }}>Role Category</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: user.role === 'admin' ? '#F59E0B' : '#00E6B4', fontWeight: 600 }}>
              {user.role === 'admin' ? <ShieldAlert size={14} /> : <Users size={14} />}
              {user.role === 'admin' ? 'Authority Administrator' : 'Citizen'}
            </span>
          </div>

          {requestStatus === 'pending' && user.role !== 'admin' && (
            <div style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.76rem', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⏳</span> Authority Access Application: <strong>Pending Approval</strong>
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '0.76rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> {successMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <span style={{ color: '#71717a' }}>Member Since</span>
            <span style={{ color: '#e4e4e7' }}>{formattedDate}</span>
          </div>
        </div>

        {/* Upgrade Form for Citizens */}
        {user.role === 'public' && requestStatus !== 'pending' && !showUpgradeField && (
          <button 
            className="btn-secondary"
            onClick={() => setShowUpgradeField(true)}
            style={{ width: '100%', marginBottom: '14px', justifyContent: 'center', borderColor: '#F59E0B', color: '#F59E0B', fontSize: '0.82rem', gap: '6px' }}
          >
            <Building size={14} /> Apply for Authority Access
          </button>
        )}

        {showUpgradeField && (
          <form onSubmit={handleRequestSubmit} style={{ border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.03)', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
            <h4 style={{ color: '#F59E0B', fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UserCheck size={14} /> Authority Access Application
            </h4>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.72rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Agency / Department *</label>
              <input 
                type="text"
                placeholder="e.g. Municipal Public Works (PWD) / Traffic Police"
                className="form-input"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px' }}
                disabled={loading}
                required
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.72rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Official Designation *</label>
              <input 
                type="text"
                placeholder="e.g. Highway Inspection Lead / Civil Engineer"
                className="form-input"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px' }}
                disabled={loading}
                required
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '0.72rem', color: '#a1a1aa', display: 'block', marginBottom: '3px' }}>Work Jurisdiction / Reason (Optional)</label>
              <input 
                type="text"
                placeholder="e.g. Managing arterial road maintenance in North Zone"
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px' }}
                disabled={loading}
              />
            </div>

            {errorMsg && (
              <div style={{ color: '#EF4444', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <AlertCircle size={12} /> {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ flex: 1, background: '#F59E0B', color: '#09090b', fontSize: '0.78rem', padding: '7px 12px', justifyContent: 'center' }} 
                disabled={loading}
              >
                {loading ? <Loader size={12} className="animate-spin" /> : 'Submit Application'}
              </button>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { setShowUpgradeField(false); setErrorMsg(''); }}
                style={{ fontSize: '0.78rem', padding: '7px 12px' }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn-secondary"
            onClick={onClose}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

