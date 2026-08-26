import React, { useState } from 'react';
import { FileText, Download, Send, Building2, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, Landmark, Shield, Radio, FileCheck, Sparkles, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export default function ReportGeneratorView() {
  const [selectedDept, setSelectedDept] = useState('Municipal Public Works Department (PWD)');
  const [priority, setPriority] = useState('High Priority / Emergency');
  const [officerNotes, setOfficerNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmissionReceipt, setTransmissionReceipt] = useState(null);

  const departmentsList = [
    {
      id: 'pwd',
      name: 'Municipal Public Works Department (PWD)',
      icon: Building2,
      color: '#00E6B4',
      description: 'Urban road maintenance, local pothole patching & municipal jurisdiction.'
    },
    {
      id: 'nhai',
      name: 'National Highways Authority of India (NHAI)',
      icon: Landmark,
      color: '#38BDF8',
      description: 'Expressway surveillance, heavy transport corridors & structural pavement audit.'
    },
    {
      id: 'morth',
      name: 'Ministry of Road Transport & Highways (MoRTH)',
      icon: ShieldCheck,
      color: '#A855F7',
      description: 'Federal road safety compliance, policy standard audit & regional infrastructure.'
    },
    {
      id: 'uda',
      name: 'Urban Development Authority (UDA)',
      icon: Landmark,
      color: '#F59E0B',
      description: 'Smart city master plan infrastructure & urban gridlock prevention.'
    },
    {
      id: 'emergency',
      name: 'Emergency Disaster & Traffic Management Cell',
      icon: AlertCircle,
      color: '#EF4444',
      description: 'Critical road failure hazard response & immediate emergency traffic rerouting.'
    }
  ];

  // Audit breakdown chart data
  const auditDistribution = [
    { name: 'Critical Repairs', value: 8, color: '#EF4444' },
    { name: 'High Priority', value: 14, color: '#F59E0B' },
    { name: 'Medium Patching', value: 17, color: '#38BDF8' },
    { name: 'Routine Surveillance', value: 103, color: '#10B981' }
  ];

  const getPayload = () => ({
    target_department: selectedDept,
    priority: priority,
    officer_notes: officerNotes || 'Routine automated infrastructure audit transmission.',
    detections_summary: {
      total_scanned: 142,
      total_potholes: 39,
      critical_count: 8,
      high_count: 14,
      average_risk_score: 68.4
    },
    critical_segments: [
      {
        name: 'Northern Arterial Road (Road A)',
        potholes: 8,
        risk_score: 88.5,
        status: 'Critical',
        traffic_density: 'High',
        action_required: 'Immediate Emergency Repair & Traffic Diversion'
      },
      {
        name: 'Cross Connector (Road C)',
        potholes: 5,
        risk_score: 72.1,
        status: 'High Risk',
        traffic_density: 'Moderate',
        action_required: 'Scheduled Patching & Resurfacing'
      }
    ]
  });

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    const payload = getPayload();

    try {
      let response;
      try {
        response = await fetch('/api/report/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        response = await fetch('http://localhost:8000/api/report/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response || !response.ok) {
        throw new Error('PDF Generation Failed');
      }

      const rawBlob = await response.blob();
      const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Road_Guardian_Audit_${selectedDept.split(' ')[0]}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF report. Please ensure FastAPI backend is running at http://localhost:8000');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDirectTransmit = async () => {
    setIsTransmitting(true);
    setTransmissionReceipt(null);
    const payload = getPayload();

    try {
      let response;
      try {
        response = await fetch('/api/report/transmit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        response = await fetch('http://localhost:8000/api/report/transmit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response || !response.ok) {
        throw new Error('Transmission Failed');
      }

      const receipt = await response.json();
      setTransmissionReceipt(receipt);
    } catch (err) {
      console.error(err);
      alert('Transmission failed. Ensure FastAPI backend is running at http://localhost:8000');
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div>
      {/* 1. Target Government Authority Portal Selection Section */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark size={18} color="#00E6B4" /> Select Designated Government Authority Portal Section
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Certified Header Formatting</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#a1a1aa', marginBottom: '16px' }}>
          Choose the designated authority section to customize the certified PDF header and enable direct official portal dispatch.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '12px' }}>
          {departmentsList.map((dept) => {
            const Icon = dept.icon;
            const isSelected = selectedDept === dept.name;
            return (
              <div
                key={dept.id}
                onClick={() => setSelectedDept(dept.name)}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(0, 230, 180, 0.06)' : '#18181b',
                  border: isSelected ? `2px solid ${dept.color}` : '1px solid var(--border-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: dept.color }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{dept.name}</span>
                      {isSelected && <CheckCircle2 size={16} color={dept.color} />}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '4px', lineHeight: 1.35 }}>
                      {dept.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px' }}>
        {/* 2. Dispatch Configuration & Direct Action Controls */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} color="#38BDF8" /> Direct Transmission & PDF Export
          </h3>

          <div style={{ padding: '14px', background: '#18181b', border: '1px solid var(--border-muted)', borderRadius: '10px', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: '#00E6B4', fontWeight: 600, textTransform: 'uppercase' }}>TARGET PORTAL</div>
            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff', marginTop: '3px' }}>
              {selectedDept}
            </div>

            <div style={{ height: '1px', background: 'var(--border-muted)', margin: '12px 0' }} />

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.78rem', color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>DISPATCH PRIORITY</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="High Priority / Emergency">🔴 High Priority / Emergency Repair</option>
                <option value="Standard Scheduled Maintenance">🟡 Standard Scheduled Patching</option>
                <option value="Urgent Structural Audit">🟠 Urgent Structural Inspection</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#a1a1aa', display: 'block', marginBottom: '6px' }}>OFFICER DISPATCH NOTES (OPTIONAL)</label>
              <textarea
                className="form-input"
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
                placeholder="Enter specialized instructions, contractor dispatch codes, or traffic rerouting notes..."
                rows={3}
                style={{ resize: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-primary"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              style={{ flex: 1, justifyContent: 'center', padding: '10px 14px', fontSize: '0.88rem' }}
            >
              {isGenerating ? <RefreshCw className="spin" size={16} /> : <Download size={16} />}
              {isGenerating ? 'Generating PDF...' : 'Download PDF Report'}
            </button>

            <button
              className="btn-primary"
              onClick={handleDirectTransmit}
              disabled={isTransmitting}
              style={{
                flex: 1,
                justifyContent: 'center',
                padding: '10px 14px',
                fontSize: '0.88rem',
                background: 'linear-gradient(135deg, #00E6B4 0%, #38BDF8 100%)',
                color: '#09090b',
                fontWeight: 700
              }}
            >
              {isTransmitting ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
              {isTransmitting ? 'Transmitting...' : 'Direct Send to Govt Portal'}
            </button>
          </div>
        </div>

        {/* 3. Executive Audit Preview & Official Verification Card with Visual Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#F59E0B" /> Executive Audit Summary & Graph Breakdown
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>City Infrastructure</span>
          </div>

          {/* Audit Donut Chart */}
          <div style={{ height: '170px', width: '100%', marginBottom: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={auditDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {auditDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#09090b" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '0.72rem', color: '#a1a1aa' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', color: '#38BDF8', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} />
            <span>Official digital twin certified output. Complies with Municipal PWD & NHAI digital audit standards.</span>
          </div>
        </div>
      </div>

      {/* 4. Live Transmission Acknowledgment Receipt Modal / Card */}
      {transmissionReceipt && (
        <div style={{ marginTop: '20px' }} className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#00E6B4', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={20} /> Government Portal Dispatch Certificate (Official Receipt)
            </h3>
            <span className="badge badge-healthy" style={{ fontSize: '0.8rem' }}>
              {transmissionReceipt.acknowledgement_code}
            </span>
          </div>

          <div style={{ padding: '16px', background: '#18181b', border: '1px solid rgba(0, 230, 180, 0.25)', borderRadius: '10px' }}>
            <div className="grid-2" style={{ gap: '12px', fontSize: '0.85rem', marginBottom: '14px' }}>
              <div>
                <span style={{ color: '#71717a' }}>Target Portal:</span>
                <p style={{ color: '#fff', fontWeight: 600 }}>{transmissionReceipt.target_department}</p>
              </div>
              <div>
                <span style={{ color: '#71717a' }}>Dispatch Tracking Ref:</span>
                <p style={{ color: '#00E6B4', fontWeight: 700, fontFamily: 'monospace' }}>{transmissionReceipt.dispatch_reference}</p>
              </div>
              <div>
                <span style={{ color: '#71717a' }}>SHA256 Audit Verification:</span>
                <p style={{ color: '#38BDF8', fontWeight: 600, fontFamily: 'monospace' }}>{transmissionReceipt.verification_hash}</p>
              </div>
              <div>
                <span style={{ color: '#71717a' }}>Timestamp:</span>
                <p style={{ color: '#fff', fontWeight: 600 }}>{transmissionReceipt.timestamp}</p>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'rgba(0, 230, 180, 0.06)', borderRadius: '8px', borderLeft: '3px solid #00E6B4', color: '#fff', fontSize: '0.82rem' }}>
              <strong>Portal Ingestion Response:</strong> {transmissionReceipt.portal_response}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
