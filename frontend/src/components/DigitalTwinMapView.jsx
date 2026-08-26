import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AlertCircle, Activity, Navigation, Zap } from 'lucide-react';

// Fix leaflet default icon missing issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getRiskColor = (severity) => {
  switch (severity) {
    case 'Critical': return '#FF4757';
    case 'High': return '#FFB703';
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

  const mapCenter = [28.6139, 77.2090]; // New Delhi center default

  return (
    <div>
      <div className="grid-3" style={{ gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Map Container */}
        <div className="glass-card" style={{ padding: '16px', position: 'relative' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={18} color="#00E6B4" /> 3D Spatial Road Network & Risk Telemetry
          </h3>

          <div style={{ height: '480px', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(0,230,180,0.2)' }}>
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              scrollWheelZoom={true} 
              style={{ height: '100%', width: '100%', background: '#090d16' }}
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
                      pathOptions={{ color, weight: selectedRoad?.id === road.id ? 8 : 5, opacity: 0.85 }} 
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
          <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#38BDF8" /> Segment Telemetry
          </h3>

          {selectedRoad ? (
            <div>
              <div style={{ padding: '12px', background: 'rgba(15,23,42,0.8)', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>SELECTED ROAD SEGMENT</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{selectedRoad.name}</div>
                <div style={{ marginTop: '8px' }}>
                  <span className={`badge badge-${selectedRoad.severity.toLowerCase()}`}>
                    {selectedRoad.severity} Severity
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Detected Potholes</span>
                  <span style={{ fontWeight: 700, color: '#FFB703' }}>{selectedRoad.potholes} Hazards</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Base Traffic Volume</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{selectedRoad.base_traffic} veh/hr</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Max Capacity</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>{selectedRoad.base_capacity} veh/hr</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Avg Speed Limit</span>
                  <span style={{ fontWeight: 700, color: '#00E6B4' }}>{selectedRoad.speed_kmh} km/h</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Vulnerable Zone</span>
                  <span style={{ fontWeight: 700, color: selectedRoad.proximity_school_hospital ? '#FF4757' : '#10B981' }}>
                    {selectedRoad.proximity_school_hospital ? 'Yes (School/Hospital)' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>Click any road segment on the map to inspect telemetry.</p>
          )}
        </div>
      </div>
    </div>
  );
}
