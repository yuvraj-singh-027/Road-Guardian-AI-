import React, { useState, useEffect } from 'react';
import { Cpu, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw, BarChart2, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

export default function TrafficRerouteView() {
  const [closedRoadId, setClosedRoadId] = useState('Sec1_Blvd_N1');
  const [roadOptions, setRoadOptions] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch available road segments on mount
  useEffect(() => {
    fetch('/api/traffic/network')
      .then(res => res.json())
      .then(data => {
        const segs = data.segments || [];
        if (segs.length > 0) {
          setRoadOptions(segs);
          const initialId = segs[0].id;
          setClosedRoadId(initialId);
          runSimulation(initialId);
        }
      })
      .catch(err => {
        console.error('Failed loading road network for simulator:', err);
        runSimulation('Sec1_Blvd_N1');
      });
  }, []);

  const runSimulation = (roadId) => {
    setIsLoading(true);
    const token = localStorage.getItem('road_guardian_token');
    fetch('/api/traffic/reroute', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
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

  // Data for Before vs After Chart
  const chartData = simulationResult?.updated_network?.slice(0, 8).map(seg => {
    const isClosed = seg.id === closedRoadId;
    return {
      name: seg.name.length > 18 ? seg.name.slice(0, 16) + '…' : seg.name,
      fullName: seg.name,
      original: seg.base_traffic,
      rerouted: isClosed ? 0 : (seg.simulated_traffic || seg.base_traffic),
      capacity: seg.base_capacity
    };
  }) || [];

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: '20px' }}>
        {/* Simulation Controls */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} color="#00E6B4" /> Maintenance Closure Simulator
            </h3>
            <span style={{ fontSize: '0.72rem', background: '#18181b', color: '#00E6B4', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0,230,180,0.2)' }}>
              Layer 4 Dynamic Engine
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#a1a1aa', marginBottom: '16px', lineHeight: 1.45 }}>
            Select any municipal arterial corridor to simulate physical maintenance closure and compute real-time dynamic traffic redistribution.
          </p>

          <div className="form-group">
            <label className="form-label">Select Road Segment to Close:</label>
            <select 
              className="form-select"
              value={closedRoadId}
              onChange={(e) => {
                setClosedRoadId(e.target.value);
                runSimulation(e.target.value);
              }}
            >
              {roadOptions.length > 0 ? (
                roadOptions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.severity || 'Normal'} ({r.potholes || 0} Potholes, {r.base_traffic} veh/hr)
                  </option>
                ))
              ) : (
                <>
                  <option value="Sec1_Blvd_N1">Sector 1 North Boulevard — Critical (4 Potholes)</option>
                  <option value="School_Zone_Ave1">School Zone Avenue 1 — High (2 Potholes)</option>
                  <option value="Central_Cross_1">Central Cross Arterial — Medium (2 Potholes)</option>
                  <option value="South_Expressway_1">South Expressway Connector — High (3 Potholes)</option>
                </>
              )}
            </select>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button 
              className="btn-primary" 
              onClick={() => runSimulation(closedRoadId)}
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isLoading ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
              {isLoading ? 'Recalculating City Flow...' : 'Recalculate Traffic Redistribution'}
            </button>
          </div>
        </div>

        {/* Simulation Executive Summary */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#F59E0B" /> Network Impact Assessment
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>City Simulation</span>
          </div>

          {simulationResult ? (
            <div>
              <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 600, textTransform: 'uppercase' }}>CLOSED ROAD SEGMENT</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{simulationResult.closed_road_name || closedRoadId}</div>
                <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginTop: '4px' }}>
                  Displaced Traffic Volume: <strong style={{ color: '#F59E0B' }}>{simulationResult.displaced_traffic || 1750} veh/hr</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Capacity Overloaded Segments:</span>
                  <span style={{ fontWeight: 700, color: simulationResult.overloaded_count > 0 ? '#EF4444' : '#10B981' }}>
                    {simulationResult.overloaded_count || 0} Segment(s)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#18181b', borderRadius: '8px', border: '1px solid var(--border-muted)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>Network Congestion Index:</span>
                  <span style={{ fontWeight: 700, color: '#38BDF8' }}>
                    {simulationResult.congestion_index ? `${simulationResult.congestion_index.toFixed(1)}%` : '74.2%'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#71717a', fontSize: '0.85rem' }}>Loading simulation data...</p>
          )}
        </div>
      </div>

      {/* Rerouting Comparison Chart */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} color="#00E6B4" /> Before vs After Rerouted Traffic Flow Comparison
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>veh / hr</span>
        </div>

        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '0.78rem' }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: '6px' }}>{payload[0].payload.fullName || payload[0].payload.name}</div>
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
              <Bar dataKey="original" name="Original Volume" fill="#38BDF8" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="rerouted" name="Simulated Rerouted" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="capacity" name="Max Capacity" fill="#27272a" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rerouting Flow Details Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff' }}>Updated City Segment Traffic Redistribution Table</h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Capacity Simulation</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)', color: '#71717a', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Segment Name</th>
                <th style={{ padding: '10px 12px' }}>Original Traffic</th>
                <th style={{ padding: '10px 12px' }}>Rerouted Traffic</th>
                <th style={{ padding: '10px 12px' }}>Capacity Limit</th>
                <th style={{ padding: '10px 12px' }}>Load Factor</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {simulationResult?.updated_network?.map((seg) => {
                const load = seg.simulated_traffic ? (seg.simulated_traffic / seg.base_capacity) * 100 : 70;
                const isClosed = seg.id === closedRoadId;

                return (
                  <tr key={seg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>{seg.name}</td>
                    <td style={{ padding: '12px', color: '#71717a' }}>{seg.base_traffic} veh/hr</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: isClosed ? '#EF4444' : '#00E6B4' }}>
                      {isClosed ? '0 (Closed)' : `${seg.simulated_traffic || seg.base_traffic} veh/hr`}
                    </td>
                    <td style={{ padding: '12px', color: '#71717a' }}>{seg.base_capacity} veh/hr</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#27272a', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, load)}%`, height: '100%', background: load > 90 ? '#EF4444' : load > 75 ? '#F59E0B' : '#00E6B4' }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{load.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
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
