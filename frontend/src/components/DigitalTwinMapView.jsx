import React, { useEffect, useState, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { AlertCircle, Navigation, Activity, BarChart2, PieChart as PieIcon, Loader, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

const getRiskColor = (severity) => {
  switch (severity) {
    case 'Critical': return '#EF4444';
    case 'High': return '#F59E0B';
    case 'Medium': return '#38BDF8';
    default: return '#475569';
  }
};

export default function DigitalTwinMapView() {
  const [network, setNetwork] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRoadNetwork, setShowRoadNetwork] = useState(true);
  
  // Map engine states
  const [mapError, setMapError] = useState(null);
  const [useLeaflet, setUseLeaflet] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const mapContainerRef = useRef(null);
  const mapObj = useRef(null);
  const leafletMapObj = useRef(null);
  const leafletPolylinesRef = useRef({});

  // 1. Fetch road segments network on mount
  useEffect(() => {
    fetch('/api/traffic/network')
      .then((res) => res.json())
      .then((data) => {
        setNetwork(data.segments || []);
        if (data.segments && data.segments.length > 0) {
          setSelectedRoad(data.segments[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch traffic network', err);
        setLoading(false);
      });
  }, []);

  // 2. Initialize MapTiler WebGL Map
  useEffect(() => {
    if (!mapContainerRef.current || useLeaflet) return;
    if (mapObj.current) return;

    try {
      maptilersdk.config.apiKey = 'EoWexBznkKn3ph7oAKfn';

      const map = new maptilersdk.Map({
        container: mapContainerRef.current,
        apiKey: 'EoWexBznkKn3ph7oAKfn',
        style: 'dataviz-dark',
        center: [77.2090, 28.6139],
        zoom: 13,
        terrain: true
      });

      mapObj.current = map;

      // Force canvas layout resize on tick
      setTimeout(() => {
        if (mapObj.current) {
          mapObj.current.resize();
        }
      }, 150);

      map.on('load', () => {
        map.resize();

        map.addSource('roads-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'roads-line',
          type: 'line',
          source: 'roads-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': showRoadNetwork ? 'visible' : 'none'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['get', 'width'],
            'line-opacity': 0.88
          }
        });

        map.on('mouseenter', 'roads-line', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'roads-line', () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // Catch critical stylesheet/fetching errors only
      map.on('error', (e) => {
        console.error("MapTiler error event:", e);
        // Only trigger Leaflet fallback on critical load failures, not minor tile warnings
        if (e.error?.status === 401 || e.error?.status === 403 || !map.loaded()) {
          setMapError(e.error?.message || "Failed to load MapTiler tiles.");
          setUseLeaflet(true);
        }
      });

    } catch (err) {
      console.error("Map constructor crash:", err);
      setMapError("WebGL/Map initialization crash: " + err.message);
      setUseLeaflet(true);
    }

    return () => {
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
  }, [useLeaflet]);

  // 3. Sync road visibility toggle in MapTiler
  useEffect(() => {
    const map = mapObj.current;
    if (!map || useLeaflet) return;
    if (map.getLayer('roads-line')) {
      map.setLayoutProperty('roads-line', 'visibility', showRoadNetwork ? 'visible' : 'none');
    }
  }, [showRoadNetwork, useLeaflet]);

  // 4. Sync MapTiler source data
  useEffect(() => {
    const map = mapObj.current;
    if (!map || useLeaflet || network.length === 0) return;

    const updateSource = () => {
      map.resize();
      const source = map.getSource('roads-source');
      if (!source) return;

      const features = network.map(road => ({
        type: 'Feature',
        properties: {
          id: road.id,
          name: road.name,
          severity: road.severity,
          potholes: road.potholes,
          color: getRiskColor(road.severity),
          width: selectedRoad?.id === road.id ? 8 : 5
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [road.start[0], road.start[1]],
            [road.end[0], road.end[1]]
          ]
        }
      }));

      source.setData({
        type: 'FeatureCollection',
        features: features
      });

      const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
      existingMarkers.forEach(el => el.remove());

      // Fetch dynamic database potholes
      fetch('/api/detections')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.detections && data.detections.length > 0) {
            data.detections.forEach(d => {
              if (!d.Longitude || !d.Latitude || d.Longitude === 0 || d.Latitude === 0) return;
              
              let markerColor = '#10B981';
              if (d.Severity === 'Critical') markerColor = '#EF4444';
              else if (d.Severity === 'High') markerColor = '#F59E0B';
              else if (d.Severity === 'Medium') markerColor = '#38BDF8';

              const popup = new maptilersdk.Popup({ offset: 25 })
                .setHTML(`
                  <div style="color: #0f172a; font-family: sans-serif; font-size: 11px; padding: 2px;">
                    <span style="color: ${markerColor}; font-weight: bold;">⚠️ Reported Pothole (${d.Severity})</span><br/>
                    File: <b>${d.Image}</b><br/>
                    Risk Score: <b>${d.Risk_Score}/100</b>
                  </div>
                `);

              new maptilersdk.Marker({ color: markerColor, scale: 1.1 })
                .setLngLat([d.Longitude, d.Latitude])
                .setPopup(popup)
                .addTo(map);
            });

            const latest = data.detections.find(d => d.Longitude && d.Latitude && d.Longitude !== 0 && d.Latitude !== 0);
            if (latest) {
              map.setCenter([latest.Longitude, latest.Latitude]);
              map.setZoom(14);
            }
          }
        })
        .catch(err => console.error('Error fetching dynamic potholes:', err));
    };

    if (map.loaded()) {
      updateSource();
    } else {
      map.once('load', updateSource);
    }

    const handleClick = (e) => {
      if (e.features && e.features.length > 0) {
        const clickedId = e.features[0].properties.id;
        const road = network.find(r => r.id === clickedId);
        if (road) {
          setSelectedRoad(road);
        }
      }
    };

    map.off('click', 'roads-line', handleClick);
    map.on('click', 'roads-line', handleClick);

  }, [network, selectedRoad, useLeaflet]);


  // ==========================================
  // DYNAMIC LEAFLET FALLBACK ENGINE
  // ==========================================

  useEffect(() => {
    if (!useLeaflet || leafletLoaded) return;

    console.log("[Fallback Engine]: Initializing Leaflet 2D script injection...");
    
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setLeafletLoaded(true);
    }
  }, [useLeaflet]);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || !useLeaflet) return;
    if (leafletMapObj.current) {
      const L = window.L;
      Object.keys(leafletPolylinesRef.current).forEach(id => {
        const polyline = leafletPolylinesRef.current[id];
        const road = network.find(r => String(r.id) === id);
        if (road) {
          polyline.setStyle({
            weight: selectedRoad?.id === road.id ? 8 : 4,
            opacity: selectedRoad?.id === road.id ? 0.95 : 0.65
          });
        }
      });
      return;
    }

    const L = window.L;
    
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView([28.6139, 77.2090], 13);

    leafletMapObj.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    const polylines = {};
    network.forEach(road => {
      const color = getRiskColor(road.severity);
      const weight = selectedRoad?.id === road.id ? 8 : 4;
      
      const polyline = L.polyline([
        [road.start[1], road.start[0]],
        [road.end[1], road.end[0]]
      ], {
        color: color,
        weight: weight,
        opacity: selectedRoad?.id === road.id ? 0.95 : 0.65,
        lineJoin: 'round'
      }).addTo(map);

      polyline.on('click', () => {
        setSelectedRoad(road);
      });

      polylines[road.id] = polyline;
    });
    leafletPolylinesRef.current = polylines;

    fetch('/api/detections')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.detections && data.detections.length > 0) {
          let hasCentered = false;
          
          data.detections.forEach(d => {
            if (!d.Longitude || !d.Latitude || d.Longitude === 0 || d.Latitude === 0) return;
            
            const markerColor = d.Severity === 'Critical' ? '#EF4444' : d.Severity === 'High' ? '#F59E0B' : '#38BDF8';
            
            const circleMarker = L.circleMarker([d.Latitude, d.Longitude], {
              radius: 7,
              fillColor: markerColor,
              color: '#ffffff',
              weight: 1.5,
              opacity: 0.9,
              fillOpacity: 0.75
            }).addTo(map);

            circleMarker.bindPopup(`
              <div style="color: #0f172a; font-family: sans-serif; font-size: 11px; padding: 2px;">
                <span style="color: ${markerColor}; font-weight: bold;">⚠️ Reported Pothole (${d.Severity})</span><br/>
                File: <b>${d.Image}</b><br/>
                Risk: <b>${d.Risk_Score}/100</b>
              </div>
            `);

            if (!hasCentered) {
              map.setView([d.Latitude, d.Longitude], 14);
              hasCentered = true;
            }
          });
        }
      })
      .catch(err => console.error("[Fallback Engine]: Error fetching potholes:", err));

    return () => {
      if (leafletMapObj.current) {
        leafletMapObj.current.remove();
        leafletMapObj.current = null;
        leafletPolylinesRef.current = {};
      }
    };
  }, [leafletLoaded, network, useLeaflet]);

  useEffect(() => {
    if (!leafletMapObj.current || !useLeaflet) return;
    Object.keys(leafletPolylinesRef.current).forEach(id => {
      const polyline = leafletPolylinesRef.current[id];
      if (showRoadNetwork) {
        polyline.addTo(leafletMapObj.current);
      } else {
        polyline.remove();
      }
    });
  }, [showRoadNetwork, useLeaflet]);


  const capacityVsTrafficData = network.map(seg => ({
    name: seg.name.replace('Northern Arterial Highway', 'Road A')
                  .replace('Central Bypass Ring', 'Road B')
                  .replace('Cross Connector Avenue', 'Road C')
                  .replace('Southern Expressway', 'Road D')
                  .replace('Western Outer Ring', 'Road E')
                  .replace('Eastern Link Road', 'Road F'),
    fullName: seg.name,
    traffic: seg.base_traffic,
    capacity: seg.base_capacity,
    potholes: seg.potholes,
    severity: seg.severity,
    color: getRiskColor(seg.severity)
  }));

  return (
    <div>
      {/* Global CSS Injector to guarantee WebGL canvas fits exactly */}
      <style>{`
        .maplibregl-canvas, .mapboxgl-canvas {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0;
          left: 0;
        }
        .maplibregl-map, .mapboxgl-map {
          overflow: visible !important;
        }
      `}</style>

      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* Map Container Card */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="#00E6B4" /> 
              {useLeaflet ? 'Standard Spatial Road Map' : 'Advanced Spatial Road Map'}
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Toggle to allow manual fallback switch for testing */}
              <button
                onClick={() => setUseLeaflet(prev => !prev)}
                style={{
                  fontSize: '0.72rem',
                  background: 'rgba(56, 189, 248, 0.08)',
                  color: '#38BDF8',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={12} /> {useLeaflet ? 'Switch to Advanced' : 'Force Standard Map'}
              </button>

              <button 
                onClick={() => setShowRoadNetwork(prev => !prev)}
                style={{
                  fontSize: '0.72rem',
                  background: showRoadNetwork ? 'rgba(0, 230, 180, 0.2)' : '#18181b',
                  color: showRoadNetwork ? '#00E6B4' : '#a1a1aa',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${showRoadNetwork ? 'rgba(0,230,180,0.4)' : 'var(--border-muted)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                {showRoadNetwork ? '🚧 Hide Repair Lines' : '🚧 Show Repair Lines'}
              </button>
              
              <span style={{ 
                fontSize: '0.72rem', 
                background: '#18181b', 
                color: useLeaflet ? '#38BDF8' : '#00E6B4', 
                padding: '3px 8px', 
                borderRadius: '6px', 
                border: `1px solid ${useLeaflet ? 'rgba(56,189,248,0.2)' : 'rgba(0,230,180,0.2)'}` 
              }}>
                {useLeaflet ? 'Standard 2D Engine' : 'Hardware Accelerated Engine'}
              </span>
            </div>
          </div>

          <div style={{ height: '440px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-muted)', position: 'relative' }}>
            <div ref={mapContainerRef} style={{ height: '100%', width: '100%', background: '#09090b', position: 'relative', zIndex: 1 }} />
            
            {useLeaflet && !leafletLoaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09090b', zIndex: 10 }}>
                <Loader size={36} className="animate-spin" color="#38BDF8" style={{ marginBottom: '12px' }} />
                <div style={{ color: '#fff', fontSize: '0.88rem' }}>Loading Map Engine...</div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Road Details Panel */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#38BDF8" /> Segment Telemetry
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Real-time Node</span>
          </div>

          {selectedRoad ? (
            <div>
              <div style={{ padding: '14px', background: '#18181b', borderRadius: '10px', marginBottom: '16px', border: '1px solid var(--border-muted)' }}>
                <div style={{ fontSize: '0.72rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>SELECTED ROAD SEGMENT</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '3px' }}>{selectedRoad.name}</div>
                <div style={{ marginTop: '8px' }}>
                  <span className={`badge badge-${selectedRoad.severity.toLowerCase()}`}>
                    {selectedRoad.severity} Severity
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Detected Potholes</span>
                  <span style={{ fontWeight: 700, color: '#F59E0B' }}>{selectedRoad.potholes} Hazards</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Base Traffic Volume</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{selectedRoad.base_traffic} veh/hr</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Max Road Capacity</span>
                  <span style={{ fontWeight: 600, color: '#fff' }}>{selectedRoad.base_capacity} veh/hr</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Speed Limit</span>
                  <span style={{ fontWeight: 600, color: '#00E6B4' }}>{selectedRoad.speed_kmh} km/h</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Vulnerable Zone</span>
                  <span style={{ fontWeight: 600, color: selectedRoad.proximity_school_hospital ? '#EF4444' : '#10B981' }}>
                    {selectedRoad.proximity_school_hospital ? 'Yes (School/Hospital)' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#71717a', fontSize: '0.85rem' }}>Click any road line on the map to inspect live segment telemetry.</p>
          )}
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid-2">
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} color="#00E6B4" /> Road Segment Traffic vs Maximum Capacity
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>veh / hr</span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capacityVsTrafficData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '0.78rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '6px' }}>{payload[0].payload.fullName}</div>
                          {payload.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color || p.fill }} />
                              <span style={{ color: '#a1a1aa' }}>{p.name}:</span>
                              <span style={{ color: '#fff', fontWeight: 600 }}>{p.value} veh/hr</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#a1a1aa' }} />
                <Bar dataKey="traffic" name="Traffic Volume" fill="#00E6B4" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="capacity" name="Max Capacity" fill="#38BDF8" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={16} color="#EF4444" /> Segment Pothole Hazard Density
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Hazard Count</span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capacityVsTrafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '0.78rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{payload[0].payload.fullName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: payload[0].payload.color }} />
                            <span style={{ color: '#a1a1aa' }}>Potholes:</span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{payload[0].value} Hazards</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="potholes" name="Detected Potholes" radius={[4, 4, 0, 0]} barSize={20}>
                  {capacityVsTrafficData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
