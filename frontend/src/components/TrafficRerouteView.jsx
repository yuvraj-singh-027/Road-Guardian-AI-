import React, { useState, useEffect } from 'react';
import { Cpu, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

export default function TrafficRerouteView() {
  const [closedRoadId, setClosedRoadId] = useState('Road_A');
  const [simulationResult, setSimulationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const runSimulation = (roadId) => {
    setIsLoading(true);
    fetch('/api/traffic/reroute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed_road_id: roadId, center_lat: 28.6139, center_lon: 77.2090 })
    })
      .then((res) => res.json())
      .then((data) => {
        setSimulationResult(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    runSimulation('Road_A');
  }, []);

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* Simulation Controls */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="#00E6B4" /> Maintenance Closure Simulator
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '20px' }}>
            Select a critical road segment to simulate municipal repair closure and predict citywide traffic redistribution.
          </p>

          <div className="form-group">
            <label className="form-label">Road Segment to Close:</label>
            <select 
              className="form-select"
              value={closedRoadId}
              onChange={(e) => {
                setClosedRoadId(e.target.value);
                runSimulation(e.target.value);
              }}
            >
              <option value="Road_A">Road A (Northern Arterial) — Critical (8 Potholes)</option>
              <option value="Road_B">Road B (Central Bypass) — Medium (3 Potholes)</option>
              <option value="Road_C">Road C (Cross Connector) — High (5 Potholes)</option>
              <option value="Road_D">Road D (Southern Expressway) — Low (1 Pothole)</option>
            </select>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button 
              className="btn-primary" 
              onClick={() => runSimulation(closedRoadId)}
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isLoading ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
              {isLoading ? 'Recalculating City Flow...' : 'Recalculate Traffic Redistribution'}
            </button>
          </div>
        </div>

        {/* Simulation Executive Summary */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} color="#FFB703" /> Network Impact Assessment
          </h3>

          {simulationResult ? (
            <div>
              <div style={{ padding: '16px', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.3)', borderRadius: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: '#FF4757', fontWeight: 700, textTransform: 'uppercase' }}>CLOSED ROAD</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>{simulationResult.closed_road_name || closedRoadId}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Displaced Traffic Volume: <strong style={{ color: '#FFB703' }}>{simulationResult.displaced_traffic || 1750} veh/hr</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15,23,42,0.8)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Capacity Overloaded Segments:</span>
                  <span style={{ fontWeight: 800, color: simulationResult.overloaded_count > 0 ? '#FF4757' : '#10B981' }}>
                    {simulationResult.overloaded_count || 0} Segment(s)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15,23,42,0.8)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>Network Congestion Index:</span>
                  <span style={{ fontWeight: 800, color: '#38BDF8' }}>
                    {simulationResult.congestion_index ? `${simulationResult.congestion_index.toFixed(1)}%` : '74.2%'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>Loading simulation data...</p>
          )}
        </div>
      </div>

      {/* Rerouting Flow Details */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px' }}>Updated City Segment Traffic Redistribution</h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px' }}>Segment Name</th>
                <th style={{ padding: '12px' }}>Original Traffic</th>
                <th style={{ padding: '12px' }}>Rerouted Traffic</th>
                <th style={{ padding: '12px' }}>Capacity Limit</th>
                <th style={{ padding: '12px' }}>Load Factor</th>
                <th style={{ padding: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {simulationResult?.updated_network?.map((seg) => {
                const load = seg.simulated_traffic ? (seg.simulated_traffic / seg.base_capacity) * 100 : 70;
                const isClosed = seg.id === closedRoadId;

                return (
                  <tr key={seg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '14px 12px', fontWeight: 600, color: '#fff' }}>{seg.name}</td>
                    <td style={{ padding: '14px 12px', color: '#94a3b8' }}>{seg.base_traffic} veh/hr</td>
                    <td style={{ padding: '14px 12px', fontWeight: 700, color: isClosed ? '#FF4757' : '#00E6B4' }}>
                      {isClosed ? '0 (Closed)' : `${seg.simulated_traffic || seg.base_traffic} veh/hr`}
                    </td>
                    <td style={{ padding: '14px 12px', color: '#94a3b8' }}>{seg.base_capacity} veh/hr</td>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, load)}%`, height: '100%', background: load > 90 ? '#FF4757' : load > 75 ? '#FFB703' : '#00E6B4' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{load.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      {isClosed ? (
                        <span className="badge badge-critical">Maintenance Closed</span>
                      ) : load > 90 ? (
                        <span className="badge badge-high">Overloaded</span>
                      ) : (
                        <span className="badge badge-healthy">Optimal Flow</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
