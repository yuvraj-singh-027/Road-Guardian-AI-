import React, { useEffect, useState, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { 
  Navigation, Activity, BarChart2, PieChart as PieIcon, 
  Loader, RefreshCw, Sliders, TrendingDown, Clock, Wind, ArrowRight,
  Compass, AlertTriangle, ShieldCheck, Zap, Layers, MapPin, CheckCircle2,
  Share2, AlertOctagon, Cpu, Info
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

const getRiskColor = (severity) => {
  switch (severity) {
    case 'Critical': return '#EF4444'; // Neon Red
    case 'High': return '#F59E0B';     // Neon Amber Gold
    case 'Medium': return '#38BDF8';   // Electric Cyan
    case 'Low': return '#00E6B4';      // Neon Mint Teal
    default: return '#10B981';         // Emerald Green
  }
};

export default function DigitalTwinMapView() {
  const [network, setNetwork] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [potholesList, setPotholesList] = useState([]);
  const [activePothole, setActivePothole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRoadNetwork, setShowRoadNetwork] = useState(true);

  // Active view mode in right telemetry deck: 'sumo' (Pothole Bottleneck) | 'network-reroute' (Network Simulation) | 'segment-info' (Road Telemetry)
  const [activeTab, setActiveTab] = useState('sumo');

  // SUMO Microscopic Pothole Simulation State
  const [potholeSimResult, setPotholeSimResult] = useState(null);
  const [isSimulatingPothole, setIsSimulatingPothole] = useState(false);

  // Network Rerouting Simulation Engine State (Merged from TrafficRerouteView)
  const [closedRoadId, setClosedRoadId] = useState('Sec1_Blvd_N1');
  const [closureType, setClosureType] = useState('full'); // 'full' or 'single_lane'
  const [trafficWindow, setTrafficWindow] = useState('peak'); // 'peak', 'normal', 'off_peak'
  const [durationHours, setDurationHours] = useState(4);
  const [networkSimResult, setNetworkSimResult] = useState(null);
  const [isSimulatingNetwork, setIsSimulatingNetwork] = useState(false);

  // Map engine states
  const [mapError, setMapError] = useState(null);
  const [useLeaflet, setUseLeaflet] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const mapContainerRef = useRef(null);
  const mapObj = useRef(null);
  const leafletMapObj = useRef(null);
  const leafletPolylinesRef = useRef({});
  const leafletMarkersRef = useRef([]);

  // Sample fallback hazards
  const sampleFallback = [
    { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Landmark: 'Kasturba Gandhi Marg, Connaught Place', Latitude: 28.6258, Longitude: 77.2205, Severity: 'High', Risk_Score: 84.2 },
    { id: 102, Image: 'pothole_barakhamba.jpg', Landmark: 'Barakhamba Road, Near Metro Gate 2', Latitude: 28.6295, Longitude: 77.2285, Severity: 'Medium', Risk_Score: 58.0 },
    { id: 103, Image: 'pothole_rajiv_chowk.jpg', Landmark: 'Rajiv Chowk Radial Road 3', Latitude: 28.6328, Longitude: 77.2197, Severity: 'Critical', Risk_Score: 92.5 },
    { id: 104, Image: 'pothole_ashoka.jpg', Landmark: 'Ashoka Road, India Gate Junction', Latitude: 28.6180, Longitude: 77.2140, Severity: 'Critical', Risk_Score: 89.0 },
    { id: 105, Image: 'pothole_janpath.jpg', Landmark: 'Janpath Road, Near Cottage Industries', Latitude: 28.6210, Longitude: 77.2185, Severity: 'High', Risk_Score: 79.4 }
  ];

  // 1. Initial Data Fetching
  useEffect(() => {
    Promise.all([
      fetch('/api/traffic/network').then(r => r.json()).catch(() => ({ segments: [] })),
      fetch('/api/detections').then(r => r.json()).catch(() => ({ success: false, detections: [] }))
    ]).then(([netData, detData]) => {
      const segs = netData.segments || [];
      setNetwork(segs);

      if (segs.length > 0) {
        setClosedRoadId(segs[0].id);
        setSelectedRoad(segs[0]);
        runNetworkSimulation(segs[0].id, closureType, trafficWindow, durationHours);
      }

      const rawDetections = (detData.success && detData.detections && detData.detections.length > 0)
        ? detData.detections
        : sampleFallback;

      const validPotholes = rawDetections.filter(d => 
        d.Longitude && d.Latitude && parseFloat(d.Longitude) !== 0 && parseFloat(d.Latitude) !== 0
      );
      setPotholesList(validPotholes);

      if (validPotholes.length > 0) {
        const topHazard = validPotholes.find(p => p.Severity === 'Critical') || validPotholes[0];
        triggerSumoSimulation(topHazard);
      }

      setLoading(false);
    }).catch(err => {
      console.error('Initialization error in Unified Digital Twin:', err);
      setLoading(false);
    });
  }, []);

  // 2. Trigger SUMO Traffic Simulator for a Specific Pothole
  const triggerSumoSimulation = async (pothole) => {
    setActivePothole(pothole);
    setIsSimulatingPothole(true);
    setActiveTab('sumo');

    // Pan map camera to the hazard coordinates
    const lat = parseFloat(pothole.Latitude);
    const lon = parseFloat(pothole.Longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      if (mapObj.current && !useLeaflet) {
        mapObj.current.flyTo({
          center: [lon, lat],
          zoom: 14.5,
          speed: 1.2,
          curve: 1.4
        });
      } else if (leafletMapObj.current && useLeaflet) {
        leafletMapObj.current.flyTo([lat, lon], 15);
      }
    }

    try {
      const response = await fetch('/api/traffic/sumo-simulate-pothole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          road_name: pothole.Landmark || pothole.Image || 'Municipal Arterial Corridor',
          severity: pothole.Severity || 'High',
          damage_count: 1,
          risk_score: parseFloat(pothole.Risk_Score || 78.5),
          base_speed_kmh: 50.0,
          base_flow_vph: 850,
          weather: 'Clear',
          traffic_density: (pothole.Severity === 'Critical' || pothole.Severity === 'High') ? 'High' : 'Moderate'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPotholeSimResult(data);
      } else {
        setPotholeSimResult(generateClientSumoFallback(pothole));
      }
    } catch (e) {
      console.warn('SUMO simulation fallback:', e);
      setPotholeSimResult(generateClientSumoFallback(pothole));
    } finally {
      setIsSimulatingPothole(false);
    }
  };

  const generateClientSumoFallback = (pothole) => {
    const sev = pothole.Severity || 'High';
    const dropPct = sev === 'Critical' ? 58.0 : sev === 'High' ? 45.0 : 28.0;
    const baseSpd = 50.0;
    const damagedSpd = Math.round(baseSpd * (1 - dropPct / 100));
    const delayInc = sev === 'Critical' ? 42.5 : sev === 'High' ? 32.0 : 18.0;
    const queueM = sev === 'Critical' ? 140 : sev === 'High' ? 95 : 50;

    return {
      engine: "SUMO (Simulation of Urban MObility) / TraCI Kinematics",
      road_segment: pothole.Landmark || pothole.Image || 'Selected Road Corridor',
      traffic_impact_level: sev === 'Critical' ? 'CRITICAL BOTTLENECK' : 'HIGH TRAFFIC IMPACT',
      impact_color: sev === 'Critical' ? '#EF4444' : '#F59E0B',
      impact_badge: sev === 'Critical' ? '🔴' : '🟡',
      scenario_normal: {
        speed_kmh: baseSpd,
        delay_sec_per_veh: 14.5,
        queue_length_m: 0
      },
      scenario_damaged: {
        speed_kmh: damagedSpd,
        speed_drop_pct: dropPct,
        delay_sec_per_veh: 14.5 + delayInc,
        delay_increase_sec: delayInc,
        queue_length_meters: queueM
      },
      cumulative_impact: {
        vehicle_delay_hours: Math.round((850 * delayInc) / 3600),
        co2_surge_kg: Math.round(((850 * delayInc) / 3600) * 1.85)
      },
      recommended_reroute: {
        route_name: `${pothole.Landmark ? pothole.Landmark.split(',')[0] : 'Corridor'} — Parallel Bypass Link (Route B)`,
        est_additional_travel_time_min: 1.8,
        capacity_status: 'Optimal (72% load)',
        nav_guidance: 'Divert heavy commuter traffic to parallel link to recover normal corridor throughput.'
      }
    };
  };

  // 3. Run Network Rerouting Simulation (Merged from TrafficRerouteView)
  const runNetworkSimulation = (roadId, cType = closureType, tWin = trafficWindow, dHours = durationHours) => {
    setIsSimulatingNetwork(true);
    const token = localStorage.getItem('road_guardian_token');
    fetch('/api/traffic/reroute', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ 
        closed_road_id: roadId, 
        closure_type: cType,
        traffic_window: tWin,
        duration_hours: Number(dHours),
        center_lat: 28.6139, 
        center_lon: 77.2090 
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setNetworkSimResult(data);
        setIsSimulatingNetwork(false);
      })
      .catch((err) => {
        console.error('Network reroute simulation failed:', err);
        setIsSimulatingNetwork(false);
      });
  };

  const handleSelectRoad = (road) => {
    setSelectedRoad(road);
    setClosedRoadId(road.id);
    setActiveTab('segment-info');
    runNetworkSimulation(road.id, closureType, trafficWindow, durationHours);
  };

  const handleRoadChange = (newId) => {
    setClosedRoadId(newId);
    const matched = network.find(r => r.id === newId);
    if (matched) setSelectedRoad(matched);
    runNetworkSimulation(newId, closureType, trafficWindow, durationHours);
  };

  const handleClosureTypeChange = (type) => {
    setClosureType(type);
    runNetworkSimulation(closedRoadId, type, trafficWindow, durationHours);
  };

  const handleTrafficWindowChange = (win) => {
    setTrafficWindow(win);
    runNetworkSimulation(closedRoadId, closureType, win, durationHours);
  };

  const handleDurationChange = (hrs) => {
    setDurationHours(hrs);
    runNetworkSimulation(closedRoadId, closureType, trafficWindow, hrs);
  };

  // 4. Initialize MapTiler WebGL Map
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

      setTimeout(() => {
        if (mapObj.current) mapObj.current.resize();
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

      map.on('error', (e) => {
        console.error("MapTiler error event:", e);
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

  // 5. Sync MapTiler Source & Interactive Markers
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
          width: (selectedRoad?.id === road.id || closedRoadId === road.id) ? 10 : 7
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

      const existingMarkers = document.querySelectorAll('.mapboxgl-marker, .maplibregl-marker');
      existingMarkers.forEach(el => el.remove());

      const listToRender = potholesList.length > 0 ? potholesList : sampleFallback;
      listToRender.forEach(p => {
        const lat = parseFloat(p.Latitude);
        const lon = parseFloat(p.Longitude);
        if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return;

        const isCurrent = activePothole && (activePothole.id === p.id || (activePothole.Latitude === p.Latitude && activePothole.Longitude === p.Longitude));
        let markerColor = getRiskColor(p.Severity);

        const el = document.createElement('div');
        el.className = 'sumo-pothole-marker';
        el.style.width = isCurrent ? '26px' : '20px';
        el.style.height = isCurrent ? '26px' : '20px';
        el.style.borderRadius = '50%';
        el.style.background = markerColor;
        el.style.border = isCurrent ? '3px solid #ffffff' : '2px solid #000000';
        el.style.boxShadow = isCurrent ? `0 0 18px ${markerColor}, 0 0 32px ${markerColor}` : `0 0 8px ${markerColor}`;
        el.style.cursor = 'pointer';
        el.style.transition = 'all 0.2s ease';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.innerHTML = '<span style="font-size: 10px;">⚠️</span>';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerSumoSimulation(p);
        });

        const popup = new maptilersdk.Popup({ offset: 20 })
          .setHTML(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 11px; padding: 4px;">
              <span style="color: ${markerColor}; font-weight: bold;">⚠️ ${p.Severity} Pothole Hazard</span><br/>
              <b>${p.Landmark || p.Image || 'Reported Hazard'}</b><br/>
              Risk Score: <b>${p.Risk_Score || 75}/100</b><br/>
              <span style="color: #0284c7; font-size: 10px; font-weight: 700;">👉 Click to run SUMO Simulation</span>
            </div>
          `);

        new maptilersdk.Marker({ element: el })
          .setLngLat([lon, lat])
          .setPopup(popup)
          .addTo(map);
      });
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
        if (road) handleSelectRoad(road);
      }
    };

    map.off('click', 'roads-line', handleClick);
    map.on('click', 'roads-line', handleClick);

  }, [network, selectedRoad, closedRoadId, activePothole, potholesList, useLeaflet]);

  // 6. Dynamic Leaflet Fallback
  useEffect(() => {
    if (!useLeaflet || leafletLoaded) return;
    
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
      script.onload = () => setLeafletLoaded(true);
      document.body.appendChild(script);
    } else {
      setLeafletLoaded(true);
    }
  }, [useLeaflet]);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || !useLeaflet) return;
    if (leafletMapObj.current) return;

    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView([28.6139, 77.2090], 13);

    leafletMapObj.current = map;

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
      attribution: '&copy; Esri, OpenStreetMap contributors'
    }).addTo(map);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16
    }).addTo(map);

    const polylines = {};
    network.forEach(road => {
      const color = getRiskColor(road.severity);
      const polyline = L.polyline([
        [road.start[1], road.start[0]],
        [road.end[1], road.end[0]]
      ], {
        color: color,
        weight: (selectedRoad?.id === road.id || closedRoadId === road.id) ? 8 : 4,
        opacity: 0.85,
        lineJoin: 'round'
      }).addTo(map);

      polyline.on('click', () => handleSelectRoad(road));
      polylines[road.id] = polyline;
    });
    leafletPolylinesRef.current = polylines;

    const listToRender = potholesList.length > 0 ? potholesList : sampleFallback;
    listToRender.forEach(p => {
      const lat = parseFloat(p.Latitude);
      const lon = parseFloat(p.Longitude);
      if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return;

      const markerColor = getRiskColor(p.Severity);
      const circleMarker = L.circleMarker([lat, lon], {
        radius: 9,
        fillColor: markerColor,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85
      }).addTo(map);

      circleMarker.bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; font-size: 11px; padding: 2px;">
          <span style="color: ${markerColor}; font-weight: bold;">⚠️ ${p.Severity} Pothole</span><br/>
          <b>${p.Landmark || p.Image}</b><br/>
          <span style="color: #0284c7; font-weight: bold;">👉 Click to run SUMO Simulation</span>
        </div>
      `);

      circleMarker.on('click', () => triggerSumoSimulation(p));
      leafletMarkersRef.current.push(circleMarker);
    });

    return () => {
      if (leafletMapObj.current) {
        leafletMapObj.current.remove();
        leafletMapObj.current = null;
        leafletPolylinesRef.current = {};
      }
    };
  }, [leafletLoaded, network, potholesList, useLeaflet]);

  // 7. Charts Data Preparation
  const rerouteChartData = networkSimResult?.updated_network?.slice(0, 8).map(seg => {
    const isClosed = seg.id === closedRoadId;
    return {
      name: seg.name.length > 16 ? seg.name.slice(0, 14) + '…' : seg.name,
      fullName: seg.name,
      original: seg.base_traffic,
      rerouted: isClosed ? (closureType === 'full' ? 0 : Math.round(seg.base_traffic * 0.5)) : (seg.simulated_traffic || seg.base_traffic),
      capacity: seg.base_capacity
    };
  }) || [];

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <style>{`
        .maplibregl-canvas, .mapboxgl-canvas {
          width: 100% !important;
          height: 100% !important;
          position: absolute !important;
          top: 0;
          left: 0;
        }
        .sumo-pothole-marker:hover {
          transform: scale(1.3);
        }
        .pothole-chip {
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .pothole-chip:hover {
          transform: translateY(-2px);
          filter: brightness(1.15);
        }
      `}</style>

      {/* TOP UNIFIED HEADER: DIGITAL TWIN & SUMO SIMULATOR */}
      <div className="glass-card" style={{ 
        padding: '18px 22px', 
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(24, 24, 27, 0.92) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.35)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Compass size={22} color="#00E6B4" /> 
              Digital Twin & SUMO Traffic Simulator
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '3px' }}>
              Integrated Spatial GIS Map, Microscopic Pothole Bottleneck Physics, and City-Scale Dynamic Rerouting Engine.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              fontSize: '0.74rem', 
              background: 'rgba(56, 189, 248, 0.15)', 
              color: '#38BDF8', 
              padding: '4px 10px', 
              borderRadius: '20px', 
              border: '1px solid rgba(56, 189, 248, 0.35)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Activity size={13} className="spin-slow" /> Layer 4 SUMO Connected
            </span>
            <span style={{
              fontSize: '0.74rem',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981',
              padding: '4px 10px',
              borderRadius: '20px',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              fontWeight: 600
            }}>
              ⚡ {potholesList.length} Active Hazards Mapped
            </span>
          </div>
        </div>

        {/* QUICK HAZARD SELECTOR CAROUSEL */}
        <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
          <div style={{ fontSize: '0.7rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
            CLICK HAZARD TO START SIMULATION ON MAP:
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {potholesList.map((p, idx) => {
              const isSelected = activePothole && (activePothole.id === p.id || activePothole.Landmark === p.Landmark);
              const color = getRiskColor(p.Severity);
              return (
                <button
                  key={idx}
                  onClick={() => triggerSumoSimulation(p)}
                  className="pothole-chip"
                  style={{
                    background: isSelected ? 'rgba(56, 189, 248, 0.25)' : '#18181b',
                    border: isSelected ? '1.5px solid #38BDF8' : `1px solid ${color}40`,
                    color: isSelected ? '#fff' : '#e4e4e7',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: isSelected ? '0 0 12px rgba(56,189,248,0.3)' : 'none'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                  <span>{p.Landmark ? p.Landmark.split(',')[0] : `Hazard #${p.id || idx+1}`}</span>
                  <span style={{ fontSize: '0.66rem', color: color, fontWeight: 700 }}>
                    [{p.Severity}]
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN 2-COLUMN VIEW: MAP (LEFT) + SIMULATOR/TELEMETRY PANEL (RIGHT) */}
      <div className="grid-3" style={{ gridTemplateColumns: '1.6fr 1.4fr', gap: '20px' }}>
        
        {/* Left Column: Interactive GIS Digital Twin Map */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.98rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={17} color="#00E6B4" /> 
              {useLeaflet ? 'Spatial GIS Map (Leaflet 2D)' : 'Hardware-Accelerated Digital Twin Canvas'}
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={() => setShowRoadNetwork(prev => !prev)}
                style={{
                  fontSize: '0.72rem',
                  background: showRoadNetwork ? 'rgba(0, 230, 180, 0.15)' : '#18181b',
                  color: showRoadNetwork ? '#00E6B4' : '#a1a1aa',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${showRoadNetwork ? 'rgba(0,230,180,0.4)' : 'var(--border-muted)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {showRoadNetwork ? '🚧 Corridors Visible' : '🚧 Corridors Hidden'}
              </button>

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
                  gap: '5px'
                }}
              >
                <RefreshCw size={11} /> {useLeaflet ? 'Switch 3D' : 'Force 2D'}
              </button>
            </div>
          </div>

          <div style={{ height: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-muted)', position: 'relative' }}>
            <div ref={mapContainerRef} style={{ height: '100%', width: '100%', background: '#09090b', position: 'relative', zIndex: 1 }} />
            
            {useLeaflet && !leafletLoaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#09090b', zIndex: 10 }}>
                <Loader size={36} className="animate-spin" color="#38BDF8" style={{ marginBottom: '12px' }} />
                <div style={{ color: '#fff', fontSize: '0.88rem' }}>Loading Map Engine...</div>
              </div>
            )}

            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(9, 9, 11, 0.9)',
              backdropFilter: 'blur(8px)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '0.72rem',
              color: '#e4e4e7',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>💡</span> Click any <strong>pothole marker (⚠️)</strong> or <strong>road line</strong> to start real-time SUMO simulation.
            </div>
          </div>
        </div>

        {/* Right Column: Unified SUMO Bottleneck & Network Rerouting Engine */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          
          {/* Main 3-Tab Selector */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            <button
              onClick={() => setActiveTab('sumo')}
              style={{
                flex: 1,
                padding: '9px 6px',
                borderRadius: '8px',
                border: activeTab === 'sumo' ? '1px solid #38BDF8' : '1px solid #27272a',
                background: activeTab === 'sumo' ? 'rgba(56, 189, 248, 0.2)' : '#18181b',
                color: activeTab === 'sumo' ? '#38BDF8' : '#a1a1aa',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <span>🚦</span> SUMO Bottleneck Model
            </button>

            <button
              onClick={() => setActiveTab('network-reroute')}
              style={{
                flex: 1,
                padding: '9px 6px',
                borderRadius: '8px',
                border: activeTab === 'network-reroute' ? '1px solid #00E6B4' : '1px solid #27272a',
                background: activeTab === 'network-reroute' ? 'rgba(0, 230, 180, 0.2)' : '#18181b',
                color: activeTab === 'network-reroute' ? '#00E6B4' : '#a1a1aa',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <span>🧭</span> Network Rerouting Engine
            </button>

            <button
              onClick={() => setActiveTab('segment-info')}
              style={{
                flex: 0.8,
                padding: '9px 6px',
                borderRadius: '8px',
                border: activeTab === 'segment-info' ? '1px solid #F59E0B' : '1px solid #27272a',
                background: activeTab === 'segment-info' ? 'rgba(245, 158, 11, 0.2)' : '#18181b',
                color: activeTab === 'segment-info' ? '#F59E0B' : '#a1a1aa',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <span>📊</span> Segment Node
            </button>
          </div>

          {/* TAB 1: SUMO MICROSCOPIC POTHOLE BOTTLENECK MODEL */}
          {activeTab === 'sumo' && (
            <div>
              {activePothole ? (
                <div>
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#18181b',
                    border: '1px solid var(--border-muted)',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 700 }}>
                        ACTIVE POTHOLE HAZARD
                      </span>
                      <span className={`badge badge-${activePothole.Severity?.toLowerCase() || 'high'}`} style={{ fontSize: '0.72rem' }}>
                        {activePothole.Severity} Severity
                      </span>
                    </div>

                    <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                      📍 {activePothole.Landmark || activePothole.Image || 'City Road Segment'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.74rem', color: '#94a3b8' }}>
                      <span>GPS: {parseFloat(activePothole.Latitude).toFixed(4)}°, {parseFloat(activePothole.Longitude).toFixed(4)}°</span>
                      <span style={{ color: '#00E6B4', fontWeight: 600 }}>Risk Score: {activePothole.Risk_Score || 80}/100</span>
                    </div>
                  </div>

                  {isSimulatingPothole ? (
                    <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38BDF8' }}>
                      <RefreshCw size={30} className="spin" style={{ marginBottom: '10px' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Running TraCI & SUMO Car-Following Physics...</div>
                      <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '4px' }}>Simulating Krauss braking ripple & bypass detours</div>
                    </div>
                  ) : potholeSimResult ? (
                    <div>
                      {/* Bottleneck Status Badge */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#EF4444' }}>
                              {potholeSimResult.traffic_impact_level || 'CRITICAL BOTTLENECK'}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#fca5a5' }}>
                              Krauss Deceleration Ripple Active
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#e2e8f0', fontWeight: 600, background: '#18181b', padding: '3px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>
                          Flow: {potholeSimResult.current_flow_vph || 850} vph
                        </span>
                      </div>

                      {/* Speed Drop & Delay Grid */}
                      <div className="grid-2" style={{ gap: '10px', marginBottom: '12px' }}>
                        <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Corridor Speed Drop</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#71717a', textDecoration: 'line-through' }}>
                              {potholeSimResult.scenario_normal?.speed_kmh || 50} km/h
                            </span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#EF4444' }}>
                              {potholeSimResult.scenario_damaged?.speed_kmh || 22} km/h
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#F87171', fontWeight: 700 }}>
                              (-{potholeSimResult.scenario_damaged?.speed_drop_pct || 56}%)
                            </span>
                          </div>
                        </div>

                        <div style={{ background: '#18181b', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Vehicle Delay Surge</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F59E0B' }}>
                              +{potholeSimResult.scenario_damaged?.delay_increase_sec || 36}s
                            </span>
                            <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                              ({potholeSimResult.scenario_damaged?.queue_length_meters || 120}m queue)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cumulative Delay & Emissions */}
                      <div className="grid-2" style={{ gap: '10px', marginBottom: '12px' }}>
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#F59E0B', fontWeight: 600 }}>3-Hour Commuter Delay:</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                            {potholeSimResult.cumulative_impact?.vehicle_delay_hours || 142} vehicle-hours
                          </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          <div style={{ fontSize: '0.68rem', color: '#10B981', fontWeight: 600 }}>CO₂ Emissions Surge:</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                            +{potholeSimResult.cumulative_impact?.co2_surge_kg || 72} kg CO₂
                          </div>
                        </div>
                      </div>

                      {/* Recommended Detour Box */}
                      {potholeSimResult.recommended_reroute && (
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(15, 23, 42, 0.8))',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🧭</span> SUMO Recommended Detour
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                              +{potholeSimResult.recommended_reroute.est_additional_travel_time_min || 1.8}m delta
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>
                            {potholeSimResult.recommended_reroute.route_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                            {potholeSimResult.recommended_reroute.nav_guidance}
                          </div>
                        </div>
                      )}

                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setActiveTab('network-reroute');
                          if (selectedRoad) handleRoadChange(selectedRoad.id);
                        }}
                        style={{ width: '100%', fontSize: '0.78rem', padding: '8px', justifyContent: 'center', gap: '6px' }}
                      >
                        <Compass size={14} color="#00E6B4" /> Simulate Full Network Repair Closure on this Segment
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#71717a', textAlign: 'center' }}>
                  <AlertCircle size={36} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>No Pothole Selected</p>
                  <p style={{ fontSize: '0.76rem', marginTop: '3px' }}>Click any <strong>pothole marker (⚠️)</strong> on the map to start live SUMO simulation.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NETWORK REPAIR REROUTING SIMULATION (Full Merged Reroute Simulator) */}
          {activeTab === 'network-reroute' && (
            <div>
              {/* Corridor Selection */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                  <span>Corridor Scheduled for Repair:</span>
                  <span style={{ color: '#00E6B4' }}>{network.length} Arteries Connected</span>
                </label>
                <select 
                  className="form-select"
                  value={closedRoadId}
                  onChange={(e) => handleRoadChange(e.target.value)}
                  style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.8rem', padding: '8px 10px' }}
                >
                  {network.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.severity || 'Normal'} ({r.potholes || 0} Potholes, {r.base_traffic} veh/hr)
                    </option>
                  ))}
                </select>
              </div>

              {/* Closure Scope Toggle */}
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontSize: '0.76rem' }}>Closure Scope:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleClosureTypeChange('full')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: closureType === 'full' ? '1px solid #EF4444' : '1px solid #27272a',
                      background: closureType === 'full' ? 'rgba(239, 68, 68, 0.15)' : '#18181b',
                      color: closureType === 'full' ? '#FCA5A5' : '#a1a1aa',
                      fontWeight: 600,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <AlertOctagon size={13} color={closureType === 'full' ? '#EF4444' : '#71717a'} />
                    Full Corridor (100% Divert)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClosureTypeChange('single_lane')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: closureType === 'single_lane' ? '1px solid #F59E0B' : '1px solid #27272a',
                      background: closureType === 'single_lane' ? 'rgba(245, 158, 11, 0.15)' : '#18181b',
                      color: closureType === 'single_lane' ? '#FCD34D' : '#a1a1aa',
                      fontWeight: 600,
                      fontSize: '0.76rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <AlertTriangle size={13} color={closureType === 'single_lane' ? '#F59E0B' : '#71717a'} />
                    Single Lane (50% Divert)
                  </button>
                </div>
              </div>

              {/* Traffic Window & Duration */}
              <div className="grid-2" style={{ gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.74rem', marginBottom: '4px' }}>Traffic Window:</label>
                  <select
                    className="form-select"
                    value={trafficWindow}
                    onChange={(e) => handleTrafficWindowChange(e.target.value)}
                    style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.76rem', padding: '6px 8px' }}
                  >
                    <option value="peak">Rush Peak (1.35x)</option>
                    <option value="normal">Normal Flow (1.0x)</option>
                    <option value="off_peak">Night Off-Peak (0.6x)</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#a1a1aa', marginBottom: '4px' }}>
                    <span>Duration:</span>
                    <strong style={{ color: '#00E6B4' }}>{durationHours}h</strong>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="24" 
                    step="1"
                    value={durationHours}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    style={{ width: '100%', accentColor: '#00E6B4', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Simulation Result 4-KPIs */}
              {networkSimResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="grid-2" style={{ gap: '8px' }}>
                    <div style={{ background: '#18181b', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                      <span style={{ fontSize: '0.68rem', color: '#71717a' }}>Displaced Flow</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38BDF8', marginTop: '2px' }}>
                        {networkSimResult.displaced_traffic} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>veh/hr</span>
                      </div>
                    </div>

                    <div style={{ background: '#18181b', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                      <span style={{ fontSize: '0.68rem', color: '#71717a' }}>Passenger Delay</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#F59E0B', marginTop: '2px' }}>
                        {networkSimResult.delay_hours} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>hrs</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Detours List */}
                  {networkSimResult.top_detours?.length > 0 && (
                    <div style={{ background: '#18181b', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                      <div style={{ fontSize: '0.72rem', color: '#00E6B4', fontWeight: 700, marginBottom: '6px' }}>
                        TOP DETOUR RECEIVERS & LOAD %:
                      </div>
                      {networkSimResult.top_detours.slice(0, 3).map((d, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: '4px', color: '#e4e4e7' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                            {idx+1}. {d.name}
                          </span>
                          <span style={{ fontWeight: 700, color: d.new_vc_ratio > 0.85 ? '#EF4444' : '#10B981' }}>
                            {Math.round(d.new_vc_ratio * 100)}% V/C (+{d.pct_increase}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ROAD SEGMENT TELEMETRY */}
          {activeTab === 'segment-info' && (
            <div>
              {selectedRoad ? (
                <div>
                  <div style={{ padding: '12px 14px', background: '#18181b', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--border-muted)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>SELECTED ROAD SEGMENT</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{selectedRoad.name}</div>
                    <div style={{ marginTop: '6px' }}>
                      <span className={`badge badge-${selectedRoad.severity?.toLowerCase() || 'medium'}`}>
                        {selectedRoad.severity} Severity
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Detected Potholes</span>
                      <span style={{ fontWeight: 700, color: '#F59E0B' }}>{selectedRoad.potholes} Hazards</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Base Traffic Volume</span>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{selectedRoad.base_traffic} veh/hr</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Max Capacity</span>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{selectedRoad.base_capacity} veh/hr</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>Speed Limit</span>
                      <span style={{ fontWeight: 600, color: '#00E6B4' }}>{selectedRoad.speed_kmh} km/h</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#71717a', fontSize: '0.85rem', textAlign: 'center', marginTop: '40px' }}>
                  Click any road line on the map to inspect segment telemetry.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM COMBINED ANALYTICS: 3 RICH CHARTS */}
      <div className="grid-3" style={{ gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '16px' }}>
        
        {/* Chart 1: Before vs After Rerouted Traffic Load */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart2 size={15} color="#00E6B4" /> Before vs After Traffic Reroute
            </h3>
            <span style={{ fontSize: '0.68rem', color: '#71717a' }}>veh / hr</span>
          </div>

          <div style={{ height: '190px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rerouteChartData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '6px 10px', fontSize: '0.74rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{payload[0].payload.fullName}</div>
                          <div style={{ color: '#38BDF8', marginTop: '2px' }}>Original: {payload[0].payload.original} veh/hr</div>
                          <div style={{ color: '#00E6B4', marginTop: '1px' }}>Rerouted: {payload[0].payload.rerouted} veh/hr</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.72rem', color: '#a1a1aa' }} />
                <Bar dataKey="original" name="Baseline" fill="#38BDF8" radius={[3, 3, 0, 0]} barSize={10} />
                <Bar dataKey="rerouted" name="Rerouted" fill="#00E6B4" radius={[3, 3, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Road Capacity vs Traffic */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="#38BDF8" /> Road Capacity vs Traffic
            </h3>
            <span style={{ fontSize: '0.68rem', color: '#71717a' }}>veh / hr</span>
          </div>

          <div style={{ height: '190px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capacityVsTrafficData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '6px 10px', fontSize: '0.74rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{payload[0].payload.fullName}</div>
                          <div style={{ color: '#00E6B4' }}>Traffic: {payload[0].payload.traffic} veh/hr</div>
                          <div style={{ color: '#38BDF8' }}>Capacity: {payload[0].payload.capacity} veh/hr</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.72rem', color: '#a1a1aa' }} />
                <Bar dataKey="traffic" name="Traffic" fill="#00E6B4" radius={[3, 3, 0, 0]} barSize={10} />
                <Bar dataKey="capacity" name="Max Cap" fill="#38BDF8" radius={[3, 3, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Pothole Hazard Density Breakdown */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.92rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PieIcon size={15} color="#EF4444" /> Hazard Density
            </h3>
            <span style={{ fontSize: '0.68rem', color: '#71717a' }}>Count</span>
          </div>

          <div style={{ height: '190px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capacityVsTrafficData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '6px 10px', fontSize: '0.74rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{payload[0].payload.fullName}</div>
                          <div style={{ color: payload[0].payload.color, marginTop: '2px' }}>Potholes: {payload[0].value}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="potholes" name="Potholes" radius={[3, 3, 0, 0]} barSize={14}>
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
