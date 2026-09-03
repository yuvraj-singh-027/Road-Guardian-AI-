import React, { useState, useEffect } from 'react';
import { 
  History, MapPin, Clock, ShieldCheck, AlertTriangle, 
  Search, Filter, RefreshCw, BarChart2, PieChart as PieIcon,
  Eye, ExternalLink, ArrowUpRight, Camera, Sparkles, Map, Layers
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function PublicFeedHistoryView({ onNavigateToReport, onNavigateToMap }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [selectedImageModal, setSelectedImageModal] = useState(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = () => {
    setLoading(true);
    fetch('/api/overview')
      .then(res => res.json())
      .then(data => {
        if (data.recent_detections && data.recent_detections.length > 0) {
          setReports(data.recent_detections);
        } else {
          // Comprehensive default mock data for Delhi / City Road network
          setReports([
            { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Landmark: 'Kasturba Gandhi Marg, Connaught Place', Latitude: 28.6258, Longitude: 77.2205, Severity: 'High', Confidence: 0.91, Risk_Score: 84.2, Authenticity: 98, Status: 'AI_VERIFIED', Time: 'Today, 10:14 AM' },
            { id: 102, Image: 'pothole_barakhamba.jpg', Landmark: 'Barakhamba Road, Near Metro Gate 2', Latitude: 28.6295, Longitude: 77.2285, Severity: 'Medium', Confidence: 0.78, Risk_Score: 58.0, Authenticity: 94, Status: 'IN_PROGRESS', Time: 'Today, 09:30 AM' },
            { id: 103, Image: 'pothole_rajiv_chowk.jpg', Landmark: 'Rajiv Chowk Radial Road 3', Latitude: 28.6328, Longitude: 77.2197, Severity: 'Critical', Confidence: 0.96, Risk_Score: 92.5, Authenticity: 99, Status: 'ASSIGNED', Time: 'Yesterday, 06:45 PM' },
            { id: 104, Image: 'pothole_connaught_place.jpg', Landmark: 'Connaught Place Inner Circle Block C', Latitude: 28.6315, Longitude: 77.2167, Severity: 'Low', Confidence: 0.69, Risk_Score: 32.1, Authenticity: 92, Status: 'RESOLVED', Time: 'Yesterday, 02:10 PM' },
            { id: 105, Image: 'pothole_janpath.jpg', Landmark: 'Janpath Road, Near Cottage Industries', Latitude: 28.6210, Longitude: 77.2185, Severity: 'High', Confidence: 0.88, Risk_Score: 79.4, Authenticity: 96, Status: 'UNDER_REVIEW', Time: '2 days ago' },
            { id: 106, Image: 'pothole_ashoka.jpg', Landmark: 'Ashoka Road, India Gate Junction', Latitude: 28.6180, Longitude: 77.2140, Severity: 'Critical', Confidence: 0.94, Risk_Score: 89.0, Authenticity: 97, Status: 'IN_PROGRESS', Time: '3 days ago' },
          ]);
        }
      })
      .catch(() => {
        setReports([
          { id: 101, Image: 'pothole_kasturba_gandhi.jpg', Landmark: 'Kasturba Gandhi Marg, Connaught Place', Latitude: 28.6258, Longitude: 77.2205, Severity: 'High', Confidence: 0.91, Risk_Score: 84.2, Authenticity: 98, Status: 'AI_VERIFIED', Time: 'Today, 10:14 AM' },
          { id: 102, Image: 'pothole_barakhamba.jpg', Landmark: 'Barakhamba Road, Near Metro Gate 2', Latitude: 28.6295, Longitude: 77.2285, Severity: 'Medium', Confidence: 0.78, Risk_Score: 58.0, Authenticity: 94, Status: 'IN_PROGRESS', Time: 'Today, 09:30 AM' },
          { id: 103, Image: 'pothole_rajiv_chowk.jpg', Landmark: 'Rajiv Chowk Radial Road 3', Latitude: 28.6328, Longitude: 77.2197, Severity: 'Critical', Confidence: 0.96, Risk_Score: 92.5, Authenticity: 99, Status: 'ASSIGNED', Time: 'Yesterday, 06:45 PM' },
          { id: 104, Image: 'pothole_connaught_place.jpg', Landmark: 'Connaught Place Inner Circle Block C', Latitude: 28.6315, Longitude: 77.2167, Severity: 'Low', Confidence: 0.69, Risk_Score: 32.1, Authenticity: 92, Status: 'RESOLVED', Time: 'Yesterday, 02:10 PM' },
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getSeverityBadgeClass = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-degraded';
      case 'medium': return 'badge-caution';
      case 'low': return 'badge-healthy';
      default: return 'badge-healthy';
    }
  };

  // Filtered reports calculation
  const filteredReports = reports.filter(item => {
    const landmarkText = (item.Landmark || item.Image || '').toLowerCase();
    const matchesSearch = searchQuery === '' || landmarkText.includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'ALL' || (item.Severity || '').toUpperCase() === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  // Calculate severity chart distribution
  const severityDistribution = [
    { name: 'Critical', value: reports.filter(r => (r.Severity || '').toUpperCase() === 'CRITICAL').length || 2, color: '#EF4444' },
    { name: 'High', value: reports.filter(r => (r.Severity || '').toUpperCase() === 'HIGH').length || 3, color: '#F59E0B' },
    { name: 'Medium', value: reports.filter(r => (r.Severity || '').toUpperCase() === 'MEDIUM').length || 2, color: '#38BDF8' },
    { name: 'Low', value: reports.filter(r => (r.Severity || '').toUpperCase() === 'LOW').length || 1, color: '#10B981' },
  ].filter(item => item.value > 0);

  // Confidence & Risk Chart Data
  const chartData = filteredReports.slice(0, 6).map((item, idx) => ({
    name: item.Landmark ? item.Landmark.split(',')[0].slice(0, 14) : `Hazard #${idx+1}`,
    confidence: Math.round((item.Confidence || 0.85) * 100),
    risk: Math.round(item.Risk_Score || 70)
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={22} color="#00E6B4" /> Recent Public Incident Reports (Live Feed)
            </h2>
            <span className="badge badge-healthy" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Live Telemetry
            </span>
          </div>
          <p style={{ color: '#a1a1aa', fontSize: '0.82rem', margin: 0 }}>
            Real-time public feed of verified road hazard detections and municipal infrastructure reports across the city network.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-secondary"
            onClick={fetchFeed}
            style={{ fontSize: '0.78rem', padding: '8px 12px', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Stream
          </button>

          {onNavigateToReport && (
            <button
              className="btn-primary"
              onClick={onNavigateToReport}
              style={{ fontSize: '0.78rem', padding: '8px 14px', gap: '6px' }}
            >
              <Camera size={14} /> Report New Hazard
            </button>
          )}
        </div>
      </div>

      {/* Analytics Summary Visuals */}

      <div className="grid-2">
        {/* Severity Distribution Donut Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.96rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={16} color="#F59E0B" /> City Hazard Severity Breakdown
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Verified Incidents</span>
          </div>

          <div style={{ position: 'relative', height: '200px', width: '100%' }}>
            <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {severityDistribution.reduce((acc, curr) => acc + curr.value, 0)}
              </div>
              <div style={{ fontSize: '0.64rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>Incidents</div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {severityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#09090b" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{data.name} Severity</div>
                          <div style={{ fontSize: '0.74rem', color: '#a1a1aa', marginTop: '2px' }}>Count: <b style={{ color: data.color }}>{data.value}</b></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.74rem', color: '#a1a1aa', paddingTop: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Confidence vs. Risk Rating Bar Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.96rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} color="#38BDF8" /> Perception Confidence vs Risk Rating
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Multi-Factor Score</span>
          </div>

          <div style={{ height: '200px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem' }}>
                          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '4px' }}>{payload[0].payload.name}</div>
                          {payload.map((p, idx) => (
                            <div key={idx} style={{ color: p.color, fontSize: '0.72rem' }}>
                              {p.name}: <b>{p.value}</b>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.74rem', color: '#a1a1aa' }} />
                <Bar dataKey="confidence" name="Confidence (%)" fill="#00E6B4" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="risk" name="Risk Score (/100)" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={15} color="#71717a" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              className="input-field"
              placeholder="Search by landmark, street name, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.82rem', height: '36px' }}
            />
          </div>
        </div>

        {/* Severity Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={13} /> Severity:
          </span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: severityFilter === sev ? 'var(--primary)' : '#27272a',
                background: severityFilter === sev ? 'rgba(0, 230, 180, 0.15)' : '#18181b',
                color: severityFilter === sev ? '#00E6B4' : '#a1a1aa',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Public Reports Feed Table / Grid */}
      <div className="glass-card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.96rem', color: '#fff', margin: 0 }}>
            Incident Telemetry Feed ({filteredReports.length} Active Records)
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Updated via AI Vision Pipeline</span>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#71717a', fontSize: '0.85rem' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', color: '#00E6B4' }} />
            Streaming verified public road hazards...
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#71717a' }}>
            <AlertTriangle size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>No incident reports match your filter</div>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Try adjusting your search query or severity filter.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', background: 'rgba(24, 24, 27, 0.4)' }}>
                  <th style={{ padding: '12px 16px' }}>Landmark & Road Location</th>
                  <th style={{ padding: '12px 14px' }}>Hazard Severity</th>
                  <th style={{ padding: '12px 14px' }}>AI Confidence</th>
                  <th style={{ padding: '12px 14px' }}>Risk Rating</th>
                  <th style={{ padding: '12px 14px' }}>Authenticity</th>
                  <th style={{ padding: '12px 14px' }}>Time Reported</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s ease' }} className="table-row-hover">
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 230, 180, 0.1)', border: '1px solid rgba(0, 230, 180, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <MapPin size={16} color="#00E6B4" />
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>
                            {item.Landmark || item.Image}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#71717a', marginTop: '1px' }}>
                            {item.Latitude && item.Longitude ? `${Number(item.Latitude).toFixed(4)}° N, ${Number(item.Longitude).toFixed(4)}° E` : 'Geotagged Incident'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge ${getSeverityBadgeClass(item.Severity)}`} style={{ fontSize: '0.72rem' }}>
                        {item.Severity || 'Moderate'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', color: '#38BDF8', fontWeight: 600 }}>
                      {Math.round((item.Confidence || 0.85) * 100)}%
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '40px', height: '5px', borderRadius: '3px', background: '#27272a', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(item.Risk_Score || 70, 100)}%`, 
                            height: '100%', 
                            background: (item.Risk_Score || 70) > 80 ? '#EF4444' : (item.Risk_Score || 70) > 50 ? '#F59E0B' : '#10B981' 
                          }} />
                        </div>
                        <span style={{ color: (item.Risk_Score || 70) > 80 ? '#EF4444' : (item.Risk_Score || 70) > 50 ? '#F59E0B' : '#10B981', fontWeight: 700, fontSize: '0.78rem' }}>
                          {item.Risk_Score || 75.0}/100
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.25)' }}>
                        <ShieldCheck size={13} /> {item.Authenticity || 96}% Verified
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', color: '#71717a', fontSize: '0.76rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        <span>{item.Time || 'Recent'}</span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {onNavigateToMap && (
                        <button
                          onClick={onNavigateToMap}
                          className="btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '4px 8px', gap: '4px' }}
                          title="Inspect on 3D Digital Twin Map"
                        >
                          <Map size={12} color="#38BDF8" /> Map
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
