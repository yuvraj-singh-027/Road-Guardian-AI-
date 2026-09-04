import React, { useState, useEffect } from 'react';
import { 
  Cpu, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw, BarChart2, 
  TrendingUp, Clock, Wind, Navigation, AlertOctagon, CheckCircle2,
  Sliders, Activity, Zap, Compass, MapPin
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell } from 'recharts';

export default function TrafficRerouteView() {
  const [closedRoadId, setClosedRoadId] = useState('Sec1_Blvd_N1');
  const [closureType, setClosureType] = useState('full'); // 'full' or 'single_lane'
  const [trafficWindow, setTrafficWindow] = useState('peak'); // 'peak', 'normal', 'off_peak'
  const [durationHours, setDurationHours] = useState(4);
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
          runSimulation(initialId, closureType, trafficWindow, durationHours);
        }
      })
      .catch(err => {
        console.error('Failed loading road network for simulator:', err);
        runSimulation('Sec1_Blvd_N1', closureType, trafficWindow, durationHours);
      });
  }, []);

  const runSimulation = (roadId, cType = closureType, tWindow = trafficWindow, dHours = durationHours) => {
    setIsLoading(true);
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
        traffic_window: tWindow,
        duration_hours: Number(dHours),
        center_lat: 28.6139, 
        center_lon: 77.2090 
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setSimulationResult(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Traffic simulation failed:', err);
        setIsLoading(false);
      });
  };

  const handleRoadChange = (newId) => {
    setClosedRoadId(newId);
    runSimulation(newId, closureType, trafficWindow, durationHours);
  };

  const handleClosureTypeChange = (type) => {
    setClosureType(type);
    runSimulation(closedRoadId, type, trafficWindow, durationHours);
  };

  const handleTrafficWindowChange = (win) => {
    setTrafficWindow(win);
    runSimulation(closedRoadId, closureType, win, durationHours);
  };

  const handleDurationChange = (hrs) => {
    setDurationHours(hrs);
    runSimulation(closedRoadId, closureType, trafficWindow, hrs);
  };

  // Data for Before vs After Chart
  const chartData = simulationResult?.updated_network?.slice(0, 8).map(seg => {
    const isClosed = seg.id === closedRoadId;
    return {
      name: seg.name.length > 18 ? seg.name.slice(0, 16) + '…' : seg.name,
      fullName: seg.name,
      original: seg.base_traffic,
      rerouted: isClosed ? (closureType === 'full' ? 0 : Math.round(seg.base_traffic * 0.5)) : (seg.simulated_traffic || seg.base_traffic),
      capacity: seg.base_capacity
    };
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Banner */}
      <div className="glass-card" style={{ 
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.05) 100%)',
        borderColor: 'rgba(0, 230, 180, 0.25)',
        padding: '18px 22px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Compass size={22} color="#00E6B4" /> 
              Dynamic Traffic Simulator & Predictive Rerouting Engine
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#a1a1aa', marginTop: '4px' }}>
              Simulate municipal road repairs, live detour capacity stress, passenger delay hours, and CO₂ impact in real time.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              background: 'rgba(0,230,180,0.12)', 
              color: '#00E6B4', 
              padding: '5px 12px', 
              borderRadius: '20px', 
              border: '1px solid rgba(0,230,180,0.3)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Activity size={13} className="spin-slow" /> Layer 4 Digital Twin Connected
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls + Metrics */}
      <div className="grid-2">
        {/* Simulation Controls Card */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="#00E6B4" /> Scenario Parameters
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Real-time Recomputation</span>
          </div>

          {/* Road Selection */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Corridor Scheduled for Repair:</span>
              <span style={{ color: '#00E6B4', fontSize: '0.75rem' }}>{roadOptions.length} Connected Arteries</span>
            </label>
            <select 
              className="form-select"
              value={closedRoadId}
              onChange={(e) => handleRoadChange(e.target.value)}
              style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
            >
              {roadOptions.length > 0 ? (
                roadOptions.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.severity || 'Normal'} ({r.potholes || 0} Potholes, {r.base_traffic} veh/hr)
                  </option>
                ))
              ) : (
                <option value="Sec1_Blvd_N1">Sector 1 North Boulevard (Loading...)</option>
              )}
            </select>
          </div>

          {/* Closure Type Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Closure Scope:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleClosureTypeChange('full')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: closureType === 'full' ? '1px solid #EF4444' : '1px solid #27272a',
                  background: closureType === 'full' ? 'rgba(239, 68, 68, 0.15)' : '#18181b',
                  color: closureType === 'full' ? '#FCA5A5' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <AlertOctagon size={14} color={closureType === 'full' ? '#EF4444' : '#71717a'} />
                Full Corridor (100% Divert)
              </button>

              <button
                type="button"
                onClick={() => handleClosureTypeChange('single_lane')}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: closureType === 'single_lane' ? '1px solid #F59E0B' : '1px solid #27272a',
                  background: closureType === 'single_lane' ? 'rgba(245, 158, 11, 0.15)' : '#18181b',
                  color: closureType === 'single_lane' ? '#FCD34D' : '#a1a1aa',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <AlertTriangle size={14} color={closureType === 'single_lane' ? '#F59E0B' : '#71717a'} />
                Single Lane (50% Divert)
              </button>
            </div>
          </div>

          {/* Traffic Window Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Traffic Demand Window:</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {[
                { key: 'peak', label: 'Rush Peak', sub: '1.35x Traffic', icon: Zap, color: '#EF4444' },
                { key: 'normal', label: 'Normal Flow', sub: '1.0x Flow', icon: Activity, color: '#38BDF8' },
                { key: 'off_peak', label: 'Night Off-Peak', sub: '0.6x Flow', icon: Clock, color: '#10B981' }
              ].map(item => {
                const Icon = item.icon;
                const active = trafficWindow === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleTrafficWindowChange(item.key)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '8px',
                      border: active ? `1px solid ${item.color}` : '1px solid #27272a',
                      background: active ? `rgba(255, 255, 255, 0.06)` : '#18181b',
                      color: active ? '#fff' : '#71717a',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                      <Icon size={12} color={active ? item.color : '#71717a'} />
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: active ? item.color : '#52525b' }}>{item.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Maintenance Duration Slider */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Repair Work Duration:</label>
              <span style={{ color: '#00E6B4', fontWeight: 700, fontSize: '0.85rem' }}>{durationHours} Hours</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#52525b', marginTop: '4px' }}>
              <span>1 hr (Quick Patch)</span>
              <span>4 hrs (Standard)</span>
              <span>8 hrs (Shift)</span>
              <span>24 hrs (Full Resurface)</span>
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={() => runSimulation(closedRoadId, closureType, trafficWindow, durationHours)}
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
          >
            {isLoading ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
            {isLoading ? 'Recalculating City Network Load...' : 'Re-run Scenario Simulation'}
          </button>
        </div>

        {/* Impact Assessment 4-KPIs Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Active Closure Header Banner */}
          <div className="glass-card" style={{ 
            background: 'rgba(239, 68, 68, 0.07)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            padding: '14px 18px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ACTIVE SIMULATION TARGET
              </div>
              <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                {closureType === 'full' ? 'CORRIDOR CLOSED' : 'LANE RESTRICTED'}
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
              {simulationResult?.closed_road_name || closedRoadId}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '3px' }}>
              Scenario: <strong style={{ color: '#fff' }}>{trafficWindow.toUpperCase()}</strong> Window | Scheduled: <strong style={{ color: '#00E6B4' }}>{durationHours} hrs</strong>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            
            {/* Card 1: Displaced Traffic */}
            <div className="glass-card" style={{ padding: '14px', background: '#121214' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontSize: '0.75rem', fontWeight: 600 }}>
                <TrendingUp size={15} /> Diverted Traffic
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
                {simulationResult?.displaced_traffic ? simulationResult.displaced_traffic.toLocaleString() : '---'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '2px' }}>vehicles / hour shifted</div>
            </div>

            {/* Card 2: Delay Hours */}
            <div className="glass-card" style={{ padding: '14px', background: '#121214' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8', fontSize: '0.75rem', fontWeight: 600 }}>
                <Clock size={15} /> Commuter Delay
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
                {simulationResult?.delay_hours ? `${simulationResult.delay_hours.toLocaleString()} hrs` : '---'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '2px' }}>cumulative delay impact</div>
            </div>

            {/* Card 3: Carbon Footprint */}
            <div className="glass-card" style={{ padding: '14px', background: '#121214' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '0.75rem', fontWeight: 600 }}>
                <Wind size={15} /> Carbon Footprint
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>
                {simulationResult?.co2_surge_kg ? `+${simulationResult.co2_surge_kg.toLocaleString()} kg` : '---'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '2px' }}>estimated CO₂ emissions surge</div>
            </div>

            {/* Card 4: Network Congestion */}
            <div className="glass-card" style={{ padding: '14px', background: '#121214' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#A78BFA', fontSize: '0.75rem', fontWeight: 600 }}>
                <Activity size={15} /> Congestion Index
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: simulationResult?.congestion_index > 80 ? '#EF4444' : '#38BDF8', marginTop: '6px' }}>
                {simulationResult?.congestion_index ? `${simulationResult.congestion_index}%` : '---'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '2px' }}>
                {simulationResult?.overloaded_count || 0} Bottleneck Segment(s)
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Interactive Detour Route Visualizer */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Navigation size={18} color="#00E6B4" /> AI Dynamic Detour & Flow Redistribution Topology
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Real-time Bypass Routing</span>
        </div>

        {/* Graphical Corridor Flow Schematic */}
        <div style={{ 
          background: '#09090b', 
          borderRadius: '12px', 
          border: '1px solid #27272a', 
          padding: '20px', 
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            
            {/* Left Node: Entry Arterial */}
            <div style={{ 
              background: '#18181b', 
              border: '1px solid #3f3f46', 
              borderRadius: '10px', 
              padding: '12px 16px', 
              minWidth: '150px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Inflow Traffic</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>City Arterial Inflow</div>
              <div style={{ fontSize: '0.76rem', color: '#38BDF8', marginTop: '4px' }}>
                ~{(simulationResult?.displaced_traffic ? simulationResult.displaced_traffic + 1200 : 2700).toLocaleString()} veh/hr
              </div>
            </div>

            {/* Center Split: Red Closed corridor vs Green bypass */}
            <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Closed Path */}
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.12)', 
                border: '1px dashed #EF4444', 
                borderRadius: '8px', 
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertOctagon size={16} color="#EF4444" />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FCA5A5' }}>
                      {simulationResult?.closed_road_name || 'Closed Corridor'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#f87171' }}>
                      {closureType === 'full' ? '100% BLOCKED — Under Municipal Repair' : '50% RESTRICTED — Single Lane Working'}
                    </div>
                  </div>
                </div>
                <span className="badge badge-critical" style={{ fontSize: '0.68rem' }}>
                  {closureType === 'full' ? '0 FLOW' : '-50% FLOW'}
                </span>
              </div>

              {/* Dynamic Bypass Paths */}
              {simulationResult?.top_detours?.slice(0, 2).map((detour, idx) => (
                <div key={detour.id || idx} style={{ 
                  background: idx === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.08)', 
                  border: idx === 0 ? '1px solid #10B981' : '1px solid rgba(56, 189, 248, 0.3)', 
                  borderRadius: '8px', 
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color={idx === 0 ? '#10B981' : '#38BDF8'} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                        {detour.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: idx === 0 ? '#6EE7B7' : '#93C5FD' }}>
                        Priority #{detour.rank} Recommended Detour | +{detour.absorb_volume} veh/hr absorbed
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: detour.load_pct > 90 ? '#EF4444' : '#10B981' }}>
                      {detour.load_pct}% Load
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#71717a' }}>+{detour.est_delay_min}m delay</div>
                  </div>
                </div>
              ))}

            </div>

            {/* Right Node: Destination Confluence */}
            <div style={{ 
              background: '#18181b', 
              border: '1px solid #3f3f46', 
              borderRadius: '10px', 
              padding: '12px 16px', 
              minWidth: '150px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Output Confluence</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>City Main Grid</div>
              <div style={{ fontSize: '0.76rem', color: '#10B981', marginTop: '4px' }}>
                Bypass Rerouted OK
              </div>
            </div>

          </div>
        </div>

        {/* Top 3 Detour Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {simulationResult?.top_detours?.map(d => (
            <div key={d.rank} style={{ 
              background: '#121214', 
              border: '1px solid #27272a', 
              borderRadius: '10px', 
              padding: '14px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 700, 
                  background: d.rank === 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)', 
                  color: d.rank === 1 ? '#10B981' : '#38BDF8',
                  padding: '2px 8px',
                  borderRadius: '4px'
                }}>
                  PRIORITY #{d.rank} BYPASS
                </span>
                <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                  {d.is_direct ? 'Direct Adjacent Artery' : 'Macro Ring Connector'}
                </span>
              </div>

              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>{d.name}</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#a1a1aa', marginTop: '4px' }}>
                <span>Absorbed Diverted Volume:</span>
                <strong style={{ color: '#F59E0B' }}>+{d.absorb_volume} veh/hr</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#a1a1aa', marginTop: '4px' }}>
                <span>Simulated Load Factor:</span>
                <strong style={{ color: d.load_pct > 85 ? '#EF4444' : '#10B981' }}>{d.load_pct}% Capacity</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#a1a1aa', marginTop: '4px' }}>
                <span>Est. Extra Transit Time:</span>
                <strong style={{ color: '#38BDF8' }}>+{d.est_delay_min} minutes</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Municipal AI Action Guidance */}
      <div className="glass-card" style={{ 
        background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(39, 39, 42, 0.6) 100%)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#00E6B4" /> Municipal Authority Traffic Advisory & Dispatch Plan
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Automated AI Guidance</span>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#e4e4e7', marginBottom: '12px', lineHeight: 1.5 }}>
          {simulationResult?.prediction_text}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {simulationResult?.mitigation_steps?.map((step, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '10px 14px', 
              background: '#09090b', 
              borderRadius: '8px', 
              border: '1px solid #27272a',
              fontSize: '0.82rem',
              color: '#d4d4d8'
            }}>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rerouting Comparison Chart */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.02rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={16} color="#00E6B4" /> Before vs After Rerouted Traffic Flow Comparison
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>vehicles / hour</span>
        </div>

        <div style={{ height: '250px', width: '100%' }}>
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
              <Bar dataKey="original" name="Original Base Flow" fill="#38BDF8" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="rerouted" name="Simulated Rerouted Flow" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="capacity" name="Maximum Corridor Capacity" fill="#27272a" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed City Segment Traffic Redistribution Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff' }}>City Arterial Segment Load & Redistribution Matrix</h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>{simulationResult?.updated_network?.length || 0} Segments Evaluated</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)', color: '#71717a', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 12px' }}>Corridor Segment</th>
                <th style={{ padding: '10px 12px' }}>Original Flow</th>
                <th style={{ padding: '10px 12px' }}>Simulated Flow</th>
                <th style={{ padding: '10px 12px' }}>Corridor Capacity</th>
                <th style={{ padding: '10px 12px' }}>Load Factor</th>
                <th style={{ padding: '10px 12px' }}>Network Status</th>
              </tr>
            </thead>
            <tbody>
              {simulationResult?.updated_network?.map((seg) => {
                const isClosed = seg.id === closedRoadId;
                const simulatedVol = isClosed ? (closureType === 'full' ? 0 : Math.round(seg.base_traffic * 0.5)) : (seg.simulated_traffic || seg.base_traffic);
                const load = (simulatedVol / seg.base_capacity) * 100;

                return (
                  <tr key={seg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>
                      {seg.name}
                      {seg.potholes > 0 && (
                        <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#F59E0B', background: 'rgba(245,158,11,0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                          {seg.potholes} Potholes
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: '#71717a' }}>{seg.base_traffic} veh/hr</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: isClosed ? '#EF4444' : '#00E6B4' }}>
                      {isClosed ? (closureType === 'full' ? '0 (Full Closed)' : `${simulatedVol} (Restricted)`) : `${simulatedVol} veh/hr`}
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
                        <span className="badge badge-critical">
                          {closureType === 'full' ? 'Closed for Repair' : 'Lane Restricted'}
                        </span>
                      ) : load > 90 ? (
                        <span className="badge badge-critical">Overloaded / Bottleneck</span>
                      ) : load > 75 ? (
                        <span className="badge badge-high">High Traffic Flow</span>
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
