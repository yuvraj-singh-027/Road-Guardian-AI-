import React, { useState, useEffect } from 'react';
import { ShieldAlert, Gauge, Sliders, CheckCircle2, Sparkles, BarChart2, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import AuthenticityVerifierView from './AuthenticityVerifierView';

export default function RiskCalculatorView() {
  const [subTab, setSubTab] = useState('risk-calculator');
  const [params, setParams] = useState({
    severity: 'High',
    confidence: 0.88,
    damage_count: 3,
    speed_kmh: 65,
    traffic_density: 'High',
    road_type: 'Arterial Road',
    weather: 'Rainy',
    proximity_school_hospital: true,
  });

  const [riskResult, setRiskResult] = useState(null);

  const calculateRisk = () => {
    fetch('/api/risk/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
      .then((res) => res.json())
      .then((data) => setRiskResult(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    calculateRisk();
  }, [params]);

  // Data for Risk Weight Breakdown Chart
  const breakdownChartData = Object.entries(riskResult?.breakdown || {}).map(([key, val]) => ({
    factor: key.replace(' (35%)', '').replace(' (20%)', '').replace(' (15%)', '').replace(' (10%)', ''),
    points: val,
    color: '#00E6B4'
  }));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: '#18181b', padding: '4px', borderRadius: '12px', border: '1px solid #27272a', width: 'fit-content' }}>
        <button
          onClick={() => setSubTab('risk-calculator')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: subTab === 'risk-calculator' ? 'rgba(0, 230, 180, 0.15)' : 'transparent',
            color: subTab === 'risk-calculator' ? '#00E6B4' : '#a1a1aa',
            fontWeight: subTab === 'risk-calculator' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldAlert size={16} color={subTab === 'risk-calculator' ? '#00E6B4' : '#71717a'} />
          <span>Multi-Factor Risk Score Engine</span>
        </button>

        <button
          onClick={() => setSubTab('authenticity')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: subTab === 'authenticity' ? 'rgba(0, 230, 180, 0.15)' : 'transparent',
            color: subTab === 'authenticity' ? '#00E6B4' : '#a1a1aa',
            fontWeight: subTab === 'authenticity' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ShieldCheck size={16} color={subTab === 'authenticity' ? '#00E6B4' : '#71717a'} />
          <span>Image Authenticity & Forensics</span>
        </button>
      </div>

      {subTab === 'authenticity' ? (
        <AuthenticityVerifierView />
      ) : (
      <div className="grid-2" style={{ gap: '20px' }}>
        {/* Controls Panel */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} color="#00E6B4" /> Multi-Factor Risk Parameters
            </h3>
            <span style={{ fontSize: '0.72rem', background: '#18181b', color: '#00E6B4', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(0,230,180,0.2)' }}>
              Layer 2 Engine
            </span>
          </div>

          <div className="grid-2" style={{ gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Damage Severity Level:</label>
              <select 
                className="form-select" 
                value={params.severity}
                onChange={(e) => setParams({ ...params, severity: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>AI Vision Confidence:</label>
                <span style={{ fontSize: '0.74rem', background: 'rgba(0, 230, 180, 0.15)', color: '#00E6B4', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(0, 230, 180, 0.3)' }}>
                  {Math.round(params.confidence * 100)}%
                </span>
              </div>
              <input 
                type="range" 
                className="form-range"
                min="0.1" 
                max="1.0" 
                step="0.05"
                value={params.confidence}
                onChange={(e) => setParams({ ...params, confidence: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid-2" style={{ gap: '14px' }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Average Vehicle Speed:</label>
                <span style={{ fontSize: '0.74rem', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  {params.speed_kmh} km/h
                </span>
              </div>
              <input 
                type="range" 
                className="form-range"
                min="10" 
                max="120" 
                step="5"
                value={params.speed_kmh}
                onChange={(e) => setParams({ ...params, speed_kmh: parseFloat(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0 }}>Detected Pothole Count:</label>
                <span style={{ fontSize: '0.74rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  {params.damage_count} Unit(s)
                </span>
              </div>
              <input 
                type="number" 
                className="form-input"
                min="1" 
                max="20"
                value={params.damage_count}
                onChange={(e) => setParams({ ...params, damage_count: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
          </div>

          <div className="grid-2" style={{ gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Traffic Density:</label>
              <select 
                className="form-select"
                value={params.traffic_density}
                onChange={(e) => setParams({ ...params, traffic_density: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
                <option value="Congested">Congested</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Weather Condition:</label>
              <select 
                className="form-select"
                value={params.weather}
                onChange={(e) => setParams({ ...params, weather: e.target.value })}
              >
                <option value="Clear">Clear</option>
                <option value="Rainy">Rainy</option>
                <option value="Foggy">Foggy</option>
                <option value="Snowy / Icy">Snowy / Icy</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input 
                type="checkbox"
                checked={params.proximity_school_hospital}
                onChange={(e) => setParams({ ...params, proximity_school_hospital: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#00E6B4' }}
              />
              Near Vulnerable Infrastructure (School / Hospital Zone)
            </label>
          </div>
        </div>

        {/* Output Gauge & Factor Breakdown Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gauge size={18} color="#38BDF8" /> Real-Time Road Risk Index Gauge
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>0-100 Score</span>
          </div>

          {riskResult ? (
            <div>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  border: `3px solid ${riskResult.color_hex}`,
                  boxShadow: `0 0 20px ${riskResult.color_hex}44`,
                  background: '#18181b'
                }}>
                  <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                    {riskResult.score}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: riskResult.color_hex, fontWeight: 700, marginTop: '2px' }}>
                    OUT OF 100
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <span className={`badge badge-${riskResult.css_class.replace('risk-', '')}`} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
                    {riskResult.badge}
                  </span>
                </div>
              </div>

              {/* Multi-Factor Contribution Bar Chart */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart2 size={14} color="#00E6B4" /> Multi-Factor Point Breakdown Graph
                </h4>

                <div style={{ height: '170px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={breakdownChartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" horizontal={false} />
                      <XAxis type="number" stroke="#71717a" fontSize={10} tickLine={false} domain={[0, 35]} />
                      <YAxis type="category" dataKey="factor" stroke="#71717a" fontSize={10} tickLine={false} width={110} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '0.78rem' }}>
                                <div style={{ color: '#fff', fontWeight: 600 }}>{data.factor}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00E6B4' }} />
                                  <span style={{ color: '#a1a1aa' }}>Risk Points:</span>
                                  <span style={{ color: '#00E6B4', fontWeight: 600 }}>+{data.points} pts</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="points" name="Risk Weight (+pts)" fill="#00E6B4" radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#71717a', fontSize: '0.85rem' }}>Calculating risk metrics...</p>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
