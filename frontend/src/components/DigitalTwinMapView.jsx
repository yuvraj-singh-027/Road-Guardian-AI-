import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AlertCircle, Activity, Navigation, Zap, Layers, MapPin, BarChart2, PieChart as PieIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getRiskColor = (severity) => {
  switch (severity) {
    case 'Critical': return '#EF4444';
    case 'High': return '#F59E0B';
    case 'Medium': return '#38BDF8';
    default: return '#10B981';
  }
};

export default function DigitalTwinMapView() {
  const [network, setNetwork] = useState([]);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const mapCenter = [28.6139, 77.2090]; // New Delhi center

  // Data for Charts
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
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Map Container */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="#00E6B4" /> 3D Spatial Road Network & GIS Telemetry Map
            </h3>
            <span style={{ fontSize: '0.72rem', background: '#18181b', color: '#00E6B4', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0,230,180,0.2)' }}>
              Live GIS Vector Layers
            </span>
          </div>

          <div style={{ height: '440px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-muted)' }}>
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              scrollWheelZoom={true} 
              style={{ height: '100%', width: '100%', background: '#09090b' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a> Dark Matter'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />

              {network.map((road) => {
                const positions = [
                  [road.start[1], road.start[0]],
                  [road.end[1], road.end[0]]
                ];
                const color = getRiskColor(road.severity);

                return (
                  <React.Fragment key={road.id}>
                    <Polyline 
                      positions={positions} 
                      pathOptions={{ color, weight: selectedRoad?.id === road.id ? 8 : 5, opacity: 0.88 }} 
                      eventHandlers={{
                        click: () => setSelectedRoad(road)
                      }}
                    />

                    <Marker 
                      position={positions[0]} 
                      eventHandlers={{ click: () => setSelectedRoad(road) }}
                    >
                      <Popup>
                        <strong style={{ color: '#00E6B4' }}>{road.name}</strong><br />
                        Potholes: {road.potholes} | Risk: {road.severity}
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}
            </MapContainer>
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

      {/* Visual Analytics Charts Grid for Digital Twin */}
      <div className="grid-2">
        {/* Base Traffic vs Max Capacity Bar Chart */}
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
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#a1a1aa' }} />
                <Bar dataKey="traffic" name="Base Traffic" fill="#00E6B4" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="capacity" name="Max Capacity" fill="#38BDF8" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hazard Density per Road Segment Bar Chart */}
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
                  contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}
                />
                <Bar dataKey="potholes" name="Detected Potholes" radius={[4, 4, 0, 0]} barSize={24}>
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
