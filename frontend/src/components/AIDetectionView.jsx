import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, AlertTriangle, ShieldCheck, MapPin, RefreshCw, Clock, History, FileText } from 'lucide-react';

export default function AIDetectionView() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Historical public hazard reports feed
  const [recentReports, setRecentReports] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    setLoadingHistory(true);
    fetch('/api/overview')
      .then((res) => res.json())
      .then((data) => {
        if (data.recent_detections) {
          setRecentReports(data.recent_detections.slice(0, 5));
        } else {
          // Fallback mock history for public portal
          setRecentReports([
            { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Severity: 'High', Confidence: 0.89, Risk_Score: 84.2, Time: '2026-08-26 10:14:00', Risk_Badge: 'High Risk' },
            { id: 102, Image: 'pothole_barakhamba.jpg', Severity: 'Medium', Confidence: 0.76, Risk_Score: 58.0, Time: '2026-08-26 09:30:00', Risk_Badge: 'Medium Risk' },
            { id: 103, Image: 'pothole_rajiv_chowk.jpg', Severity: 'Critical', Confidence: 0.94, Risk_Score: 92.5, Time: '2026-08-25 18:45:00', Risk_Badge: 'Critical Risk' },
            { id: 104, Image: 'pothole_connaught_place.jpg', Severity: 'Low', Confidence: 0.65, Risk_Score: 32.1, Time: '2026-08-25 14:10:00', Risk_Badge: 'Low Risk' },
          ]);
        }
      })
      .catch(() => {
        setRecentReports([
          { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Severity: 'High', Confidence: 0.89, Risk_Score: 84.2, Time: '2026-08-26 10:14:00', Risk_Badge: 'High Risk' },
          { id: 102, Image: 'pothole_barakhamba.jpg', Severity: 'Medium', Confidence: 0.76, Risk_Score: 58.0, Time: '2026-08-26 09:30:00', Risk_Badge: 'Medium Risk' },
          { id: 103, Image: 'pothole_rajiv_chowk.jpg', Severity: 'Critical', Confidence: 0.94, Risk_Score: 92.5, Time: '2026-08-25 18:45:00', Risk_Badge: 'Critical Risk' },
        ]);
      })
      .finally(() => setLoadingHistory(false));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDetectionResult(null);
    }
  };

  const handleRunDetection = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/detect/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('API Error processing image');
      }

      const data = await response.json();
      setDetectionResult(data);
      // Refresh history feed after upload
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert('Failed to connect to FastAPI detection backend.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Could not access webcam.');
      setCameraActive(false);
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
      
      // Stop stream
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    }, 'image/jpeg');
  };

  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'Critical': return 'badge-danger';
      case 'High': return 'badge-warning';
      case 'Medium': return 'badge-info';
      default: return 'badge-healthy';
    }
  };

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Input Panel — Open AI Perception */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} color="#00E6B4" /> AI Perception Camera Scanner
          </h3>
          
          {cameraActive ? (
            <div style={{ textAlign: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '12px', border: '1px solid #00E6B4' }} />
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={captureCameraFrame}>
                  <Camera size={18} /> Capture Frame
                </button>
                <button className="btn-secondary" onClick={() => setCameraActive(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div 
                className="dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={{ maxHeight: '220px', borderRadius: '12px', objectFit: 'contain' }} />
                ) : (
                  <div>
                    <Upload size={40} color="#00E6B4" style={{ marginBottom: '12px' }} />
                    <p style={{ fontWeight: 600, color: '#fff' }}>Click or drag road image to scan</p>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Supports JPG, PNG with automatic EXIF GPS detection</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-primary" 
                  disabled={!selectedFile || isProcessing}
                  onClick={handleRunDetection}
                  style={{ flex: 1, opacity: !selectedFile || isProcessing ? 0.6 : 1 }}
                >
                  {isProcessing ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
                  {isProcessing ? 'Evaluating YOLO v8...' : 'Run AI Detection'}
                </button>

                <button className="btn-secondary" onClick={startCamera}>
                  <Camera size={18} /> Live Cam
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#fff' }}>YOLO Detection Output</h3>

          {detectionResult ? (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <img 
                  src={detectionResult.annotated_image_b64} 
                  alt="Detection Output" 
                  style={{ width: '100%', maxHeight: '260px', borderRadius: '12px', objectFit: 'contain', border: '1px solid rgba(0,230,180,0.3)' }} 
                />
              </div>

              <div className="grid-2" style={{ gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(15,23,42,0.6)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>HAZARDS DETECTED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00E6B4' }}>{detectionResult.pothole_count} Pothole(s)</div>
                </div>

                <div style={{ background: 'rgba(15,23,42,0.6)', padding: '12px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>MAX CONFIDENCE</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>{(detectionResult.max_confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={16} color="#FFB703" /> GPS Geotag:
                  </span>
                  <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                    {detectionResult.gps.latitude.toFixed(4)}° N, {detectionResult.gps.longitude.toFixed(4)}° E
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Calculated Risk Score:</span>
                  <span className={`badge badge-${detectionResult.risk_assessment.css_class.replace('risk-', '')}`}>
                    {detectionResult.risk_assessment.badge} ({detectionResult.risk_assessment.score}/100)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <AlertTriangle size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ color: '#fff', fontWeight: 600 }}>No detection results to display.</p>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>Upload an image or use live camera to scan potholes.</p>
            </div>
          )}
        </div>
      </div>

      {/* Limited Historical Data Feed for Public Portal */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="#00E6B4" /> Recent Public Hazard Reports (Community Feed)
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
            Limited Public Feed
          </span>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading recent hazard reports...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '10px' }}>Hazard Reference</th>
                  <th style={{ padding: '10px' }}>Severity</th>
                  <th style={{ padding: '10px' }}>AI Confidence</th>
                  <th style={{ padding: '10px' }}>Risk Rating</th>
                  <th style={{ padding: '10px' }}>Time Reported</th>
                </tr>
              </thead>
              <tbody>
                {recentReports.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 10px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} color="#38BDF8" /> {item.Image}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className={`badge ${getSeverityBadgeClass(item.Severity)}`}>
                        {item.Severity}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#38BDF8', fontWeight: 600 }}>
                      {Math.round((item.Confidence || 0.8) * 100)}%
                    </td>
                    <td style={{ padding: '12px 10px', color: '#FFB703', fontWeight: 700 }}>
                      {item.Risk_Score || 75.0} / 100
                    </td>
                    <td style={{ padding: '12px 10px', color: '#94a3b8', fontSize: '0.82rem' }}>
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
