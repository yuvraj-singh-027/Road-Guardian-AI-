import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Clock, CheckCircle2, AlertTriangle, ShieldCheck, 
  MapPin, Eye, Search, Filter, RefreshCw, ChevronRight, X, ArrowRight,
  User, Check, AlertCircle, Wrench, ShieldAlert, Cpu, Sparkles, Send,
  PieChart as PieIcon, BarChart2, History, FileText, Zap
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis } from 'recharts';
import PublicFeedHistoryView from './PublicFeedHistoryView';
import ReportGeneratorView from './ReportGeneratorView';
import AuthenticityVerifierView from './AuthenticityVerifierView';

export default function MyReportsView({ userRole, onNavigateToDetection, initialSubTab = 'my-reports' }) {
  const [subTab, setSubTab] = useState(initialSubTab);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [selectedNextStatus, setSelectedNextStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(null);

  // Standard 8 Lifecycle Stages Definition
  const LIFECYCLE_STAGES = [
    { key: 'SUBMITTED', label: 'Report Submitted', desc: 'Citizen photographic upload & geotag' },
    { key: 'AI_VERIFIED', label: 'AI Verification', desc: 'AI hazard & Authenticity check passed' },
    { key: 'UNDER_REVIEW', label: 'Under Review', desc: 'Municipal authority triage & assessment' },
    { key: 'ASSIGNED', label: 'Assigned for Repair', desc: 'Dispatched to PWD / Road maintenance unit' },
    { key: 'IN_PROGRESS', label: 'Repair In Progress', desc: 'On-site asphalt patching & crew active' },
    { key: 'REPAIR_COMPLETED', label: 'Repair Completed', desc: 'Physical road resurfacing finished' },
    { key: 'AI_REVERIFICATION', label: 'AI Reverification', desc: 'Post-repair computer vision audit' },
    { key: 'RESOLVED', label: 'Resolved', desc: 'Municipal complaint ticket closed' },
  ];

  const fetchReports = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/reports/my-reports');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed loading reports');
      }
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Could not fetch your reports. Please ensure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const openReportTracking = async (reportId) => {
    setLoadingDetail(true);
    setStatusUpdateSuccess(null);
    setStatusUpdateNote('');
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to retrieve report lifecycle details');
      }
      const data = await res.json();
      setSelectedReport(data.report);
      setSelectedNextStatus(data.report.status || 'UNDER_REVIEW');
    } catch (err) {
      alert(err.message || 'Access denied or report not found');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedReport) return;
    setIsUpdatingStatus(true);
    setStatusUpdateSuccess(null);
    try {
      const res = await fetch(`/api/reports/${selectedReport.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedNextStatus,
          message: statusUpdateNote || `Status updated to ${selectedNextStatus.replace('_', ' ')}.`
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Status update failed');
      }

      const data = await res.json();
      setSelectedReport(data.report);
      setStatusUpdateSuccess('Report lifecycle stage updated successfully!');
      fetchReports(); // refresh main list
    } catch (err) {
      alert(err.message || 'Failed updating status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'RESOLVED':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', color: '#10B981', label: '🟢 RESOLVED' };
      case 'REPAIR_COMPLETED':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10B981', color: '#10B981', label: '🟢 REPAIR COMPLETED' };
      case 'IN_PROGRESS':
        return { bg: 'rgba(249, 115, 22, 0.15)', border: '#F97316', color: '#F97316', label: '🟠 IN PROGRESS' };
      case 'ASSIGNED':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B', color: '#F59E0B', label: '🟡 ASSIGNED' };
      case 'UNDER_REVIEW':
        return { bg: 'rgba(56, 189, 248, 0.15)', border: '#38BDF8', color: '#38BDF8', label: '🔵 UNDER REVIEW' };
      case 'AI_VERIFIED':
        return { bg: 'rgba(0, 230, 180, 0.15)', border: '#00E6B4', color: '#00E6B4', label: '✅ AI VERIFIED' };
      case 'REJECTED':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444', color: '#EF4444', label: '❌ REJECTED' };
      case 'SUBMITTED':
      default:
        return { bg: 'rgba(161, 161, 170, 0.15)', border: '#a1a1aa', color: '#d4d4d8', label: '📋 SUBMITTED' };
    }
  };

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'critical': return '#EF4444';
      case 'high': return '#F97316';
      case 'medium': return '#F59E0B';
      default: return '#10B981';
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch = 
      (r.report_id && r.report_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.landmark_name && r.landmark_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.severity && r.severity.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.damage_type && r.damage_type.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return !['RESOLVED', 'REJECTED'].includes(r.status);
    if (statusFilter === 'RESOLVED') return r.status === 'RESOLVED' || r.status === 'REPAIR_COMPLETED';
    return r.status === statusFilter;
  });

  const getStageIndex = (stageKey) => {
    return LIFECYCLE_STAGES.findIndex(s => s.key === stageKey);
  };

  // Derive severity distribution from reports list
  const severityDistribution = [
    { name: 'Critical', value: reports.filter(r => r.severity?.toLowerCase() === 'critical').length || (reports.length ? 0 : 2), color: '#EF4444' },
    { name: 'High', value: reports.filter(r => r.severity?.toLowerCase() === 'high').length || (reports.length ? 0 : 3), color: '#F97316' },
    { name: 'Medium', value: reports.filter(r => r.severity?.toLowerCase() === 'medium').length || (reports.length ? 0 : 4), color: '#F59E0B' },
    { name: 'Low', value: reports.filter(r => r.severity?.toLowerCase() === 'low').length || (reports.length ? 0 : 3), color: '#10B981' }
  ];

  // Derive Confidence vs Risk Rating data from reports list
  const chartData = (reports.length > 0 ? reports.slice(0, 5) : [
    { name: 'Sector 4', confidence: 94, risk: 78 },
    { name: 'Main Blvd', confidence: 88, risk: 62 },
    { name: 'Ring Road', confidence: 91, risk: 85 },
    { name: 'Expressway', confidence: 85, risk: 45 },
    { name: 'North Ave', confidence: 96, risk: 32 }
  ]).map((r, i) => ({
    name: r.landmark_name || r.report_id || `Incident #${i+1}`,
    confidence: Math.round((r.confidence || 0.88) * (r.confidence <= 1 ? 100 : 1)),
    risk: Math.round(r.risk_score || r.riskScore || 65)
  }));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Merged View Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: '#18181b', padding: '4px', borderRadius: '12px', border: '1px solid #27272a', width: 'fit-content', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSubTab('my-reports')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: subTab === 'my-reports' ? 'rgba(0, 230, 180, 0.15)' : 'transparent',
            color: subTab === 'my-reports' ? '#00E6B4' : '#a1a1aa',
            fontWeight: subTab === 'my-reports' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ClipboardList size={16} color={subTab === 'my-reports' ? '#00E6B4' : '#71717a'} />
          <span>{userRole === 'admin' ? 'Citizen Complaint Registry' : 'My Reports & Tracking'}</span>
        </button>

        {userRole === 'admin' && (
          <>
            <button
              onClick={() => setSubTab('municipal-report')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: subTab === 'municipal-report' ? 'rgba(0, 230, 180, 0.15)' : 'transparent',
                color: subTab === 'municipal-report' ? '#00E6B4' : '#a1a1aa',
                fontWeight: subTab === 'municipal-report' ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <FileText size={16} color={subTab === 'municipal-report' ? '#00E6B4' : '#71717a'} />
              <span>Audit PDF Generator & n8n Dispatch</span>
            </button>
          </>
        )}

        <button
          onClick={() => setSubTab('public-feed')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: subTab === 'public-feed' ? 'rgba(0, 230, 180, 0.15)' : 'transparent',
            color: subTab === 'public-feed' ? '#00E6B4' : '#a1a1aa',
            fontWeight: subTab === 'public-feed' ? 700 : 500,
            fontSize: '0.84rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <History size={16} color={subTab === 'public-feed' ? '#00E6B4' : '#71717a'} />
          <span>Incident History Feed</span>
        </button>
      </div>

      {subTab === 'public-feed' ? (
        <PublicFeedHistoryView 
          onNavigateToReport={() => {
            setSubTab('my-reports');
            if (onNavigateToDetection) onNavigateToDetection();
          }} 
        />
      ) : subTab === 'municipal-report' ? (
        <ReportGeneratorView />
      ) : (
        <React.Fragment>
          {/* Header Banner */}
      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #38BDF8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
                <ClipboardList size={24} color="#38BDF8" />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                {userRole === 'admin' ? 'Authority Road Hazard Complaint Registry' : 'My Road Hazard Reports & Tracking'}
              </h2>
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
              {userRole === 'admin' 
                ? 'Central municipal oversight registry for inspecting, assigning contractors, and updating repair lifecycles.'
                : 'Track the real-time lifecycle of your submitted road hazard photographs from AI verification to municipal resolution.'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#18181b', padding: '10px 16px', borderRadius: '8px', border: '1px solid #27272a', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{reports.length}</div>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Total Reports</div>
            </div>
            <div style={{ background: '#18181b', padding: '10px 16px', borderRadius: '8px', border: '1px solid #27272a', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F97316' }}>
                {reports.filter(r => !['RESOLVED', 'REJECTED'].includes(r.status)).length}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Active</div>
            </div>
            <div style={{ background: '#18181b', padding: '10px 16px', borderRadius: '8px', border: '1px solid #27272a', textAlign: 'center', minWidth: '90px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10B981' }}>
                {reports.filter(r => ['RESOLVED', 'REPAIR_COMPLETED'].includes(r.status)).length}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#71717a', textTransform: 'uppercase' }}>Resolved</div>
            </div>
          </div>
        </div>
      </div>

      {/* Incident History Analytics Summary Visuals */}
      <div className="grid-2">
        {/* City Hazard Severity Breakdown Donut Chart */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.96rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={16} color="#F59E0B" /> City Hazard Severity Breakdown
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#71717a' }}>Incident Telemetry</span>
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

        {/* Perception Confidence vs Risk Rating Bar Chart */}
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


      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#18181b', padding: '8px 12px', borderRadius: '8px', border: '1px solid #27272a', flex: '1 1 240px', maxWidth: '380px' }}>
          <Search size={16} color="#71717a" />
          <input 
            type="text"
            placeholder="Search by Report ID, Landmark, Severity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.82rem', width: '100%', outline: 'none' }}
          />
          {searchQuery && (
            <X size={14} color="#71717a" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'ACTIVE', label: 'Active / In Progress' },
            { id: 'AI_VERIFIED', label: 'AI Verified' },
            { id: 'UNDER_REVIEW', label: 'Under Review' },
            { id: 'RESOLVED', label: 'Resolved' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                background: statusFilter === tab.id ? 'rgba(56, 189, 248, 0.15)' : '#18181b',
                color: statusFilter === tab.id ? '#38BDF8' : '#a1a1aa',
                border: `1px solid ${statusFilter === tab.id ? '#38BDF8' : '#27272a'}`,
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
          <button 
            className="btn-secondary" 
            onClick={fetchReports} 
            title="Refresh reports"
            style={{ padding: '6px 10px', fontSize: '0.74rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Reports List / Grid */}
      {loading ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <RefreshCw className="spin" size={32} color="#00E6B4" style={{ marginBottom: '12px' }} />
          <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>Retrieving your submitted reports...</div>
          <p style={{ color: '#71717a', fontSize: '0.78rem' }}>Authenticating user session & loading lifecycle statuses</p>
        </div>
      ) : errorMsg ? (
        <div className="glass-card" style={{ padding: '36px 20px', textAlign: 'center', borderColor: '#EF4444' }}>
          <AlertCircle size={32} color="#EF4444" style={{ marginBottom: '10px' }} />
          <div style={{ color: '#FCA5A5', fontSize: '0.9rem', marginBottom: '12px' }}>{errorMsg}</div>
          <button className="btn-secondary" onClick={fetchReports} style={{ fontSize: '0.78rem' }}>
            Try Again
          </button>
        </div>
      ) : filteredReports.length === 0 ? (
        /* Empty State */
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <ClipboardList size={28} color="#38BDF8" />
          </div>
          <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '6px' }}>
            {searchQuery || statusFilter !== 'ALL' ? 'No matching reports found' : 'No road hazard reports submitted yet'}
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '0.82rem', maxWidth: '460px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
            {searchQuery || statusFilter !== 'ALL' 
              ? 'Try resetting your filter or search query to see all submitted reports.'
              : 'Submit a photograph of a pothole or road damage using our AI Vision Perception scanner to track its complete repair lifecycle.'}
          </p>
          {onNavigateToDetection && (
            <button 
              className="btn-primary" 
              onClick={() => onNavigateToDetection()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', padding: '10px 20px' }}
            >
              Scan & Report Road Hazard <ArrowRight size={16} />
            </button>
          )}
        </div>
      ) : (
        /* Reports Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredReports.map((report) => {
            const statusBadge = getStatusBadge(report.status);
            const sevColor = getSeverityColor(report.severity);
            return (
              <div 
                key={report.id}
                className="glass-card hover-lift" 
                style={{ 
                  padding: '18px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  gap: '14px',
                  border: '1px solid #27272a',
                  transition: 'all 0.2s'
                }}
              >
                <div>
                  {/* Top row: ID & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.5px' }}>
                      #{report.report_id}
                    </span>
                    <span 
                      style={{
                        background: statusBadge.bg,
                        border: `1px solid ${statusBadge.border}`,
                        color: statusBadge.color,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '12px'
                      }}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Attached Photograph Preview */}
                  {report.image_name && (
                    <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', position: 'relative', border: '1px solid #27272a', background: '#09090b' }}>
                      <img 
                        src={
                          report.image_name.startsWith('http') || report.image_name.startsWith('data:')
                            ? report.image_name
                            : `/potholes/${report.image_name.replace(/^\/?(potholes|api\/images)\//, '')}`
                        } 
                        alt="Attached Road Damage Photograph"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.opacity = '0.5';
                        }}
                      />
                      <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(9, 9, 11, 0.85)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#a1a1aa', border: '1px solid #27272a' }}>
                        📷 Attached Photo Evidence
                      </div>
                    </div>
                  )}

                  {/* Hazard Title & Location */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🕳️</span> {report.damage_type || 'Pothole Hazard'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="#F59E0B" />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {report.landmark_name || `${report.latitude?.toFixed(4)}°, ${report.longitude?.toFixed(4)}°`}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Matrix */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#121217', padding: '10px', borderRadius: '8px', border: '1px solid #222' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#71717a' }}>SEVERITY</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: sevColor }}>
                        {report.severity || 'Medium'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#71717a' }}>AUTHENTICITY</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00E6B4' }}>
                        {report.authenticity_score ? `${report.authenticity_score}%` : 'Verified'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#71717a' }}>RISK SCORE</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>
                        {report.risk_score ? `${report.risk_score}/100` : '50/100'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#71717a' }}>SUBMITTED</div>
                      <div style={{ fontSize: '0.74rem', color: '#d4d4d8' }}>
                        {report.created_at ? report.created_at.split(' ')[0] : 'Today'}
                      </div>
                    </div>
                  </div>

                  {/* Reporter Contact Email Badge */}
                  {(report.user_email || report.reporter_email) && (
                    <div style={{ marginTop: '10px', padding: '6px 10px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: '0.72rem', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <User size={12} /> <b style={{ color: '#fff' }}>{report.user_name || 'Citizen'}</b>
                      </span>
                      <span style={{ color: '#00E6B4', fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ✉️ {report.user_email || report.reporter_email}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Action Button */}
                <button 
                  className="btn-secondary" 
                  onClick={() => openReportTracking(report.id)}
                  style={{ width: '100%', fontSize: '0.78rem', padding: '8px', justifyContent: 'center', gap: '6px', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38BDF8' }}
                >
                  <Clock size={14} /> View Tracking & Lifecycle Timeline
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ================== DETAILED LIFECYCLE TIMELINE MODAL ================== */}
      {selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div 
            className="glass-card" 
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)'
            }}
          >
            {/* Modal Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #27272a', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    Report #{selectedReport.report_id}
                  </h3>
                  <span 
                    style={{
                      background: getStatusBadge(selectedReport.status).bg,
                      border: `1px solid ${getStatusBadge(selectedReport.status).border}`,
                      color: getStatusBadge(selectedReport.status).color,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px'
                    }}
                  >
                    {getStatusBadge(selectedReport.status).label}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>Submitted by: <strong>{selectedReport.user_name}</strong></span>
                  {(selectedReport.user_email || selectedReport.reporter_email) && (
                    <>
                      <span>•</span>
                      <span style={{ color: '#00E6B4' }}>✉️ {selectedReport.user_email || selectedReport.reporter_email}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{selectedReport.created_at}</span>
                </div>
              </div>

              <button 
                onClick={() => setSelectedReport(null)}
                style={{ background: '#27272a', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Overview Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: '#18181b', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginBottom: '2px' }}>HAZARD TYPE & SEVERITY</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                  {selectedReport.damage_type} &nbsp;|&nbsp; 
                  <span style={{ color: getSeverityColor(selectedReport.severity) }}>{selectedReport.severity}</span>
                </div>
              </div>
              <div style={{ background: '#18181b', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginBottom: '2px' }}>LOCATION & GPS</div>
                <div style={{ fontSize: '0.82rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  📍 {selectedReport.landmark_name} ({selectedReport.latitude?.toFixed(4)}°, {selectedReport.longitude?.toFixed(4)}°)
                </div>
              </div>
              <div style={{ background: '#18181b', padding: '12px', borderRadius: '8px', border: '1px solid #27272a' }}>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginBottom: '2px' }}>AUTHENTICITY & RISK</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#00E6B4' }}>
                  🛡️ {selectedReport.authenticity_score}% &nbsp;|&nbsp; 
                  <span style={{ color: '#F97316' }}>Risk {selectedReport.risk_score}/100</span>
                </div>
              </div>
            </div>

            {/* Attached Photo Evidence Card */}
            {selectedReport.image_name && (
              <div style={{ marginBottom: '24px', background: '#121217', borderRadius: '10px', overflow: 'hidden', border: '1px solid #27272a' }}>
                <div style={{ padding: '10px 14px', background: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#a1a1aa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📷 Attached Photographic Evidence
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#00E6B4' }}>
                    File: {selectedReport.image_name}
                  </span>
                </div>
                <div style={{ width: '100%', height: '240px', background: '#09090b', overflow: 'hidden' }}>
                  <img 
                    src={
                      selectedReport.image_name.startsWith('http') || selectedReport.image_name.startsWith('data:')
                        ? selectedReport.image_name
                        : `/potholes/${selectedReport.image_name.replace(/^\/?(potholes|api\/images)\//, '')}`
                    }
                    alt="Attached Road Damage Evidence"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.style.opacity = '0.5';
                    }}
                  />
                </div>
              </div>
            )}

            {/* 8-STAGE VISUAL LIFECYCLE ROADMAP */}
            <div style={{ marginBottom: '28px' }}>
              <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#38BDF8" /> Complete Repair Lifecycle Roadmap
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                {LIFECYCLE_STAGES.map((stage, idx) => {
                  const currentStageIdx = getStageIndex(selectedReport.status);
                  const isCompleted = idx < currentStageIdx || selectedReport.status === 'RESOLVED';
                  const isCurrent = idx === currentStageIdx && selectedReport.status !== 'RESOLVED';
                  const isPending = idx > currentStageIdx && selectedReport.status !== 'RESOLVED';

                  return (
                    <div 
                      key={stage.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '16px',
                        position: 'relative',
                        paddingBottom: idx === LIFECYCLE_STAGES.length - 1 ? '0' : '20px'
                      }}
                    >
                      {/* Connecting Vertical Line */}
                      {idx !== LIFECYCLE_STAGES.length - 1 && (
                        <div 
                          style={{
                            position: 'absolute',
                            left: '15px',
                            top: '30px',
                            bottom: '0',
                            width: '2px',
                            background: isCompleted ? '#10B981' : (isCurrent ? 'rgba(56, 189, 248, 0.4)' : '#27272a'),
                            zIndex: 1
                          }}
                        />
                      )}

                      {/* Stage Node Icon */}
                      <div 
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isCompleted ? '#10B981' : (isCurrent ? '#0284C7' : '#18181b'),
                          border: `2px solid ${isCompleted ? '#10B981' : (isCurrent ? '#38BDF8' : '#3f3f46')}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          zIndex: 2,
                          boxShadow: isCurrent ? '0 0 12px #38BDF8' : 'none',
                          flexShrink: 0
                        }}
                      >
                        {isCompleted ? <Check size={16} /> : (isCurrent ? '●' : '○')}
                      </div>

                      {/* Stage Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ 
                            fontSize: '0.88rem', 
                            fontWeight: isCurrent ? 800 : 600, 
                            color: isCompleted ? '#10B981' : (isCurrent ? '#38BDF8' : '#71717a') 
                          }}>
                            {stage.label}
                          </span>
                          {isCurrent && (
                            <span style={{ fontSize: '0.66rem', padding: '1px 6px', background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', borderRadius: '8px', fontWeight: 700 }}>
                              CURRENT STAGE
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: isPending ? '#52525b' : '#a1a1aa' }}>
                          {stage.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CHRONOLOGICAL STATUS AUDIT HISTORY */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10B981" /> Activity & Audit Log
              </h4>

              <div style={{ background: '#121217', borderRadius: '8px', border: '1px solid #27272a', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedReport.status_history?.map((event, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: i === selectedReport.status_history.length - 1 ? 'none' : '1px solid #1f1f23', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔹</span> {event.status_label || event.status}
                        <span style={{ fontSize: '0.68rem', color: '#71717a', fontWeight: 400 }}>
                          by [{event.changed_by}]
                        </span>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#a1a1aa', marginTop: '2px', paddingLeft: '18px' }}>
                        {event.message}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#71717a', whiteSpace: 'nowrap' }}>
                      {event.changed_at}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ADMIN / AUTHORITY LIFECYCLE MANAGEMENT PANEL */}
            {userRole === 'admin' && (
              <div style={{ background: '#18181b', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#F59E0B', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={16} /> Municipal Authority Workflow Action
                </div>

                {statusUpdateSuccess && (
                  <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', borderRadius: '6px', color: '#10B981', fontSize: '0.76rem', marginBottom: '10px' }}>
                    {statusUpdateSuccess}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '4px' }}>NEXT STAGE:</label>
                    <select
                      value={selectedNextStatus}
                      onChange={(e) => setSelectedNextStatus(e.target.value)}
                      style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '7px 10px', borderRadius: '6px', fontSize: '0.78rem', width: '100%' }}
                    >
                      {LIFECYCLE_STAGES.map(st => (
                        <option key={st.key} value={st.key}>{st.label}</option>
                      ))}
                      <option value="REJECTED">❌ Reject Report</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '4px' }}>AUTHORITY NOTE / REPAIR LOG:</label>
                    <input 
                      type="text"
                      placeholder="e.g. Assigned to PWD Crew #4 for road patching..."
                      value={statusUpdateNote}
                      onChange={(e) => setStatusUpdateNote(e.target.value)}
                      style={{ background: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '7px 10px', borderRadius: '6px', fontSize: '0.78rem', width: '100%' }}
                    />
                  </div>

                  <div style={{ alignSelf: 'flex-end' }}>
                    <button 
                      className="btn-primary"
                      onClick={handleUpdateStatus}
                      disabled={isUpdatingStatus}
                      style={{ padding: '8px 16px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isUpdatingStatus ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                      Update Lifecycle
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </React.Fragment>
  )}

</div>
  );
}
