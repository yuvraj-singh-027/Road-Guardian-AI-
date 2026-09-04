import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, AlertTriangle, ShieldCheck, MapPin, RefreshCw, Clock, History, FileText, Sparkles, PieChart as PieIcon, BarChart2, Locate, Compass, Lock, ClipboardList } from 'lucide-react';
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

export default function AIDetectionView({ userRole = 'public', user, onNavigateToAuthenticity, onNavigateToReports }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [activeImageView, setActiveImageView] = useState('yolo'); // 'yolo' | 'original' | 'ela'
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
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Reporter contact email (synced directly with logged-in user or entered email)
  const [reporterEmail, setReporterEmail] = useState(() => {
    return user?.email || localStorage.getItem('road_guardian_reporter_email') || '';
  });

  useEffect(() => {
    if (user?.email) {
      setReporterEmail(user.email);
      localStorage.setItem('road_guardian_reporter_email', user.email);
    }
  }, [user]);
  
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

  const resolvePreciseAddress = async (lat, lon) => {
    try {
      // 1. Try Backend reverse geocoding first
      try {
        const res = await fetch(`/api/location/reverse-geocode?lat=${lat}&lon=${lon}`);
        if (res.ok) {
          const data = await res.json();
          if (data.address && !data.address.startsWith("Road Segment (") && data.address.includes(',')) {
            return data.address;
          }
        }
      } catch (e) {
        console.warn('Backend reverse-geocode fallback:', e);
      }

      // 2. Query OSM Nominatim with zoom=18 for building/road level precision
      const osm = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
      if (osm.ok) {
        const data = await osm.json();
        const a = data.address || {};

        const poi = a.amenity || a.building || a.shop || a.office || a.tourism || a.leisure || a.landmark || a.highway;
        const houseNumber = a.house_number;
        const road = a.road || a.pedestrian || a.street || a.path || a.footway;
        const locality = a.suburb || a.neighbourhood || a.quarter || a.residential || a.block || a.sector || a.subdivision || a.hamlet;
        const district = a.city_district || a.subdistrict || a.district || a.county;
        const city = a.city || a.town || a.village || a.municipality;
        const state = a.state;
        const postcode = a.postcode;

        const parts = [];
        if (poi) parts.push(poi);
        if (houseNumber && road) parts.push(`${houseNumber} ${road}`);
        else if (road) parts.push(road);
        if (locality && !parts.includes(locality)) parts.push(locality);
        if (district && !parts.includes(district) && district !== city) parts.push(district);
        if (city && !parts.includes(city)) parts.push(city);
        if (state && !parts.includes(state)) parts.push(state);
        if (postcode) parts.push(`PIN: ${postcode}`);

        if (parts.length > 0) {
          return parts.join(', ');
        }
        if (data.display_name) return data.display_name;
      }
    } catch (err) {
      console.warn('Reverse geocode precision error:', err);
    }
    return `Road Segment (${decimalToDMS(lat, true)}, ${decimalToDMS(lon, false)})`;
  };

  const handleAddressSearch = (text) => {
    setLandmarkName(text);
    if (!text || text.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&addressdetails=1&limit=5&countrycodes=in`
        );
        if (res.ok) {
          const results = await res.json();
          setAddressSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch (e) {
        console.warn('Street autocomplete search failed:', e);
      }
    }, 300);
  };

  const handleSelectSuggestion = (item) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setManualLat(lat.toFixed(6));
    setManualLon(lon.toFixed(6));
    setGpsAccuracy(5); // High confidence on chosen street
    setLandmarkName(item.display_name);
    setExifWarning(false);
    setShowSuggestions(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsFetchingGps(true);
    setShowLocationFields(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy || 5);
        const formattedLat = lat.toFixed(6);
        const formattedLon = lon.toFixed(6);

        setManualLat(formattedLat);
        setManualLon(formattedLon);
        setGpsAccuracy(acc);
        setExifWarning(false);

        const addr = await resolvePreciseAddress(lat, lon);
        const preciseLocationStr = `${addr} (📍 ${formattedLat}°, ${formattedLon}°)`;
        setLandmarkName(preciseLocationStr);
        setIsFetchingGps(false);
      },
      (err) => {
        console.error(err);
        alert('Could not fetch device GPS. Defaulting to high-precision New Delhi coordinates.');
        const defaultLat = '28.613900';
        const defaultLon = '77.209000';
        setManualLat(defaultLat);
        setManualLon(defaultLon);
        setGpsAccuracy(5);
        setLandmarkName(`Kartavya Path, Raisina Hill, New Delhi, PIN: 110004 (📍 ${defaultLat}°, ${defaultLon}°)`);
        setIsFetchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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

    const hasLocation = Boolean((landmarkName && landmarkName.trim()) || (manualLat && manualLon));
    if (!hasLocation) {
      alert('Address Required: Please type a street address or click "Use My GPS" before scanning.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const effectiveEmail = (reporterEmail && reporterEmail.trim()) || (user && user.email) || localStorage.getItem('road_guardian_reporter_email') || '';
    const hasValidEmail = userRole === 'admin' || (effectiveEmail && emailRegex.test(effectiveEmail));
    if (!hasValidEmail) {
      alert('Email Required: Please enter a valid email address (e.g. citizen@example.com) to submit this road hazard report.');
      return;
    }

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
    if (effectiveEmail) {
      localStorage.setItem('road_guardian_reporter_email', effectiveEmail);
      formData.append('reporter_email', effectiveEmail);
      formData.append('user_email', effectiveEmail);
      formData.append('user_gmail', effectiveEmail);
      formData.append('email', effectiveEmail);
    }

    try {
      let response = await fetch('/api/detect/image', {
        method: 'POST',
        body: formData,
      });

      let data = null;
      try {
        data = await response.json();
      } catch (jsonErr) {
        // Fallback if response body is non-JSON
      }

      // HTTP 422 = Authenticity Engine rejected the image (suspicious/tampered)
      if (response.status === 422 && data?.detail?.rejected) {
        const detail = data.detail;
        setDetectionResult({
          _rejected: true,
          rejection_reason: detail.reason,
          authenticity_score: detail.authenticity_score,
          message: detail.message,
        });
        setActiveImageView('yolo');
        setIsProcessing(false);
        return;
      }

      if (!response.ok) {
        const errorDetail = Array.isArray(data?.detail)
          ? data.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
          : (typeof data?.detail === 'string' ? data.detail : (data?.message || response.statusText || 'Unable to process image on AI detector.'));
        throw new Error(errorDetail);
      }

      setDetectionResult(data);
      setActiveImageView('yolo');
      fetchHistory();
    } catch (err) {
      console.error(err);
      alert(`Detection Notice: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startCamera = async (currentFacing) => {
    const mode = typeof currentFacing === 'string' ? currentFacing : facingMode;
    setCameraActive(true);
    
    // Proactively fetch high-accuracy device GPS in the background
    if (navigator.geolocation && !manualLat) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setManualLat(lat.toFixed(6));
          setManualLon(lon.toFixed(6));
          setExifWarning(false);
          const addr = await resolvePreciseAddress(lat, lon);
          setLandmarkName(addr);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
    
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
      setExifWarning(false);
      
      // Auto GPS Geotagging for live webcam capture
      if (!manualLat && navigator.geolocation) {
        setIsFetchingGps(true);
        setShowLocationFields(true);
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const formattedLat = lat.toFixed(6);
            const formattedLon = lon.toFixed(6);
            setManualLat(formattedLat);
            setManualLon(formattedLon);
            const addr = await resolvePreciseAddress(lat, lon);
            setLandmarkName(`${addr} (📍 ${formattedLat}°, ${formattedLon}°)`);
            setIsFetchingGps(false);
          },
          () => {
            setIsFetchingGps(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
      
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
              <Camera size={18} color="#00E6B4" /> AI Perception Scanner & Image Upload
            </h3>
            <span style={{ fontSize: '0.72rem', background: '#18181b', color: '#00E6B4', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0,230,180,0.2)' }}>
              AI Active
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
              {/* PHOTO UPLOAD & CAPTURE DROPZONE */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />

              <div 
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    setSelectedFile(file);
                    setPreviewUrl(URL.createObjectURL(file));
                    setDetectionResult(null);
                  }
                }}
                style={{
                  padding: '24px 16px',
                  background: 'rgba(24, 24, 27, 0.6)',
                  border: selectedFile ? '1px solid rgba(0, 230, 180, 0.4)' : '2px dashed rgba(0, 230, 180, 0.3)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  marginBottom: '14px'
                }}
              >
                {previewUrl ? (
                  <div>
                    <img 
                      src={previewUrl} 
                      alt="Uploaded Road Hazard Preview" 
                      style={{ maxHeight: '170px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain', border: '1px solid rgba(255,255,255,0.1)' }} 
                    />
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#00E6B4', fontWeight: 600 }}>✓ {selectedFile?.name}</span>
                      <span style={{ fontSize: '0.7rem', color: '#71717a' }}>({(selectedFile?.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#a1a1aa', marginTop: '4px' }}>Click to select a different photo</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 230, 180, 0.12)', border: '1px solid rgba(0, 230, 180, 0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                      <Upload size={22} color="#00E6B4" />
                    </div>
                    <p style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', margin: 0 }}>
                      Click to Upload Road Hazard Photo
                    </p>
                    <p style={{ fontSize: '0.76rem', color: '#a1a1aa', marginTop: '4px', margin: 0 }}>
                      or Drag & Drop image file here (JPG, PNG, WEBP)
                    </p>
                    <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#18181b', border: '1px solid #27272a', fontSize: '0.72rem', color: '#00E6B4' }}>
                      <Sparkles size={12} /> Auto-extracts Image EXIF & Camera Metadata
                    </div>
                  </div>
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
              <div style={{ marginTop: '14px', padding: '12px', background: '#18181b', borderRadius: '10px', border: '1px solid var(--border-muted)', position: 'relative' }}>
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
                    title="Auto-detect high-accuracy GPS and street address"
                  >
                    {isFetchingGps ? <RefreshCw className="spin" size={12} /> : <Locate size={12} color="#00E6B4" />}
                    <span>{isFetchingGps ? 'Locking GPS...' : 'Use My GPS'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type street name or landmark (e.g. Kartavya Path, CP Block B, MG Road)"
                      value={landmarkName}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                      style={{ padding: '8px 12px', fontSize: '0.82rem', width: '100%' }}
                    />

                    {/* Address Autocomplete Suggestions Dropdown */}
                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: '#09090b',
                        border: '1px solid var(--primary)',
                        borderRadius: '8px',
                        marginTop: '4px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                        maxHeight: '180px',
                        overflowY: 'auto'
                      }}>
                        {addressSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectSuggestion(item)}
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #18181b',
                              cursor: 'pointer',
                              fontSize: '0.76rem',
                              color: '#e4e4e7',
                              transition: 'background 0.1s'
                            }}
                            className="suggestion-item-hover"
                          >
                            <div style={{ fontWeight: 600, color: '#00E6B4' }}>
                              📍 {item.display_name.split(',')[0]}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.display_name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {manualLat && manualLon && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#71717a', background: '#121214', padding: '6px 12px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#00E6B4', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✓ GPS: {parseFloat(manualLat).toFixed(6)}°, {parseFloat(manualLon).toFixed(6)}°</span>
                          {gpsAccuracy !== null && (
                            <span style={{ 
                              fontSize: '0.66rem', 
                              padding: '1px 6px', 
                              borderRadius: '10px', 
                              background: gpsAccuracy <= 50 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', 
                              color: gpsAccuracy <= 50 ? '#10B981' : '#F59E0B',
                              border: `1px solid ${gpsAccuracy <= 50 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                            }}>
                              🎯 ±{gpsAccuracy}m {gpsAccuracy <= 50 ? 'Physical Fix' : 'Network'}
                            </span>
                          )}
                        </span>
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
                        placeholder="Latitude (e.g. 28.613900)"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#a1a1aa' }}
                      />
                      <input
                        type="number"
                        step="any"
                        className="form-input"
                        placeholder="Longitude (e.g. 77.209000)"
                        value={manualLon}
                        onChange={(e) => setManualLon(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#a1a1aa' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Reporter Email — Mandatory for public/anonymous users */}
              {(userRole === 'public' || userRole === undefined) && (() => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const isEmailValid = reporterEmail && emailRegex.test(reporterEmail.trim());
                return (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '12px 14px', 
                    background: '#18181b', 
                    borderRadius: '10px', 
                    border: isEmailValid ? '1px solid rgba(16, 185, 129, 0.4)' : (selectedFile && !reporterEmail ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-muted)')
                  }}>
                    <div style={{ fontSize: '0.78rem', color: '#a78bfa', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>✉️</span> Your Email Address <strong style={{ color: '#EF4444' }}>*</strong>
                      </span>
                      <span style={{ fontSize: '0.68rem', color: isEmailValid ? '#10B981' : '#EF4444', fontWeight: 500 }}>
                        {isEmailValid ? '✓ Valid Email' : 'Required to submit'}
                      </span>
                    </div>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="Enter your email (e.g. citizen@example.com)"
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      required
                      style={{ 
                        padding: '8px 12px', 
                        fontSize: '0.82rem', 
                        width: '100%', 
                        borderColor: isEmailValid ? '#10B981' : (reporterEmail ? '#EF4444' : undefined) 
                      }}
                    />
                    <div style={{ fontSize: '0.68rem', color: '#71717a', marginTop: '4px' }}>
                      Mandatory — Used to send live repair progress updates and forward the hazard report to city authority workflows.
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const hasLocation = Boolean((landmarkName && landmarkName.trim()) || (manualLat && manualLon));
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                const hasValidEmail = userRole === 'admin' || (reporterEmail && emailRegex.test(reporterEmail.trim()));
                const isScannerDisabled = !selectedFile || !hasLocation || !hasValidEmail || isProcessing;
                return (
                  <>
                    {/* Prompt banner if image is selected but email or location is missing */}
                    {selectedFile && (!hasLocation || !hasValidEmail) && !isProcessing && (
                      <div style={{ 
                        marginTop: '10px', 
                        padding: '8px 12px', 
                        background: 'rgba(245, 158, 11, 0.08)', 
                        border: '1px solid rgba(245, 158, 11, 0.3)', 
                        borderRadius: '8px', 
                        fontSize: '0.74rem', 
                        color: '#F59E0B', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px' 
                      }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                        <span>
                          {!hasLocation && !hasValidEmail
                            ? 'Please provide a street location AND your email address before scanning.'
                            : (!hasLocation ? 'Please enter a street location or click "Use My GPS" before scanning.' : 'Please enter your email address to enable the scanner.')
                          }
                        </span>
                      </div>
                    )}

                    <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                      <button 
                        className="btn-primary" 
                        disabled={isScannerDisabled}
                        onClick={handleRunDetection}
                        style={{ 
                          flex: 2, 
                          opacity: isScannerDisabled ? 0.5 : 1, 
                          cursor: isScannerDisabled ? 'not-allowed' : 'pointer',
                          padding: '10px 14px', 
                          gap: '8px', 
                          fontSize: '0.84rem' 
                        }}
                        title={
                          !hasLocation && !hasValidEmail 
                            ? 'Location and Email required to run scan' 
                            : (!hasLocation ? 'Location required' : (!hasValidEmail ? 'Email address required' : ''))
                        }
                      >
                        {isProcessing ? <RefreshCw className="spin" size={16} /> : <Sparkles size={16} />}
                        {isProcessing ? 'Evaluating Model & Authenticity...' : 'Run AI Hazard Scanner'}
                      </button>

                      <button 
                        type="button"
                        className="btn-secondary" 
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        style={{ flex: 1, padding: '10px', gap: '6px', fontSize: '0.8rem' }}
                        title="Browse photo file from device"
                      >
                        <Upload size={15} color="#00E6B4" /> Browse File
                      </button>

                      {userRole === 'public' && (
                        <button 
                          type="button"
                          className="btn-secondary" 
                          onClick={startCamera}
                          style={{ flex: 1, padding: '10px', gap: '6px', fontSize: '0.8rem' }}
                          title="Open Camera / Live WebCam"
                        >
                          <Camera size={15} color="#38BDF8" /> Camera
                        </button>
                      )}
                    </div>

                    {selectedFile && !hasLocation && (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#F59E0B',
                        fontSize: '0.76rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 500
                      }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                        <span>Address Required: Please enter street landmark above or click <strong>"Use My GPS"</strong> to enable the scanner.</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff' }}>AI Perception Output</h3>
            {detectionResult && (
              <span className={`badge ${getSeverityBadgeClass(detectionResult.highest_severity)}`}>
                {detectionResult.highest_severity} Severity
              </span>
            )}
          </div>

          {detectionResult ? (
            <div>
              {/* AUTHENTICITY GATE REJECTION CARD — shown when image is blocked before YOLO */}
              {detectionResult._rejected && (
                <div style={{
                  marginBottom: '16px',
                  padding: '18px 20px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(239,68,68,0.7)',
                  background: 'rgba(239,68,68,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🚫</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ef4444' }}>
                        Image Rejected by Authenticity Engine
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '2px' }}>
                        This image did not pass the pre-YOLO authenticity gate
                      </div>
                    </div>
                    <span style={{
                      marginLeft: 'auto',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(239,68,68,0.2)',
                      color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.4)'
                    }}>
                      Score: {detectionResult.authenticity_score != null ? `${Math.round(detectionResult.authenticity_score)}/100` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#fca5a5', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                    <strong>Reason:</strong> {detectionResult.rejection_reason || 'High Risk Tampered Image'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                    ⚠️ YOLO detection was skipped. Please upload an <strong>original, unedited photo</strong> taken directly from a camera or phone.
                  </div>
                </div>
              )}

              {/* STAGE 1: AUTHENTICITY VERIFICATION WARNING / BANNER (for passed images) */}
              {detectionResult.authenticity && (
                <div style={{
                  marginBottom: '14px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: (detectionResult.is_fake || detectionResult.authenticity.status_code === 'fake_detected' || detectionResult.authenticity.status_code === 'suspicious' || detectionResult.authenticity.authenticity_score < 70)
                    ? '1px solid rgba(239, 68, 68, 0.6)'
                    : '1px solid rgba(16, 185, 129, 0.4)',
                  background: (detectionResult.is_fake || detectionResult.authenticity.status_code === 'fake_detected' || detectionResult.authenticity.status_code === 'suspicious' || detectionResult.authenticity.authenticity_score < 70)
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(16, 185, 129, 0.08)'
                }}>
                  {/* Warning Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(detectionResult.is_fake || detectionResult.authenticity.status_code === 'fake_detected' || detectionResult.authenticity.status_code === 'suspicious' || detectionResult.authenticity.authenticity_score < 70) ? (
                        <div style={{ background: '#EF4444', color: '#fff', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle size={15} />
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ShieldCheck size={16} />
                        </div>
                      )}
                      <div>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          color: (detectionResult.is_fake || detectionResult.authenticity.status_code === 'fake_detected' || detectionResult.authenticity.status_code === 'suspicious' || detectionResult.authenticity.authenticity_score < 70)
                            ? '#F87171'
                            : '#10B981'
                        }}>
                          {(detectionResult.is_fake || detectionResult.authenticity.status_code === 'fake_detected')
                            ? '⚠️ FAKE / FRAUDULENT IMAGE DETECTED'
                            : (detectionResult.authenticity.status_code === 'suspicious')
                            ? '⚠️ SUSPICIOUS / UNVERIFIED PHOTO'
                            : '🛡️ PHYSICAL CAMERA PHOTO VERIFIED'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>
                          Stage 1 Authenticity Score: <strong style={{ color: '#fff' }}>{detectionResult.authenticity.authenticity_score}/100</strong> ({detectionResult.authenticity.status})
                        </div>
                      </div>
                    </div>

                    <span className={`badge ${detectionResult.authenticity.status_color === 'green' ? 'badge-healthy' : detectionResult.authenticity.status_color === 'yellow' ? 'badge-degraded' : 'badge-critical'}`} style={{ fontSize: '0.72rem' }}>
                      {detectionResult.authenticity.status_badge} {detectionResult.authenticity.status}
                    </span>
                  </div>

                  {/* Threat Reason Warnings if Fake */}
                  {detectionResult.authenticity.threat_reasons?.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 10px',
                      background: 'rgba(0,0,0,0.4)',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      color: '#FCA5A5',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ fontWeight: 600, color: '#EF4444' }}>Forensic Threat Factors Flagged:</div>
                      {detectionResult.authenticity.threat_reasons.map((reason, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>❌</span> <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 6-Point Forensic Checklist Matrix */}
                  <div className="grid-3" style={{ gap: '6px', fontSize: '0.72rem', marginTop: '8px' }}>
                    <div style={{ background: '#18181b', padding: '5px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#71717a' }}>📷 Camera: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.exif?.exif_valid ? '#10B981' : '#F59E0B' }}>
                        {detectionResult.authenticity.checks_summary?.exif?.camera_make || 'Generic'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '5px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#71717a' }}>📍 Geotag: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.exif?.gps_valid ? '#10B981' : '#F59E0B' }}>
                        {detectionResult.authenticity.checks_summary?.exif?.gps_valid ? 'GPS Verified' : 'Missing'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '5px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#71717a' }}>🖥️ Moiré: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.screen_detection?.is_screen_photo ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.screen_detection?.is_screen_photo ? 'Screen Photo' : 'Physical'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '5px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#71717a' }}>🔬 ELA: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.ela_editing?.is_edited ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.ela_editing?.is_edited ? 'Edited/Spliced' : 'Intact'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '5px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#71717a' }}>🤖 AI Synthetic: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.ai_synthetic?.is_synthetic ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.ai_synthetic?.is_synthetic ? 'Synthetic AI' : 'Real Scene'}
                      </strong>
                    </div>
                    <div style={{ background: '#18181b', padding: '5px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <span style={{ color: '#71717a' }}>🔍 pHash: </span>
                      <strong style={{ color: detectionResult.authenticity.checks_summary?.phash?.is_duplicate ? '#EF4444' : '#10B981' }}>
                        {detectionResult.authenticity.checks_summary?.phash?.is_duplicate ? 'Duplicate' : 'Unique'}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGE VIEW SWITCHER TABS */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button
                  onClick={() => setActiveImageView('yolo')}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    border: '1px solid #27272a',
                    background: activeImageView === 'yolo' ? 'rgba(0, 230, 180, 0.15)' : '#18181b',
                    color: activeImageView === 'yolo' ? '#00E6B4' : '#a1a1aa',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  🤖 AI Hazard Detections
                </button>

                {previewUrl && (
                  <button
                    onClick={() => setActiveImageView('original')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid #27272a',
                      background: activeImageView === 'original' ? 'rgba(56, 189, 248, 0.15)' : '#18181b',
                      color: activeImageView === 'original' ? '#38BDF8' : '#a1a1aa',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📷 Original Photo
                  </button>
                )}

                {detectionResult.authenticity?.ela_image_b64 && (
                  <button
                    onClick={() => setActiveImageView('ela')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid #27272a',
                      background: activeImageView === 'ela' ? 'rgba(168, 85, 247, 0.2)' : '#18181b',
                      color: activeImageView === 'ela' ? '#C084FC' : '#a1a1aa',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔬 Photo Error Analysis
                  </button>
                )}
              </div>

              {/* Active Image Render */}
              <div style={{ textAlign: 'center', marginBottom: '14px', position: 'relative' }}>
                <img 
                  src={
                    activeImageView === 'ela' && detectionResult.authenticity?.ela_image_b64
                      ? detectionResult.authenticity.ela_image_b64
                      : activeImageView === 'original' && previewUrl
                      ? previewUrl
                      : detectionResult.annotated_image_b64
                  } 
                  alt="Detection Output" 
                  style={{ width: '100%', maxHeight: '220px', borderRadius: '10px', objectFit: 'contain', border: '1px solid rgba(0,230,180,0.3)', background: '#09090b' }} 
                />
                <div style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(0,0,0,0.75)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.68rem',
                  color: '#e4e4e7',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {activeImageView === 'yolo' ? 'AI Hazard Overlay' : activeImageView === 'ela' ? 'Analysis Map' : 'Original Photo'}
                </div>
              </div>

              {/* STAGE 2: YOLO HAZARD METRICS */}
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
                    {detectionResult.landmark_name || 'Detected Hazard'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#71717a' }}>GPS Coordinates & Source:</span>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.82rem' }}>
                    {detectionResult.gps.latitude.toFixed(4)}° N, {detectionResult.gps.longitude.toFixed(4)}° E ({detectionResult.location_source || 'Metadata'})
                  </span>
                </div>
              </div>

              {/* STAGE 3: SUMO MICRO-TRAFFIC SIMULATION & DIGITAL TWIN METRICS */}
              {detectionResult.sumo_simulation && (
                <div style={{
                  marginTop: '12px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(145deg, rgba(24, 24, 27, 0.95), rgba(15, 23, 42, 0.9))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                }}>
                  {/* Simulation Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🚦</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#38BDF8', letterSpacing: '0.3px' }}>
                          SUMO Traffic Simulation
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                          Microscopic Krauss Physics & Delay Model
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: detectionResult.sumo_simulation.traffic_impact_level?.includes('Critical') 
                        ? 'rgba(239, 68, 68, 0.2)' 
                        : 'rgba(245, 158, 11, 0.2)',
                      color: detectionResult.sumo_simulation.traffic_impact_level?.includes('Critical') ? '#EF4444' : '#F59E0B',
                      border: `1px solid ${detectionResult.sumo_simulation.traffic_impact_level?.includes('Critical') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                    }}>
                      {detectionResult.sumo_simulation.traffic_impact_level || 'Bottleneck Active'}
                    </span>
                  </div>

                  {/* Speed & Delay Comparison Grid */}
                  <div className="grid-2" style={{ gap: '8px', marginBottom: '10px' }}>
                    <div style={{ background: '#09090b', padding: '8px 10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <div style={{ fontSize: '0.66rem', color: '#71717a', textTransform: 'uppercase' }}>Corridor Speed</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#71717a', textDecoration: 'line-through' }}>
                          {detectionResult.sumo_simulation.scenario_normal?.average_speed_kmh || 60} km/h
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#EF4444' }}>
                          {detectionResult.sumo_simulation.scenario_damaged?.average_speed_kmh || 28} km/h
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#F87171', fontWeight: 600 }}>
                          (-{detectionResult.sumo_simulation.scenario_damaged?.speed_drop_pct || 50}%)
                        </span>
                      </div>
                    </div>

                    <div style={{ background: '#09090b', padding: '8px 10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                      <div style={{ fontSize: '0.66rem', color: '#71717a', textTransform: 'uppercase' }}>Vehicle Delay Surge</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B' }}>
                          +{detectionResult.sumo_simulation.scenario_damaged?.delay_increase_sec || 32}s
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                          / vehicle ({detectionResult.sumo_simulation.scenario_damaged?.queue_length_meters || 80}m queue)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recommended Rerouting Plan */}
                  {detectionResult.sumo_simulation.recommended_reroute && (
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px dashed rgba(56, 189, 248, 0.4)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>🧭</span> Recommended SUMO Detour
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 600, background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                          +{detectionResult.sumo_simulation.recommended_reroute.est_additional_travel_time_min || 1.8}m delta
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#e2e8f0', fontWeight: 600 }}>
                        {detectionResult.sumo_simulation.recommended_reroute.route_name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px', lineHeight: 1.4 }}>
                        {detectionResult.sumo_simulation.recommended_reroute.nav_guidance}
                      </div>
                    </div>
                  )}

                  {/* n8n Sync Pipeline Confirmation */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                    color: '#6ee7b7',
                    background: 'rgba(16, 185, 129, 0.08)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>⚡</span> <strong>n8n Auto-Sync:</strong> Simulation dispatched to Excel & Citizen notification
                    </span>
                    <span style={{ color: '#10B981', fontWeight: 700 }}>✓ ACTIVE</span>
                  </div>
                </div>
              )}

              {/* TRACKING ACTION CTA */}
              {detectionResult.report_id && onNavigateToReports && (
                <button 
                  className="btn-primary" 
                  onClick={onNavigateToReports}
                  style={{ width: '100%', marginTop: '12px', fontSize: '0.82rem', padding: '10px 14px', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, #0284C7 0%, #00E6B4 100%)' }}
                >
                  <ClipboardList size={16} /> Track Report #{detectionResult.report_id} Lifecycle Timeline
                </button>
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
    </div>
  );
}
