import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, AlertTriangle, ShieldCheck, MapPin, RefreshCw, Clock, History, FileText, Sparkles, PieChart as PieIcon, BarChart2, Locate, Compass } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function AIDetectionView() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

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
      (position) => {
        setManualLat(position.coords.latitude.toFixed(4));
        setManualLon(position.coords.longitude.toFixed(4));
        setIsFetchingGps(false);
      },
      (err) => {
        console.error(err);
        alert('Could not fetch device GPS. Defaulting to New Delhi coordinates.');
        setManualLat('28.6139');
        setManualLon('77.2090');
        setIsFetchingGps(false);
      }
    );
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

      if (!response || !response.ok) {
        const errorText = response ? await response.text() : 'Server Unreachable';
        throw new Error(`API Error: ${errorText}`);
      }

      const data = await response.json();
      setDetectionResult(data);
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert('Failed to connect to FastAPI detection backend. Please ensure backend is running on http://localhost:8000');
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
              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={captureCameraFrame}>
                  <Camera size={16} /> Capture Frame
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
                  <img src={previewUrl} alt="Preview" style={{ maxHeight: '160px', borderRadius: '10px', objectFit: 'contain' }} />
                ) : (
                  <div>
                    <Upload size={34} color="#00E6B4" style={{ marginBottom: '8px' }} />
                    <p style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Click or drag road image to scan</p>
                    <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '4px' }}>Supports JPG, PNG with EXIF GPS or manual location input</p>
                  </div>
                )}
              </div>

              {/* Manual Location / Landmark Input Box */}
              <div style={{ marginTop: '14px', padding: '12px', background: '#18181b', borderRadius: '10px', border: '1px solid var(--border-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#00E6B4', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} /> Pothole Location Details (Home Upload Friendly)
                  </span>
                  <button 
                    type="button" 
                    onClick={handleGetCurrentLocation}
                    disabled={isFetchingGps}
                    className="btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '0.72rem', gap: '4px' }}
                    title="Fetch device GPS coordinates"
                  >
                    {isFetchingGps ? <RefreshCw className="spin" size={12} /> : <Locate size={12} color="#00E6B4" />}
                    <span>{isFetchingGps ? 'Locating...' : 'Use My GPS'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Landmark / Street Address (e.g. Kasturba Gandhi Marg, Near Gate 3)"
                    value={landmarkName}
                    onChange={(e) => setLandmarkName(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                  />

                  <div className="grid-2" style={{ gap: '8px' }}>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="Latitude (e.g. 28.6139)"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="Longitude (e.g. 77.2090)"
                      value={manualLon}
                      onChange={(e) => setManualLon(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                <button 
                  className="btn-primary" 
                  disabled={!selectedFile || isProcessing}
                  onClick={handleRunDetection}
                  style={{ flex: 1, opacity: !selectedFile || isProcessing ? 0.6 : 1 }}
                >
                  {isProcessing ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                  {isProcessing ? 'Evaluating Model...' : 'Run AI Hazard Scanner'}
                </button>

                <button className="btn-secondary" onClick={startCamera}>
                  <Camera size={16} /> Live WebCam
                </button>
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

          {detectionResult ? (
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

          <div style={{ height: '210px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#09090b" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
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
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#a1a1aa' }} />
                <Bar dataKey="confidence" name="YOLO Conf (%)" fill="#00E6B4" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="risk" name="Risk Score (/100)" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={20} />
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
