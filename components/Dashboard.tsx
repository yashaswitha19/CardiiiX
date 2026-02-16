import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplets, Activity, Zap, Wind, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, WifiOff, AlertCircle, Terminal, Info, Cpu, Eye, Upload, Loader } from 'lucide-react';
import { localServices, ServiceStatus } from '../services/localServices';
import supabase from './supabaseClient.js';
import { Sparkles, X } from 'lucide-react'


interface HealthData {
  id?: number;
  bpm: number;
  spo2: number;
  created_at: string;
}


const Dashboard: React.FC = ( ) => {
  const [history, setHistory] = useState<any[]>([]);
  const [backendStatus, setBackendStatus] = useState<ServiceStatus | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [eyeImage, setEyeImage] = useState<File | null>(null);
  const [eyeAnalysis, setEyeAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [reports, setReports] = useState([]);
const [loading, setLoading] = useState(true);
const [selectedReport, setSelectedReport] = useState(null);

  // Real-time health data from Supabase
  const [latestHealthData, setLatestHealthData] = useState<HealthData | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthData[]>([]);
  const [supabaseConnected, setSupabaseConnected] = useState(false);


useEffect(() => {
  fetchUserReports();
}, []);

const fetchUserReports = async () => {
  try {
    setLoading(true);
    // NO TOKEN - gets ALL reports (for testing)
    const response = await fetch('http://localhost:8000/api/user/reports');
    const data = await response.json();
    setReports(data.reports.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  } catch (error) {
    console.error('Failed to fetch:', error);
  } finally {
    setLoading(false);
  }
};


const ReportAnalysisModal = ({ report, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-white/10 max-w-4xl max-h-[90vh] w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-green-500/20 rounded-2xl flex items-center justify-center border-2 border-white/20">
                <Eye size={24} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{report.type}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                  <span>{new Date(report.timestamp).toLocaleDateString()}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    report.status === 'Completed' ? 'bg-green-500/10 text-green-400' : 
                    report.status === 'Processing' ? 'bg-yellow-500/10 text-yellow-400' : 
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {report.status}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-all group"
            >
              <X size={20} className="text-slate-400 group-hover:text-white" />
            </button>
          </div>
        </div>

        {/* Analysis Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
          {/* AI Interpretation */}
          <div className="bg-gradient-to-r from-blue-500/5 to-green-500/5 p-6 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Sparkles size={20} className="text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">AI Clinical Summary</h4>
                <p className="text-xs text-slate-400">Automated analysis by Dr. Vision AI</p>
              </div>
            </div>
            <p className="text-white/90 text-sm leading-relaxed font-medium">
              "{report.aiInterpretation}"
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-1">Confidence</div>
              <div className="text-2xl font-black text-white">{report.confidence}%</div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-1">Severity</div>
              <div className={`text-xl font-bold ${
                report.severity === 'Severe' ? 'text-red-400' :
                report.severity === 'Moderate' ? 'text-orange-400' :
                report.severity === 'Mild' ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {report.severity}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-1">Risk Level</div>
              <div className={`text-xl font-bold ${
                report.risk === 'elevated_risk' ? 'text-red-400' :
                report.risk === 'possible_elevated' ? 'text-orange-400' :
                'text-green-400'
              }`}>
                {report.risk.replace('_', ' ').toUpperCase()}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
            <button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-xl border border-transparent transition-all shadow-lg hover:shadow-xl">
              Download Report PDF
            </button>
            <button className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl border border-white/20 transition-all">
              Share with Doctor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


  // Fetch initial health data from Supabase
  useEffect(() => {
    const fetchInitialHealthData = async () => {
      console.log('=== STARTING DATA FETCH ===');
      
      try {
        // Fetch latest reading
        console.log('Fetching latest reading...');
        const { data: latestData, error: latestError } = await supabase
          .from('health_readings')
          .select('bpm, spo2, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();


        if (latestError) {
          console.error('❌ Error fetching latest:', latestError);
        }


        if (latestData) {
          console.log('✅ Setting latest health data:', latestData);
          setLatestHealthData(latestData);
          setSupabaseConnected(true);
        }


        // Fetch history
        console.log('Fetching history...');
        const { data: historyData, error: historyError } = await supabase
          .from('health_readings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);


        if (historyError) {
          console.error('❌ Error fetching history:', historyError);
        }


        if (historyData) {
          console.log('✅ Setting health history, records:', historyData.length);
          setHealthHistory(historyData.reverse());
        }
      } catch (error) {
        console.error('💥 Caught exception:', error);
        setSupabaseConnected(false);
      }
    };


    fetchInitialHealthData();
  }, []);


  // Setup realtime subscription
  useEffect(() => {
    console.log('=== SETTING UP REALTIME SUBSCRIPTION ===');
    
    const channel = supabase
      .channel('health_readings_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'health_readings'
        },
        (payload) => {
          console.log('🎉 REALTIME EVENT RECEIVED!', payload);
          setLatestHealthData(payload.new as HealthData);
          setHealthHistory((prev) => [...prev, payload.new as HealthData].slice(-20));
          setSupabaseConnected(true);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Subscription status:', status);
        if (err) console.error('❌ Subscription error:', err);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to realtime updates!');
        }
      });


    return () => {
      console.log('🔌 Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);


  useEffect(() => {
    const loadData = async () => {
      const { backend } = await localServices.checkHealth();
      setBackendStatus(backend);
      const data = await localServices.getScanHistory();
      setHistory(data);
    };
    loadData();
  }, []);


  // Prepare chart data - prioritize Supabase data if available
  const chartData = healthHistory.length > 0
    ? healthHistory.map(h => ({
        time: new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        heartRate: h.bpm,
        oxygen: h.spo2
      }))
    : history.length > 0
    ? history.map(h => ({
        time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        heartRate: h.heartRate
      }))
    : [
        { time: '08:00', heartRate: 72 },
        { time: '10:00', heartRate: 85 },
        { time: '12:00', heartRate: 78 },
        { time: '14:00', heartRate: 92 },
      ];


  const latest = history[history.length - 1];


  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5004';
  
  const handleEyeAnalysis = async () => {
    if (!eyeImage) return;
    setAnalyzing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', eyeImage);
      
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      const analysisText = formatAnalysisResult(result);
      setEyeAnalysis(analysisText);
      
    } catch (error) {
      console.error('Analysis error:', error);
      setEyeAnalysis('Failed to analyze image. Please ensure the backend server is running on port 5004.');
    } finally {
      setAnalyzing(false);
    }
  };


  const formatAnalysisResult = (result: any) => {
    if (!result.success) {
      return 'Analysis failed. Please try with a clearer eye image.';
    }
    
    const { arcus_detected, arcus_severity, cholesterol_risk, confidence, details } = result;
    
    return `
🔍 Eye Analysis Complete


Status: ${arcus_detected ? '✅ Corneal Arcus Detected' : '❌ No Arcus Detected'}
Severity: ${arcus_severity.toUpperCase()}
Cholesterol Risk: ${cholesterol_risk.replace('_', ' ').toUpperCase()}
Confidence: ${(confidence * 100).toFixed(1)}%


📊 Technical Details:
• Ring Intensity: ${details.mean_ring_intensity}
• Iris Intensity: ${details.mean_iris_intensity}
• Contrast Ratio: ${details.contrast_ratio}x
• Uniform Pattern: ${details.is_uniform_ring ? 'Yes' : 'No'}
• Bright Segments: ${details.segments_bright}/12
• Iris Radius: ${details.iris_radius} pixels


⚠️ Important: This is a visual screening tool only and not a medical diagnosis. Please consult a healthcare professional for proper evaluation.
    `.trim();
  };


  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Supabase Connection Status */}
      {supabaseConnected && latestHealthData && (
        <div className="bg-green-50 border-2 border-green-100 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-bold text-green-700">
            Live data connected • Last update: {new Date(latestHealthData.created_at).toLocaleTimeString()}
          </span>
        </div>
      )}


      {/* Service Error & CORS Helper */}
      {backendStatus && !backendStatus.ok && (


        <div className="space-y-4 animate-in slide-in-from-top-4">
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
            <div className="p-4 bg-red-100 text-red-600 rounded-2xl shrink-0">
              <WifiOff size={32} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-red-900 mb-1">Backend Connection Failed</h3>
              <p className="text-red-700 text-sm font-medium mb-3">
                {backendStatus.message}. {backendStatus.errorType === 'CORS' ? 'This is likely a CORS policy restriction.' : ''}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDebug(!showDebug)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-lg shadow-red-200"
                >
                  <Terminal size={14} />
                  {showDebug ? 'Hide Fix' : 'Show Quick Fix'}
                </button>
                
              </div>
            </div>
            <div className="hidden lg:block text-right">
              <p className="text-[10px] font-black text-red-300 uppercase tracking-widest mb-1">Raw Error</p>
              <code className="text-[10px] text-red-500 bg-red-100/50 px-2 py-1 rounded">{backendStatus.rawError}</code>
            </div>
          </div>


          {showDebug && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Node.js Fix</h4>
                </div>
                <pre className="text-[11px] text-blue-400 font-mono bg-black/40 p-4 rounded-xl overflow-x-auto">
{`// 1. npm install cors
const cors = require('cors');
const app = express();


// 2. Add this BEFORE routes
app.use(cors());`}
                </pre>
              </div>
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">FastAPI Fix</h4>
                </div>
                <pre className="text-[11px] text-green-400 font-mono bg-black/40 p-4 rounded-xl overflow-x-auto">
{`from fastapi.middleware.cors import CORSMiddleware


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Patient Console</h2>
          <p className="text-slate-500 font-medium text-lg">Real-time health insights via CardiaX.</p>
        </div>
      </section>


      {/* Stats Cards - UPDATED TO USE SUPABASE DATA FOR HEART RATE AND OXYGEN ONLY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Heart Rate Card - Uses Supabase Data */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
          <div className="flex justify-between items-start mb-8">
            <div className="p-5 rounded-3xl bg-rose-50 text-rose-500 group-hover:scale-110 transition-transform">
              <Activity size={32} />
            </div>
            <div className="flex flex-col items-end">
              <ArrowUpRight size={24} className="text-rose-500" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">up</span>
            </div>
          </div>
          <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Heart Rate</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 tracking-tighter">
              {latestHealthData?.bpm || '72'}
            </span>
            <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">bpm</span>
          </div>
        </div>

        {/* Blood Pressure Card - Uses Local Data (Unchanged) */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
          <div className="flex justify-between items-start mb-8">
            <div className="p-5 rounded-3xl bg-blue-50 text-blue-500 group-hover:scale-110 transition-transform">
              <Droplets size={32} />
            </div>
            <div className="flex flex-col items-end">
              <ArrowDownRight size={24} className="text-green-500" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">down</span>
            </div>
          </div>
          <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Est. BP</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 tracking-tighter">
              {latest ? `${latest.bloodPressure.systolic}/${latest.bloodPressure.diastolic}` : '120/80'}
            </span>
            <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">mmHg</span>
          </div>
        </div>

        {/* Oxygen Card - Uses Supabase Data */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
          <div className="flex justify-between items-start mb-8">
            <div className="p-5 rounded-3xl bg-teal-50 text-teal-500 group-hover:scale-110 transition-transform">
              <Wind size={32} />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">stable</span>
            </div>
          </div>
          <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1">Oxygen</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-slate-900 tracking-tighter">
              {latestHealthData?.spo2 || '98'}
            </span>
            <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">%</span>
          </div>
        </div>
      </div>


      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-12">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Vitals Timeline</h3>
              <p className="text-sm text-slate-400 font-medium">
                {supabaseConnected ? 'Live MAX30102 sensor data' : 'Cardiovascular micro-fluctuation history'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
              <Clock size={16} className={supabaseConnected ? "text-green-500" : "text-blue-500"} />
              {supabaseConnected ? 'Live Supabase Data' : 'Local Data'}
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorHeart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOxygen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 800}} />
                <Tooltip 
                  cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }}
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', fontWeight: 800, padding: '16px' }}
                />
                <Area type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={5} fillOpacity={1} fill="url(#colorHeart)" animationDuration={2000} />
                {healthHistory.length > 0 && (
                  <Area type="monotone" dataKey="oxygen" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorOxygen)" animationDuration={2000} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>


        {/* AI Health Analysis - UNCHANGED, USES LOCAL DATA ONLY */}
        {/* AI Health Analysis - DATABASE DRIVEN */}
<div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col relative overflow-hidden group">
  <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-1000">
    <ShieldCheck size={160} className="text-white" />
  </div>
  <div className="relative z-10">
    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10">
      <Zap size={24} className="text-blue-400" />
    </div>
    <h3 className="text-2xl font-black text-white mb-2 tracking-tight">AI Health Analysis</h3>
    <p className="text-slate-500 text-sm font-medium mb-8">Recent scan reports & clinical insights</p>
  </div>
  
  <div className="flex-1 space-y-4 relative z-10">
    {loading ? (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    ) : reports.length > 0 ? (
      <div className="space-y-3">
        {/* Latest Report Preview */}
        <div className="flex items-center justify-between mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Eye size={16} className="text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-white text-sm">{reports[0].type}</div>
              <div className="text-xs text-slate-400">{new Date(reports[0].timestamp).toLocaleDateString()}</div>
            </div>
          </div>
          <button
            onClick={() => setSelectedReport(reports[0])}
            className="text-blue-400 hover:text-blue-300 text-sm font-bold px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/30 transition-all hover:bg-blue-500/20"
          >
            View Analysis
          </button>
        </div>
        
        {/* All Reports List */}
        <div className="space-y-2">
          {reports.slice(1).map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-all group/item"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center group-hover/item:bg-green-500/30">
                  {report.type === 'Eye Scan' ? <Eye size={14} className="text-green-400" /> : <Activity size={14} className="text-green-400" />}
                </div>
                <div>
                  <div className="font-medium text-white/90 text-sm">{report.type}</div>
                  <div className="text-xs text-slate-400">{new Date(report.timestamp).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="text-xs text-slate-500 font-medium">{report.status}</div>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 flex flex-col items-center text-center gap-6 py-12">
        <div className="p-4 bg-blue-500/10 rounded-full">
          <Activity size={40} className="text-blue-500 animate-pulse" />
        </div>
        <p className="text-slate-400 text-sm font-medium leading-relaxed">
          No scan history found. Run a Vital Scan to generate clinical AI insights.
        </p>
      </div>
    )}
  </div>
</div>

{selectedReport && (
  <ReportAnalysisModal 
    report={selectedReport} 
    onClose={() => setSelectedReport(null)} 
  />
)}

      </div>


      {/* Eye Analysis Section */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 bg-blue-50 text-blue-500 rounded-3xl">
            <Eye size={32} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Eye Analysis</h3>
            <p className="text-sm text-slate-400 font-medium">Upload an eye image for AI-powered analysis</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="flex-1" htmlFor="eye-image-input">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setEyeImage(e.target.files?.[0] || null)}
                className="hidden"
                id="eye-image-input"
              />
              <div className="w-full p-6 border-2 border-dashed border-slate-300 rounded-2xl hover:border-blue-400 transition-colors cursor-pointer bg-slate-50 hover:bg-blue-50/50">
                <div className="flex items-center justify-center gap-4">
                  <Upload size={24} className="text-slate-400" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-600">
                      {eyeImage ? eyeImage.name : 'Click to upload eye image'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG up to 10MB</p>
                  </div>
                </div>
              </div>
            </label>
            <button
              onClick={handleEyeAnalysis}
              disabled={!eyeImage || analyzing}
              className="px-8 py-4 bg-blue-500 text-white font-bold rounded-2xl hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg"
            >
              {analyzing ? <Loader size={20} className="animate-spin" /> : <Eye size={20} />}
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          
          {eyeAnalysis && (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h4 className="text-lg font-bold text-slate-900 mb-4">Analysis Result</h4>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{eyeAnalysis}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export default Dashboard;
