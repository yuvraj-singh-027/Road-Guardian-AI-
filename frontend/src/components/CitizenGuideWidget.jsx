import React, { useState } from 'react';
import { HelpCircle, X, Camera, ClipboardList, ShieldCheck, Sparkles, CheckCircle2, ChevronRight, Info, AlertTriangle, Layers, Activity, FileSpreadsheet, MapPin } from 'lucide-react';

export default function CitizenGuideWidget({ userRole = 'public' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'faq'
  const isAdmin = userRole === 'admin';

  return (
    <>
      {/* Floating Action Button (Fixed at Bottom-Right) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9990,
          background: isAdmin 
            ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' 
            : 'linear-gradient(135deg, #00E6B4 0%, #0284C7 100%)',
          color: '#09090b',
          border: 'none',
          borderRadius: '30px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '0.85rem',
          boxShadow: isAdmin ? '0 8px 24px rgba(245, 158, 11, 0.35)' : '0 8px 24px rgba(0, 230, 180, 0.35)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          transform: isOpen ? 'scale(0.95)' : 'scale(1)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = isOpen ? 'scale(0.95)' : 'scale(1)'; }}
      >
        {isOpen ? <X size={18} /> : <HelpCircle size={18} />}
        <span>{isOpen ? 'Close Guide' : (isAdmin ? 'Authority Guide' : 'How to Use')}</span>
      </button>

      {/* Floating Popup Modal (Opens above the FAB) */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            zIndex: 9991,
            width: '380px',
            maxWidth: 'calc(100vw - 32px)',
            background: 'rgba(18, 18, 23, 0.96)',
            backdropFilter: 'blur(20px)',
            border: isAdmin ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(0, 230, 180, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 230, 180, 0.15)',
            overflow: 'hidden',
            animation: 'fadeInUp 0.25s ease-out'
          }}
        >
          {/* Header */}
          <div style={{ background: isAdmin ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 230, 180, 0.08)', padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 230, 180, 0.15)', padding: '5px', borderRadius: '8px' }}>
                <Sparkles size={16} color={isAdmin ? '#F59E0B' : '#00E6B4'} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  {isAdmin ? 'Authority Command Guide' : 'Road Guardian Citizen Guide'}
                </h4>
                <div style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>
                  {isAdmin ? 'Digital Twin, Traffic Rerouting & Audits' : 'Quick Hazard Scanning & Repair Tracking'}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Sub-Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: '#121217' }}>
            <button
              onClick={() => setActiveTab('guide')}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderBottom: activeTab === 'guide' ? (isAdmin ? '2px solid #F59E0B' : '2px solid #00E6B4') : '2px solid transparent',
                background: activeTab === 'guide' ? (isAdmin ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 230, 180, 0.08)') : 'transparent',
                color: activeTab === 'guide' ? (isAdmin ? '#F59E0B' : '#00E6B4') : '#a1a1aa',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              3-Step Workflow
            </button>
            <button
              onClick={() => setActiveTab('faq')}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderBottom: activeTab === 'faq' ? (isAdmin ? '2px solid #F59E0B' : '2px solid #00E6B4') : '2px solid transparent',
                background: activeTab === 'faq' ? (isAdmin ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 230, 180, 0.08)') : 'transparent',
                color: activeTab === 'faq' ? (isAdmin ? '#F59E0B' : '#00E6B4') : '#a1a1aa',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Operations FAQ
            </button>
          </div>

          {/* Content Body */}
          <div style={{ padding: '18px 20px', maxHeight: '380px', overflowY: 'auto' }}>
            {activeTab === 'guide' ? (
              isAdmin ? (
                /* AUTHORITY ADMIN WORKFLOW */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                      1
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={14} color="#F59E0B" /> 3D Digital Twin GIS Map
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                        Monitor citywide hazard clusters, inspect pin metadata, and switch GIS layers (Heatmap, Satellite, Topological).
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                      2
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={14} color="#38BDF8" /> Dynamic Traffic Rerouting
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                        Select arterial road corridors, simulate lane degradation impacts, and generate optimal detour vectors.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                      3
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileSpreadsheet size={14} color="#10B981" /> Certified Audit Report & Dispatch
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                        Export standardized municipal inspection reports and dispatch automated work order alerts via n8n automation.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* CITIZEN WORKFLOW */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(0, 230, 180, 0.15)', color: '#00E6B4', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                      1
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Camera size={14} color="#00E6B4" /> Upload or Snap Hazard Photo
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                        Go to <strong>Report Hazard</strong>. Drag & drop a road photo or use live camera capture.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                      2
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} color="#38BDF8" /> Instant AI Perception Scan
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                        AI automatically detects potholes, verifies photo authenticity, and maps coordinates.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                      3
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ClipboardList size={14} color="#F59E0B" /> Track Repair Lifecycle
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
                        Check <strong>Report & Incident</strong> to follow status from municipal triage to asphalt repair closure.
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isAdmin ? (
                  <>
                    <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem', marginBottom: '3px' }}>
                        🗺️ How does the 3D Digital Twin operate?
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', lineHeight: 1.4 }}>
                        Uses WebGL 3D spatial geometry with MapLibre, automatically switching to high-performance 2D Leaflet if WebGL hardware is unavailable.
                      </div>
                    </div>

                    <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem', marginBottom: '3px' }}>
                        🚦 How are traffic rerouting models computed?
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', lineHeight: 1.4 }}>
                        Each road corridor evaluates physical lane counts, current peak volume, and computes dynamic congestion delay curves.
                      </div>
                    </div>

                    <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem', marginBottom: '3px' }}>
                        ⚡ How does n8n automated dispatch work?
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', lineHeight: 1.4 }}>
                        Verified hazards automatically fire webhook payloads with citizen contact data for automated repair dispatch and status reverts.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem', marginBottom: '3px' }}>
                        📸 What photos work best for AI scanning?
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', lineHeight: 1.4 }}>
                        Clear daytime photos showing the road surface directly ahead yield highest confidence scores.
                      </div>
                    </div>

                    <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem', marginBottom: '3px' }}>
                        📍 How is location determined?
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', lineHeight: 1.4 }}>
                        From image EXIF data, or click "Use My GPS" / type a landmark address when submitting.
                      </div>
                    </div>

                    <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.8rem', marginBottom: '3px' }}>
                        🏛️ How do I apply for Authority Access?
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#a1a1aa', lineHeight: 1.4 }}>
                        Open Account Settings and click <strong>Apply for Authority Access</strong> to submit your agency details.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div style={{ padding: '12px 20px', background: '#09090b', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
            <button
              onClick={() => setIsOpen(false)}
              className="btn-primary"
              style={{ width: '100%', padding: '7px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
            >
              Got It, Thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

