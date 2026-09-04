import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, Upload, RefreshCw, AlertTriangle, CheckCircle2, 
  HelpCircle, Eye, Sliders, FileText, Copy, Check, MapPin, 
  Clock, Camera, Cpu, Image as ImageIcon, Sparkles, Layers,
  ExternalLink, ArrowRight, ShieldAlert, Info
} from 'lucide-react';

export default function AuthenticityVerifierView({ onNavigateToDetection, initialImageUrl = null }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(initialImageUrl);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [similarityThreshold, setSimilarityThreshold] = useState(88.0);
  const [activeVisualTab, setActiveVisualTab] = useState('original'); // 'original' | 'ela'
  const [copiedReport, setCopiedReport] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [useDeviceGps, setUseDeviceGps] = useState(false);

  const fileInputRef = useRef(null);

  // Preload image if passed via props
  React.useEffect(() => {
    if (initialImageUrl) {
      setPreviewUrl(initialImageUrl);
      fetch(initialImageUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "reported_hazard.jpg", { type: blob.type || "image/jpeg" });
          setSelectedFile(file);
        })
        .catch(err => console.error("Preload image fetch error:", err));
    }
  }, [initialImageUrl]);

  // Verification Pipeline Steps for the loading animation
  const PIPELINE_STEPS = [
    { label: 'Camera Hardware EXIF', question: 'Camera?' },
    { label: 'GPS Geotag Validity', question: 'Where?' },
    { label: 'Temporal Timestamp Coherence', question: 'When?' },
    { label: 'Perceptual Hash Duplicate Match', question: 'Duplicate hai?' },
    { label: '2D FFT Screen Moiré Pattern', question: 'Screen photo?' },
    { label: 'JPEG Error Level Analysis (ELA)', question: 'Editing signs?' },
    { label: 'Frequency Noise AI Synthetic Detector', question: 'Synthetic signs?' },
    { label: 'Multi-Signal Score Synthesis', question: 'Final Score' }
  ];

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setReport(null);
    setErrorMsg(null);
    setActiveVisualTab('original');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Demo presets generation so user can test various scenarios immediately
  const loadDemoPreset = async (presetType) => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    setAnalysisStep(0);

    // Create synthetic demo canvas
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    if (presetType === 'authentic') {
      // Natural textured road with asphalt noise
      const imgData = ctx.createImageData(640, 480);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const noise = Math.floor(65 + Math.random() * 55);
        imgData.data[i] = noise;
        imgData.data[i + 1] = noise + Math.floor(Math.random() * 4);
        imgData.data[i + 2] = noise + Math.floor(Math.random() * 6);
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // Draw asphalt lane line
      ctx.strokeStyle = '#FCD34D';
      ctx.lineWidth = 12;
      ctx.setLineDash([30, 20]);
      ctx.beginPath();
      ctx.moveTo(320, 0);
      ctx.lineTo(320, 480);
      ctx.stroke();

      // Pothole cavity
      ctx.fillStyle = '#27272a';
      ctx.beginPath();
      ctx.ellipse(340, 260, 60, 40, Math.PI / 6, 0, 2 * Math.PI);
      ctx.fill();
    } else if (presetType === 'screen') {
      // Screen pattern with horizontal and vertical Moiré grid lines
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(0, 0, 640, 480);

      // High frequency grid lines simulating screen pixels
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 640; x += 4) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 480);
        ctx.stroke();
      }
      for (let y = 0; y < 480; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }

      // Specular glare reflection
      const grad = ctx.createRadialGradient(200, 150, 10, 200, 150, 120);
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(50, 50, 300, 200);
    } else if (presetType === 'ai_synthetic') {
      // Overly smooth synthetic gradient (AI generation)
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#52525b');
      grad.addColorStop(0.5, '#71717a');
      grad.addColorStop(1, '#3f3f46');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Smooth artificial pothole without real aggregate stones
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(320, 240, 55, 0, 2 * Math.PI);
      ctx.fill();
    } else if (presetType === 'spliced') {
      // Base natural road
      ctx.fillStyle = '#52525b';
      ctx.fillRect(0, 0, 640, 480);

      // Paste distinct foreign high-contrast patch (simulating digital copy-paste)
      ctx.fillStyle = '#09090b';
      ctx.fillRect(240, 180, 160, 120);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(240, 180, 160, 120);
    }

    canvas.toBlob((blob) => {
      const filename = `preset_${presetType}_sample.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      processSelectedFile(file);
      setIsAnalyzing(false);
    }, 'image/jpeg', 0.95);
  };

  const handleFetchDeviceGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setManualLat(pos.coords.latitude.toFixed(6));
        setManualLon(pos.coords.longitude.toFixed(6));
        setUseDeviceGps(true);
      },
      () => {
        alert('Could not retrieve device location.');
      }
    );
  };

  const runVerification = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    setReport(null);

    // Progressive step simulation
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep = (currentStep + 1) % PIPELINE_STEPS.length;
      setAnalysisStep(currentStep);
    }, 280);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('threshold', similarityThreshold);
    if (manualLat && manualLon) {
      formData.append('manual_lat', manualLat);
      formData.append('manual_lon', manualLon);
    }

    try {
      const res = await fetch('/api/authenticity/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Authenticity verification failed');
      }

      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Verification service failed. Please check network connection.');
    } finally {
      clearInterval(interval);
      setIsAnalyzing(false);
    }
  };

  const handleCopyReport = () => {
    if (!report?.text_report) return;
    navigator.clipboard.writeText(report.text_report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'passed':
        return { bg: 'rgba(16, 185, 129, 0.12)', border: '#10B981', color: '#10B981', icon: '✓' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.12)', border: '#F59E0B', color: '#F59E0B', icon: '⚠' };
      case 'suspicious':
        return { bg: 'rgba(239, 68, 68, 0.12)', border: '#EF4444', color: '#EF4444', icon: '✕' };
      case 'unavailable':
      default:
        return { bg: 'rgba(113, 113, 122, 0.12)', border: '#71717a', color: '#a1a1aa', icon: '—' };
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10B981'; // Green
    if (score >= 70) return '#F59E0B'; // Yellow/Amber
    if (score >= 40) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Platform Header Banner */}
      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #00E6B4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ background: 'rgba(0, 230, 180, 0.15)', padding: '6px', borderRadius: '8px' }}>
                <ShieldCheck size={24} color="#00E6B4" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Image Authenticity Verification Engine
              </h2>
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '0.86rem', margin: 0, lineHeight: 1.5, maxWidth: '720px' }}>
              Autonomous 7-stage forensic pipeline that inspects road & incident evidence for camera EXIF authenticity, 
              geotags, pHash deduplication, monitor screen re-photography, JPEG compression splicing (ELA), and AI synthesis.
            </p>
          </div>

          {/* Configurable Threshold Slider */}
          <div style={{ background: '#18181b', padding: '10px 14px', borderRadius: '8px', border: '1px solid #27272a', minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sliders size={12} /> pHash Duplicate Threshold:
              </span>
              <strong style={{ fontSize: '0.82rem', color: '#00E6B4' }}>{similarityThreshold}%</strong>
            </div>
            <input 
              type="range" 
              min="70" 
              max="98" 
              step="1" 
              value={similarityThreshold} 
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#00E6B4', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#71717a', marginTop: '2px' }}>
              <span>70% (Loose)</span>
              <span>88% (Standard)</span>
              <span>98% (Strict)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: UPLOAD & PRESET SELECTION */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: '#27272a', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#00E6B4' }}>1</span>
            Upload Photograph for Forensic Analysis
          </h3>

          {/* Preset Buttons for immediate testing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Quick Presets:</span>
            <button 
              className="btn-secondary" 
              onClick={() => loadDemoPreset('authentic')}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              title="Generate a genuine camera road photo with natural texture"
            >
              📷 Authentic Road
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => loadDemoPreset('screen')}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              title="Simulate re-photographed monitor screen with Moiré grid"
            >
              🖥️ Screen Photo
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => loadDemoPreset('ai_synthetic')}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              title="Simulate overly smooth AI generated road surface"
            >
              🤖 Synthetic / AI
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => loadDemoPreset('spliced')}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              title="Simulate copy-pasted pothole image editing"
            >
              ✂️ Spliced ELA
            </button>
          </div>
        </div>

        {/* Drag & Drop Upload Container */}
        <div 
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: previewUrl ? '16px' : '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: previewUrl ? '#121216' : 'rgba(24, 24, 27, 0.5)',
            transition: 'border-color 0.2s',
            marginBottom: '16px'
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/jpeg,image/jpg,image/png,image/webp" 
            style={{ display: 'none' }} 
          />

          {previewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <img 
                src={previewUrl} 
                alt="Selected verification evidence" 
                style={{ maxHeight: '240px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #27272a' }} 
              />
              <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
                Selected: <strong style={{ color: '#fff' }}>{selectedFile?.name}</strong> ({(selectedFile?.size / 1024).toFixed(1)} KB) — Click to choose different photo
              </div>
            </div>
          ) : (
            <div>
              <div style={{ background: 'rgba(0,230,180,0.1)', width: '48px', height: '48px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Upload size={22} color="#00E6B4" />
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                Drag and drop incident photo here, or click to browse
              </div>
              <div style={{ fontSize: '0.78rem', color: '#71717a' }}>
                Supports JPEG, JPG, PNG & WEBP formats. Forensic checks will evaluate metadata, frequency spectrum & error levels.
              </div>
            </div>
          )}
        </div>

        {/* Device GPS / Coordinate Integration Options */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#18181b', padding: '10px 14px', borderRadius: '8px', border: '1px solid #27272a', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} color="#F59E0B" />
            <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
              Optional Reference Geolocation:
            </span>
            {manualLat && manualLon ? (
              <span style={{ fontSize: '0.78rem', color: '#00E6B4', fontWeight: 600 }}>
                {manualLat}°, {manualLon}°
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
                (Will be extracted from image EXIF if available)
              </span>
            )}
          </div>
          <button 
            className="btn-secondary" 
            onClick={handleFetchDeviceGps}
            style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <MapPin size={12} /> Use My Current GPS
          </button>
        </div>

        {/* Run Verification Button */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn-primary" 
            onClick={runVerification} 
            disabled={!selectedFile || isAnalyzing}
            style={{ padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isAnalyzing ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
            {isAnalyzing ? 'Running Forensic Pipeline...' : 'Run Authenticity Verification'}
          </button>
        </div>
      </div>

      {/* SECTION 2: AUTHENTICITY ANALYSIS PROGRESS */}
      {isAnalyzing && (
        <div className="glass-card" style={{ padding: '24px', border: '1px solid rgba(0, 230, 180, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <RefreshCw className="spin" size={20} color="#00E6B4" />
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>
                Forensic Pipeline Executing
              </h3>
              <p style={{ color: '#a1a1aa', fontSize: '0.78rem', margin: 0 }}>
                Running independent mathematical and frequency inspection sub-systems...
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {PIPELINE_STEPS.map((step, idx) => {
              const isActive = idx === analysisStep;
              const isDone = idx < analysisStep;
              return (
                <div 
                  key={idx}
                  style={{
                    background: isActive ? 'rgba(0, 230, 180, 0.1)' : '#18181b',
                    border: `1px solid ${isActive ? '#00E6B4' : '#27272a'}`,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isDone ? '#10B981' : (isActive ? '#00E6B4' : '#52525b'),
                      boxShadow: isActive ? '0 0 8px #00E6B4' : 'none'
                    }} />
                    <span style={{ fontSize: '0.78rem', color: isActive ? '#fff' : '#a1a1aa', fontWeight: isActive ? 600 : 400 }}>
                      {step.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#71717a' }}>{step.question}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error notification */}
      {errorMsg && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', borderRadius: '10px', color: '#FCA5A5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} color="#EF4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION 3 & 4: VERIFICATION RESULTS & FINAL AUTHENTICITY SCORE */}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Score Banner */}
          <div className="glass-card" style={{ padding: '24px', border: `1px solid ${getScoreColor(report.authenticity_score)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* Circular Score Visual Indicator */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: '#18181b',
                  border: `4px solid ${getScoreColor(report.authenticity_score)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 16px ${getScoreColor(report.authenticity_score)}33`
                }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: getScoreColor(report.authenticity_score), lineHeight: 1 }}>
                    {report.authenticity_score}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>
                    out of 100
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{report.status_badge}</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                      {report.status}
                    </h3>
                  </div>
                  <p style={{ color: '#a1a1aa', fontSize: '0.82rem', margin: 0 }}>
                    File: <strong style={{ color: '#fff' }}>{report.filename}</strong> &nbsp;|&nbsp; 
                    Resolution: {report.dimensions?.width}x{report.dimensions?.height} px &nbsp;|&nbsp; 
                    Analyzed in <strong>{report.processing_time_ms} ms</strong>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleCopyReport}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '8px 14px' }}
                >
                  {copiedReport ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  {copiedReport ? 'Report Copied!' : 'Copy Forensic Report'}
                </button>
                {onNavigateToDetection && (
                  <button 
                    className="btn-primary" 
                    onClick={() => onNavigateToDetection(selectedFile)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '8px 14px' }}
                  >
                    Scan Road Hazards <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Score Tier Scale Indicator */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #27272a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#71717a', marginBottom: '4px' }}>
                <span>0 — 39: HIGH RISK</span>
                <span>40 — 69: SUSPICIOUS</span>
                <span>70 — 89: LIKELY AUTHENTIC</span>
                <span>90 — 100: HIGHLY AUTHENTIC</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: '#27272a', position: 'relative', overflow: 'hidden' }}>
                <div 
                  style={{
                    height: '100%',
                    width: `${report.authenticity_score}%`,
                    background: getScoreColor(report.authenticity_score),
                    borderRadius: '3px',
                    transition: 'width 0.6s ease'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 7-Module Verification Checklist (Requirement 10 & 11) */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#27272a', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#00E6B4' }}>2</span>
              7-Layer Verification Checklist
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report.checklist?.map((mod) => {
                const badgeStyle = getStatusBadgeStyle(mod.status);
                return (
                  <div 
                    key={mod.id}
                    style={{
                      background: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span 
                          style={{
                            background: badgeStyle.bg,
                            border: `1px solid ${badgeStyle.border}`,
                            color: badgeStyle.color,
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            minWidth: '26px',
                            textAlign: 'center'
                          }}
                        >
                          {badgeStyle.icon}
                        </span>
                        <div>
                          <strong style={{ fontSize: '0.88rem', color: '#fff' }}>{mod.name}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#71717a', marginLeft: '8px' }}>
                            [{mod.question}]
                          </span>
                        </div>
                      </div>

                      <span 
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          fontWeight: 600
                        }}
                      >
                        {mod.status_label || mod.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#d4d4d8', paddingLeft: '36px', lineHeight: 1.4 }}>
                      {mod.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visual Forensic Comparison: Original vs ELA Map */}
          {report.ela_visualization_b64 && (
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} color="#00E6B4" />
                  Forensic Visual Inspection (Error Level Analysis)
                </h3>

                {/* View Switcher */}
                <div style={{ display: 'flex', background: '#18181b', padding: '3px', borderRadius: '8px', border: '1px solid #27272a' }}>
                  <button 
                    onClick={() => setActiveVisualTab('original')}
                    style={{
                      background: activeVisualTab === 'original' ? '#27272a' : 'transparent',
                      color: activeVisualTab === 'original' ? '#00E6B4' : '#a1a1aa',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Original Photo
                  </button>
                  <button 
                    onClick={() => setActiveVisualTab('ela')}
                    style={{
                      background: activeVisualTab === 'ela' ? '#27272a' : 'transparent',
                      color: activeVisualTab === 'ela' ? '#00E6B4' : '#a1a1aa',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Enhanced ELA Difference Map
                  </button>
                  <button 
                    onClick={() => setActiveVisualTab('split')}
                    style={{
                      background: activeVisualTab === 'split' ? '#27272a' : 'transparent',
                      color: activeVisualTab === 'split' ? '#00E6B4' : '#a1a1aa',
                      border: 'none',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Side-by-Side
                  </button>
                </div>
              </div>

              {/* Display Area */}
              {activeVisualTab === 'split' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '6px', fontWeight: 600 }}>Original Incident Photograph</div>
                    <img 
                      src={previewUrl} 
                      alt="Original" 
                      style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #27272a' }} 
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#00E6B4', marginBottom: '6px', fontWeight: 600 }}>Enhanced ELA Compression Error Map</div>
                    <img 
                      src={report.ela_visualization_b64} 
                      alt="ELA Difference Map" 
                      style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(0, 230, 180, 0.3)' }} 
                    />
                  </div>
                </div>
              ) : activeVisualTab === 'ela' ? (
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src={report.ela_visualization_b64} 
                    alt="ELA Difference Map" 
                    style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(0, 230, 180, 0.3)' }} 
                  />
                  <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '8px' }}>
                    Bright highlighted clusters signify high JPEG error variance. Spliced or digitally inserted objects show distinct luminance against natural background.
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src={previewUrl} 
                    alt="Original" 
                    style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #27272a' }} 
                  />
                </div>
              )}
            </div>
          )}

          {/* Explainability & Evidence Box (Requirement 12) */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="#38BDF8" />
              Evidence & Decision Transparency (Explainability)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Authenticity / Trust Evidence */}
              <div style={{ background: '#18181b', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10B981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} /> Positive Authenticity Factors
                </div>
                {report.trust_reasons?.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: '#d4d4d8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {report.trust_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: '0.76rem', color: '#71717a' }}>No positive hardware EXIF tags verified.</div>
                )}
              </div>

              {/* Threat / Suspicion Evidence */}
              <div style={{ background: '#18181b', padding: '14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#EF4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={14} /> Flagged Anomalies & Penalties
                </div>
                {report.threat_reasons?.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: '#FCA5A5', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {report.threat_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: '0.76rem', color: '#10B981' }}>No suspicious manipulation or duplicate matches detected.</div>
                )}
              </div>
            </div>

            {/* Neutral Context Notes */}
            {report.neutral_notes?.length > 0 && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#121216', borderRadius: '6px', fontSize: '0.74rem', color: '#a1a1aa' }}>
                <strong>Non-Penalizing Context:</strong> {report.neutral_notes.join(' • ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
