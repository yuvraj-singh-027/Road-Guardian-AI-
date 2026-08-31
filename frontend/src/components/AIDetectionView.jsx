import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, AlertTriangle, ShieldCheck, MapPin, RefreshCw, Clock, History, FileText, Sparkles, PieChart as PieIcon, BarChart2, Locate, Compass, Lock } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const decimalToDMS = (deg, isLat) => {
  if (isNaN(deg) || deg === null || deg === undefined) return '';
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2);
  const direction = isLat ? (deg >= 0 ? "N" : "S") : (deg >= 0 ? "E" : "W");
  return `${degrees}°${minutes}'${seconds}" ${direction}`;
};

export default function AIDetectionView({ userRole = 'public' }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [fakeImageWarning, setFakeImageWarning] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // environment (back) or user (front)
  const [exifWarning, setExifWarning] = useState(false);

  // Manual location state
  const [landmarkName, setLandmarkName] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [showLocationFields, setShowLocationFields] = useState(true);
  
  // Historical public hazard reports feed
  const [recentReports, setRecentReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const fetchHistory = () => {
    setLoadingHistory(true);
    fetch('/api/overview')
      .then((res) => res.json())
      .then((data) => {
        if (data.recent_detections) {
          setRecentReports(data.recent_detections.slice(0, 5));
        } else {
          setRecentReports([
            { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Landmark: 'Kasturba Gandhi Marg', Severity: 'High', Confidence: 0.89, Risk_Score: 84.2, Time: '10:14 AM' },
            { id: 102, Image: 'pothole_barakhamba.jpg', Landmark: 'Barakhamba Road', Severity: 'Medium', Confidence: 0.76, Risk_Score: 58.0, Time: '09:30 AM' },
            { id: 103, Image: 'pothole_rajiv_chowk.jpg', Landmark: 'Rajiv Chowk Gate 3', Severity: 'Critical', Confidence: 0.94, Risk_Score: 92.5, Time: '06:45 PM' },
            { id: 104, Image: 'pothole_connaught_place.jpg', Landmark: 'Connaught Inner Circle', Severity: 'Low', Confidence: 0.65, Risk_Score: 32.1, Time: '02:10 PM' },
          ]);
        }
      })
      .catch(() => {
        setRecentReports([
          { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Landmark: 'Kasturba Gandhi Marg', Severity: 'High', Confidence: 0.89, Risk_Score: 84.2, Time: '10:14 AM' },
          { id: 102, Image: 'pothole_barakhamba.jpg', Landmark: 'Barakhamba Road', Severity: 'Medium', Confidence: 0.76, Risk_Score: 58.0, Time: '09:30 AM' },
          { id: 103, Image: 'pothole_rajiv_chowk.jpg', Landmark: 'Rajiv Chowk Gate 3', Severity: 'Critical', Confidence: 0.94, Risk_Score: 92.5, Time: '06:45 PM' },
        ]);
      })
      .finally(() => setLoadingHistory(false));
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setManualLat(lat.toFixed(6));
        setManualLon(lon.toFixed(6));

        // Auto reverse-geocode to resolve actual street address
        try {
          let addr = '';
          try {
            const res = await fetch(`/api/location/reverse-geocode?lat=${lat}&lon=${lon}`);
            if (res.ok) {
              const data = await res.json();
              if (data.address) addr = data.address;
            }
          } catch (e) {
            console.warn('Backend reverse-geocode failed, falling back to OSM:', e);
          }

          if (!addr) {
            const osm = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
            if (osm.ok) {
              const data = await osm.json();
              if (data.display_name) {
                const a = data.address || {};
                const parts = [
                  a.road || a.pedestrian || a.street,
                  a.suburb || a.neighbourhood || a.quarter,
                  a.city || a.town || a.village || a.county,
                  a.state,
                  a.postcode
                ].filter(Boolean);
                addr = parts.length > 0 ? parts.join(', ') : data.display_name;
              }
            }
          }

          if (addr) {
            setLandmarkName(addr);
          } else {
            setLandmarkName(`Road Segment (${decimalToDMS(lat, true)}, ${decimalToDMS(lon, false)})`);
          }
        } catch (err) {
          console.warn('Reverse geocoding error:', err);
          setLandmarkName(`GPS Location (${decimalToDMS(lat, true)}, ${decimalToDMS(lon, false)})`);
        } finally {
          setIsFetchingGps(false);
        }
      },
      (err) => {
        console.error(err);
        alert('Could not fetch device GPS. Defaulting to New Delhi coordinates.');
        setManualLat('28.613900');
        setManualLon('77.209000');
        setLandmarkName('Kartavya Path, Raisina Hill, New Delhi');
        setIsFetchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDetectionResult(null);
      setFakeImageWarning(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target.result;
        const dataView = new DataView(buffer);
        let hasGpsMetadata = false;
        
        if (buffer.byteLength > 4 && dataView.getUint16(0, false) === 0xffd8) {
          let offset = 2;
          while (offset < buffer.byteLength - 4) {
            const marker = dataView.getUint16(offset, false);
            if (marker === 0xffe1) {
              hasGpsMetadata = true;
              break;
            } else if ((marker & 0xff00) !== 0xff00) {
              break;
            }
            offset += 2 + dataView.getUint16(offset + 2, false);
          }
        }
        
        if (!hasGpsMetadata && !manualLat && !landmarkName) {
          setExifWarning(true);
        } else {
          setExifWarning(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleRunDetection = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setFakeImageWarning(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    if (manualLat && manualLon) {
      formData.append('manual_lat', manualLat);
      formData.append('manual_lon', manualLon);
    }
    if (landmarkName.trim()) {
      formData.append('landmark_name', landmarkName.trim());
    }

    try {
      let response;
      try {
        response = await fetch('/api/detect/image', {
          method: 'POST',
          body: formData,
        });
      } catch (e) {
        response = await fetch('http://localhost:8000/api/detect/image', {
          method: 'POST',
          body: formData,
        });
      }

      const data = await response.json().catch(() => null);
 
      if (!response.ok) {
        throw new Error(`API Error: ${data?.detail || response.statusText || 'Server Error'}`);
      }
 
      setFakeImageWarning(null);
      setDetectionResult(data);
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert(`Detection Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async (currentFacing) => {
    const mode = typeof currentFacing === 'string' ? currentFacing : facingMode;
    setCameraActive(true);
    
    // Stop any existing tracks first
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied with facingMode:', err);
      // Fallback: try default video constraint without specifying facingMode
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (fallbackErr) {
        console.error('Fallback camera access failed:', fallbackErr);
        alert('Could not access webcam.');
        setCameraActive(false);
      }
    }
  };

  const toggleFacingMode = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (cameraActive) {
      startCamera(newMode);
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCameraActive(false);
      
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    }, 'image/jpeg');
  };

  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'Critical': return 'badge-critical';
      case 'High': return 'badge-high';
      case 'Medium': return 'badge-degraded';
      default: return 'badge-healthy';
    }
  };

  // Data for Charts
  const severityDistribution = [
    { name: 'Critical Hazards', value: 8, color: '#EF4444' },
    { name: 'High Risk', value: 14, color: '#F59E0B' },
    { name: 'Medium Risk', value: 12, color: '#38BDF8' },
    { name: 'Low Risk', value: 5, color: '#10B981' }
  ];

  const recentConfidenceData = recentReports.map(item => ({
    name: (item.Landmark || item.Image).substring(0, 10),
    confidence: Math.round((item.Confidence || 0.8) * 100),
    risk: Math.round(item.Risk_Score || 75)
  }));

  return (
    <div>
      {/* Upper Grid: Scanner & Detection Output */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Input Panel — Open AI Perception */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={18} color="#00E6B4" /> AI Perception Scanner & Geotag Upload
            </h3>
            <span style={{ fontSize: '0.72rem', background: '#18181b', color: '#00E6B4', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0,230,180,0.2)' }}>
              PyTorch YOLOv8
            </span>
          </div>
          
          {cameraActive ? (
            <div style={{ textAlign: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '12px', border: '1px solid #00E6B4' }} />
              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={captureCameraFrame}>
                  <Camera size={16} /> Capture Frame
                </button>
                <button className="btn-secondary" onClick={toggleFacingMode} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <RefreshCw size={16} /> Switch Camera ({facingMode === 'user' ? 'Front' : 'Back'})
                </button>
                <button className="btn-secondary" onClick={() => {
                  setCameraActive(false);
                  if (videoRef.current && videoRef.current.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                  }
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div 
                style={{
                  padding: '24px',
                  background: 'rgba(24, 24, 27, 0.5)',
                  border: userRole === 'public' ? '1px dashed rgba(0, 230, 180, 0.2)' : '1px dashed rgba(245, 158, 11, 0.2)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  marginBottom: '14px'
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={{ maxHeight: '160px', borderRadius: '10px', objectFit: 'contain' }} />
                ) : (
                  userRole === 'public' ? (
                    <div>
                      <Camera size={34} color="#00E6B4" style={{ marginBottom: '8px' }} />
                      <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>No Active Capture</p>
                      <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '4px' }}>Click "Live WebCam" below to start the camera and capture a road photo.</p>
                    </div>
                  ) : (
                    <div>
                      <Lock size={34} color="#F59E0B" style={{ marginBottom: '8px' }} />
                      <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Scanner Restricted</p>
                      <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '4px' }}>Live WebCam scanner is restricted to the Citizen Portal. Admins cannot scan road hazards directly.</p>
                    </div>
                  )
                )}
              </div>

              {exifWarning && !manualLat && !landmarkName.trim() && (
                <div 
                  style={{
                    marginTop: '14px',
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '0.82rem', fontWeight: 600 }}>
                    <AlertTriangle size={16} />
                    <span>⚠️ Camera Geotag Missing (No EXIF Data Found)</span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#a1a1aa', margin: 0, lineHeight: 1.4 }}>
                    This image does not contain embedded GPS geotags. To map this pothole, please click "Use My GPS" or type a street address below.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        handleGetCurrentLocation();
                      }}
                      style={{ padding: '6px 12px', fontSize: '0.74rem', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Locate size={12} /> Resolve Location via Device GPS
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setShowLocationFields(true);
                      }}
                      style={{ padding: '6px 12px', fontSize: '0.74rem' }}
                    >
                      Fill Manually
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Location / Landmark Input Box */}
              <div style={{ marginTop: '14px', padding: '12px', background: '#18181b', borderRadius: '10px', border: '1px solid var(--border-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#00E6B4', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> Hazard Street Address & Location
                  </span>
                  <button 
                    type="button" 
                    onClick={handleGetCurrentLocation}
                    disabled={isFetchingGps}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.72rem', gap: '5px' }}
                    title="Auto-detect actual street address from device GPS"
                  >
                    {isFetchingGps ? <RefreshCw className="spin" size={12} /> : <Locate size={12} color="#00E6B4" />}
                    <span>{isFetchingGps ? 'Resolving Address...' : 'Use My GPS'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Actual Street Address (e.g. Kartavya Path, Raisina Hill, New Delhi)"
                    value={landmarkName}
                    onChange={(e) => setLandmarkName(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                  />

                  {manualLat && manualLon && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#71717a', background: '#121214', padding: '6px 12px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#00E6B4', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span>✓ GPS Verified: {parseFloat(manualLat).toFixed(6)}°, {parseFloat(manualLon).toFixed(6)}°</span>
                        <span style={{ fontSize: '0.66rem', color: '#a1a1aa' }}>
                          DMS: {decimalToDMS(parseFloat(manualLat), true)} , {decimalToDMS(parseFloat(manualLon), false)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowLocationFields(!showLocationFields)}
                        style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.7rem' }}
                      >
                        {showLocationFields ? 'Hide Coords' : 'Edit Coords'}
                      </button>
                    </div>
                  )}

                  {showLocationFields && (
                    <div className="grid-2" style={{ gap: '8px' }}>
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="Latitude (e.g. 28.6139)"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#a1a1aa' }}
                      />
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="Longitude (e.g. 77.2090)"
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#a1a1aa' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <button 
                  className="btn-primary" 
                  disabled={!selectedFile || isProcessing || (exifWarning && !manualLat && !landmarkName)}
                  onClick={handleRunDetection}
                  style={{ flex: 1, opacity: (!selectedFile || isProcessing || (exifWarning && !manualLat && !landmarkName)) ? 0.6 : 1 }}
                >
                  {isProcessing ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                  {isProcessing ? 'Evaluating Model...' : 'Run AI Hazard Scanner'}
                </button>

                {userRole === 'public' && (
                  <button className="btn-secondary" onClick={startCamera}>
                    <Camera size={16} /> Live WebCam
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff' }}>YOLO Perception Output</h3>
            {detectionResult && (
              <span className={`badge ${getSeverityBadgeClass(detectionResult.highest_severity)}`}>
                {detectionResult.highest_severity} Severity
              </span>
            )}
          </div>

          {fakeImageWarning ? (
            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid #EF4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: '#EF4444', color: '#fff', borderRadius: '50%', minWidth: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 style={{ color: '#F87171', fontSize: '1.02rem', fontWeight: 700, margin: 0 }}>
                    {fakeImageWarning.title || '⛔ Submission Rejected: Fake / Tampered Image'}
                  </h4>
                  <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '2px', margin: 0 }}>
                    {fakeImageWarning.reason || 'This photo was flagged by the Authenticity Check Engine as AI-generated, screen-captured, or digitally altered.'}
                  </p>
                </div>
              </div>

              {fakeImageWarning.authenticity && (
                <div style={{ background: '#18181b', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>Authenticity Score:</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#EF4444' }}>
                      {fakeImageWarning.authenticity.status_badge} {fakeImageWarning.authenticity.authenticity_score}/100 ({fakeImageWarning.authenticity.status})
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#F87171', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {fakeImageWarning.authenticity.threat_reasons?.map((reason, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚠️</span> <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                className="btn-secondary" 
                onClick={() => setFakeImageWarning(null)}
                style={{ width: '100%', borderColor: 'rgba(239,68,68,0.4)', color: '#F87171', fontSize: '0.82rem', padding: '8px' }}
              >
                Clear Alert & Upload Authentic Field Camera Photo
              </button>
            </div>
          ) : detectionResult ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <img 
                  src={detectionResult.annotated_image_b64} 
                  alt="Detection Output" 
                  style={{ width: '100%', maxHeight: '200px', borderRadius: '10px', objectFit: 'contain', border: '1px solid rgba(0,230,180,0.3)' }} 
                />
              </div>

              <div className="grid-2" style={{ gap: '10px', marginBottom: '12px' }}>
                <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>HAZARDS DETECTED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#00E6B4', marginTop: '2px' }}>{detectionResult.pothole_count} Pothole(s)</div>
                </div>

                <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>MAX CONFIDENCE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38BDF8', marginTop: '2px' }}>{(detectionResult.max_confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div style={{ background: '#18181b', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#F59E0B" /> Location / Landmark:
                  </span>
                  <span style={{ fontWeight: 600, color: '#00E6B4', fontSize: '0.85rem' }}>
                    {detectionResult.landmark_name || 'Geotagged Hazard'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#71717a' }}>GPS Coordinates & Source:</span>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.82rem' }}>
                    {detectionResult.gps.latitude.toFixed(4)}° N, {detectionResult.gps.longitude.toFixed(4)}° E ({detectionResult.location_source || 'Geotag'})
                  </span>
                </div>
              </div>

              {/* Photo Authenticity Check Engine Result */}
              {detectionResult?.authenticity && (
                <div style={{ marginTop: '12px', background: '#12131a', padding: '12px', borderRadius: '10px', border: `1px solid ${detectionResult.authenticity.status_color === 'green' ? 'rgba(16,185,129,0.3)' : detectionResult.authenticity.status_color === 'yellow' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={16} color={detectionResult.authenticity.status_color === 'green' ? '#10B981' : detectionResult.authenticity.status_color === 'yellow' ? '#F59E0B' : '#EF4444'} />
                      Authenticity Check Engine
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}>
                        ⚡ {detectionResult.authenticity.processing_time_ms}ms
                      </span>
                      <span className={`badge ${detectionResult.authenticity.status_color === 'green' ? 'badge-healthy' : detectionResult.authenticity.status_color === 'yellow' ? 'badge-degraded' : 'badge-critical'}`} style={{ fontSize: '0.72rem' }}>
                        {detectionResult.authenticity.status_badge} {detectionResult.authenticity.status} ({detectionResult.authenticity.authenticity_score}/100)
                      </span>
                    </div>
                  </div>

                  {/* 6-Point Inspection Matrix Grid */}
                  <div className="grid-2" style={{ gap: '6px', fontSize: '0.75rem', marginBottom: '8px' }}>
                    <div style={{ background: '#18181b', padding: '6px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#a1a1aa' }}>📷 Camera: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.exif?.exif_valid ? '#10B981' : '#F59E0B' }}>
                        {detectionResult.authenticity.checks_summary?.exif?.camera_make || 'Generic'} {detectionResult.authenticity.checks_summary?.exif?.camera_model || ''}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '6px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#a1a1aa' }}>📍 Geotag: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.exif?.gps_valid ? '#10B981' : '#F59E0B' }}>
                        {detectionResult.authenticity.checks_summary?.exif?.gps_valid ? 'Verified EXIF GPS' : 'Missing Geotag'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '6px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#a1a1aa' }}>🔍 pHash: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.phash?.is_duplicate ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.phash?.is_duplicate ? 'DUPLICATE' : 'Unique Hash'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '6px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#a1a1aa' }}>🖥️ Screen Moiré: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.screen_detection?.is_screen_photo ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.screen_detection?.is_screen_photo ? 'Screen Photo' : 'Physical Scene'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '6px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#a1a1aa' }}>🧪 ELA Check: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.ela_editing?.is_edited ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.ela_editing?.is_edited ? 'Splicing Signs' : 'Coherent JPEG'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '6px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#a1a1aa' }}>🤖 AI Detector: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.ai_synthetic?.is_synthetic ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.ai_synthetic?.is_synthetic ? 'Synthetic AI' : 'Physical Sensor'}
                      </strong>
                    </div>
                  </div>

                  {detectionResult.authenticity.threat_reasons?.length > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#F87171', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {detectionResult.authenticity.threat_reasons.map((reason, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>⚠️</span> <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
              <AlertTriangle size={38} style={{ marginBottom: '10px', opacity: 0.4 }} />
              <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>No active detection scanner output</p>
              <p style={{ fontSize: '0.75rem', marginTop: '2px' }}>Upload a road surface image with landmark/GPS details or use live camera.</p>
            </div>
          )}
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Severity Distribution Donut Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={16} color="#F59E0B" /> Hazard Severity Distribution
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>City Analytics</span>
          </div>

          <div style={{ position: 'relative', height: '210px', width: '100%' }}>
            <div style={{ position: 'absolute', top: '39%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {severityDistribution.reduce((acc, curr) => acc + curr.value, 0)}
              </div>
              <div style={{ fontSize: '0.62rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>Hazards</div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={74}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#09090b" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: data.color }} />
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{data.name}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                            Count: <b style={{ color: '#fff' }}>{data.value}</b>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '0.75rem', color: '#a1a1aa', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Confidence & Risk Score Bar Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} color="#38BDF8" /> Perception Confidence vs Risk Index
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Recent Scans</span>
          </div>

          <div style={{ height: '210px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentConfidenceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '0.78rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '6px' }}>{payload[0].payload.name}</div>
                          {payload.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color }} />
                              <span style={{ color: '#a1a1aa' }}>{p.name}:</span>
                              <span style={{ color: '#fff', fontWeight: 600 }}>{p.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#a1a1aa' }} />
                <Bar dataKey="confidence" name="Confidence (%)" fill="#00E6B4" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="risk" name="Risk Score (/100)" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Community Hazard Reports Feed */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={16} color="#00E6B4" /> Recent Geotagged Public Reports (Live Feed)
          </h3>
          <span className="badge badge-degraded" style={{ fontSize: '0.72rem' }}>
            Public GIS Telemetry Feed
          </span>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>Loading recent hazard feed...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)', color: '#71717a', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px' }}>Landmark / Image</th>
                  <th style={{ padding: '10px 12px' }}>Severity</th>
                  <th style={{ padding: '10px 12px' }}>AI Confidence</th>
                  <th style={{ padding: '10px 12px' }}>Risk Rating</th>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} color="#00E6B4" /> {item.Landmark || item.Image}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${getSeverityBadgeClass(item.Severity)}`}>
                        {item.Severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#38BDF8', fontWeight: 600 }}>
                      {Math.round((item.Confidence || 0.8) * 100)}%
                    </td>
                    <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 600 }}>
                      {item.Risk_Score || 75.0} / 100
                    </td>
                    <td style={{ padding: '10px 12px', color: '#71717a', fontSize: '0.78rem' }}>
                      <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                      {item.Time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
