import React, { useState, useEffect } from 'react';
import { ShieldAlert, Gauge, Sliders, CheckCircle2 } from 'lucide-react';

export default function RiskCalculatorView() {
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

  return (
    <div>
      <div className="grid-2">
        {/* Controls Panel */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="#00E6B4" /> Multi-Factor Parameter Controls
          </h3>

          <div className="grid-2" style={{ gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Damage Severity:</label>
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
              <label className="form-label">YOLO Confidence ({Math.round(params.confidence * 100)}%):</label>
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

          <div className="grid-2" style={{ gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Vehicle Speed ({params.speed_kmh} km/h):</label>
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
              <label className="form-label">Damage / Pothole Count:</label>
              <input 
                type="number" 
                className="form-input"
                min="1" 
                max="10"
                value={params.damage_count}
                onChange={(e) => setParams({ ...params, damage_count: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          <div className="grid-2" style={{ gap: '16px' }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input 
                type="checkbox"
                checked={params.proximity_school_hospital}
                onChange={(e) => setParams({ ...params, proximity_school_hospital: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#00E6B4' }}
              />
              Near Vulnerable Infrastructure (School / Hospital Zone)
            </label>
          </div>
        </div>

        {/* Output Gauge & Factor Breakdown */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gauge size={20} color="#38BDF8" /> Real-Time Road Risk Index
          </h3>

          {riskResult ? (
            <div>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '150px',
                  height: '150px',
                  borderRadius: '50%',
                  border: `4px solid ${riskResult.color_hex}`,
                  boxShadow: `0 0 25px ${riskResult.color_hex}66`,
                  background: 'rgba(15,23,42,0.9)'
                }}>
                  <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {riskResult.score}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: riskResult.color_hex, fontWeight: 700, marginTop: '4px' }}>
                    OUT OF 100
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <span className={`badge badge-${riskResult.css_class.replace('risk-', '')}`} style={{ fontSize: '1rem', padding: '8px 20px' }}>
                    {riskResult.badge}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Multi-Factor Weight Breakdown:
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(riskResult.breakdown || {}).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '4px' }}>
                        <span>{key}</span>
                        <span style={{ fontWeight: 700, color: '#00E6B4' }}>+{val} pts</span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${(val / 35) * 100}%`, height: '100%', background: '#00E6B4' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>Calculating risk metrics...</p>
          )}
        </div>
      </div>
    </div>
  );
}
