import React, { useState } from 'react';
import { FileText, Download, ShieldCheck, CheckCircle2, Clock, Building2 } from 'lucide-react';

export default function ReportGeneratorView() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      });

      if (!response.ok) {
        throw new Error('PDF Generation Failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Road_Guardian_Municipal_Audit_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF report from FastAPI backend.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="grid-2">
        {/* Ticket Header & Metadata */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={20} color="#00E6B4" /> Municipal Authority Audit Document
          </h3>

          <div style={{ padding: '20px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,230,180,0.25)', borderRadius: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#00E6B4', fontWeight: 700 }}>OFFICIAL AUDIT TICKET ID</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', fontFamily: 'monospace', marginTop: '2px' }}>
                  AUDIT-RGAI-20260826-001
                </div>
              </div>
              <span className="badge badge-healthy" style={{ padding: '6px 14px' }}>
                Verified Official
              </span>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />

            <div className="grid-2" style={{ gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Authority:</span>
                <p style={{ color: '#fff', fontWeight: 600 }}>Municipal Public Works Department</p>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Generated On:</span>
                <p style={{ color: '#fff', fontWeight: 600 }}>August 26, 2026</p>
              </div>
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleDownloadPDF} 
            disabled={isGenerating}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: '1rem' }}
          >
            <Download size={20} />
            {isGenerating ? 'Generating Executive PDF...' : 'Download Executive PDF Audit Report'}
          </button>
        </div>

        {/* Audit Report Summary Preview */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#38BDF8" /> Executive Audit Summary
          </h3>

          <div className="grid-2" style={{ gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'rgba(15,23,42,0.8)', padding: '14px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>TOTAL ROADS AUDITED</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>142 Segments</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', padding: '14px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>TOTAL HAZARDS DETECTED</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFB703' }}>39 Potholes</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', padding: '14px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>CRITICAL EMERGENCY REPAIRS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FF4757' }}>8 Locations</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', padding: '14px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>CITY AVERAGE RISK INDEX</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#00E6B4' }}>68.4 / 100</div>
            </div>
          </div>

          <div style={{ padding: '14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', color: '#10B981', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} />
            <span>Includes complete EXIF geotag coordinates, risk engine metrics, and traffic rerouting proposals.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
