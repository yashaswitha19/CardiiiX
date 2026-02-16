
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Activity, ShieldCheck, Loader2, Heart, AlertTriangle, CheckCircle, Wifi, WifiOff, Cpu, Info, FileText, Share2, Printer, Zap, XCircle, Database, Cloud } from 'lucide-react';
import { localServices, ServiceStatus } from '../services/localServices';
import { groqService } from '../services/groqService';
import { VitalScanResult } from '../types';



const VitalScan: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VitalScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<{backend: ServiceStatus, rppg: ServiceStatus} | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'local' | 'cloud' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const isMounted = useRef(true);

  // Health check decoupled from camera start
  const performCheck = useCallback(async () => {
    try {
      const status = await localServices.checkHealth( useProxy);
      if (isMounted.current) setServiceStatus(status);
    } catch (e) {
      console.error("Health check failed", e);
    }
  }, [ useProxy]);

  // Initial Camera Setup - Stabilized to prevent loops
  useEffect(() => {
    isMounted.current = true;
    startCamera();
    return () => {
      isMounted.current = false;
      stopCamera();
    };
  }, []); // Run ONLY once on mount

  // Periodic health check
  useEffect(() => {
    performCheck();
    const interval = setInterval(performCheck, 10000);
    return () => clearInterval(interval);
  }, [performCheck]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, frameRate: 30 }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }
    } catch (err) {
      if (isMounted.current) setError("Camera access denied. Please check browser permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

const processRecording = async (capturedChunks: Blob[]) => {
  if (isProcessing) return;
  setIsProcessing(true);
  setError(null);
  
  try {
    const blob = new Blob(capturedChunks, { type: 'video/webm' });
    if (blob.size === 0) throw new Error("No video data captured. Please hold still.");
    
    // 1. Analyze video
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    
    const response = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    const rppgData = await response.json();
    
    if (!rppgData.success) {
      throw new Error(rppgData.error || "Analysis failed");
    }
    
    // 2. Create AI text
    let aiText = `### REPORT_STATUS: ${rppgData.heart_rate > 100 ? 'ELEVATED' : 'STABLE'}\n\n**Summary:** Heart rate analysis completed with ${rppgData.quality} signal quality (${rppgData.confidence}% confidence).\n\n**Clinical Findings:**\n* [BPM: ${Math.round(rppgData.heart_rate)}] - ${rppgData.quality} quality detection\n* [BP: ${rppgData.blood_pressure.systolic}/${rppgData.blood_pressure.diastolic}] - Estimated values\n* [HRV: ${rppgData.hrv}] - Heart rate variability\n\n**AI Verdict:** Analysis based on ${rppgData.duration_seconds.toFixed(1)}s video with ${rppgData.face_frames}/${rppgData.frames_processed} frames detected.`;
    
    // 3. Create scan result
    const scanResult: VitalScanResult = {
      heartRate: Math.round(rppgData.heart_rate),
      hrv: rppgData.hrv,
      bloodPressure: {
        systolic: rppgData.blood_pressure.systolic,
        diastolic: rppgData.blood_pressure.diastolic
      },
      stressLevel: rppgData.stress_index > 50 ? 'High' : 'Normal',
      timestamp: new Date().toISOString(),
      aiInterpretation: aiText
    };

    // 4. ✅ SAVE TO MONGODB (MOVED INSIDE!)
    const saveResponse = await fetch('http://localhost:8000/api/vital-scan/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        heartRate: scanResult.heartRate,
        hrv: scanResult.hrv,
        bloodPressure: scanResult.bloodPressure,
        stressLevel: scanResult.stressLevel,
        aiInterpretation: scanResult.aiInterpretation,
        confidence: rppgData.confidence || 85.0
      })
    });

    const saveResult = await saveResponse.json();
    console.log('💾 MongoDB Save:', saveResult);

    if (!saveResult.success) {
      console.warn('⚠️ Save failed:', saveResult.error);
    }

    // 5. Update UI
    if (isMounted.current) {
      setResult(scanResult);
      setStorageStatus(saveResult.success ? 'cloud' : 'local');
    }

  } catch (err: any) {
    console.error("Analysis Error:", err);
    if (isMounted.current) {
      setError(err.message || "Failed to analyze video");
    }
  } finally {
    if (isMounted.current) setIsProcessing(false);
  }
};




const startRecording = () => {
  if (isRecording || isProcessing) return;
  
  console.log("🎥 Starting 30s recording...");
  setError(null);
  setResult(null);
  chunksRef.current = [];
  setRecordingTime(0);
  setIsRecording(true);

  const startTime = Date.now();
  
  // ✅ SINGLE TIMER for BOTH display AND auto-stop
  const timerId = window.setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    setRecordingTime(elapsed);
    
    // ✅ Auto-stop at EXACTLY 30 seconds
    if (elapsed >= 30) {
      console.log("⏰ 30s reached - FORCE STOP");
      clearInterval(timerId);
      forceStopRecording(); // Use force stop to break loops
      return;
    }
  }, 1000);

  // Store timer ID properly
  timerRef.current = timerId;

  if (videoRef.current?.srcObject) {
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      let mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      
      const recorder = new MediaRecorder(stream, { 
        mimeType,
        videoBitsPerSecond: 2500000 // Limit bitrate to prevent huge files
      });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        console.log(`✅ Recording stopped. Chunks: ${chunksRef.current.length}`);
        // ✅ Process with slight delay to ensure all chunks collected
        setTimeout(() => processRecording(chunksRef.current), 100);
      };

      recorder.onerror = (e) => {
        console.error("❌ MediaRecorder error:", e);
        forceStopRecording();
      };

      console.log("🚀 Starting MediaRecorder...");
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      
    } catch (e) {
      console.error("❌ Recording setup failed:", e);
      setError("Recording failed. Check camera permissions.");
      forceStopRecording();
    }
  }
};

// ✅ NEW FORCE STOP FUNCTION - Kills everything
const forceStopRecording = useCallback(() => {
  console.log("🔴 FORCE STOPPING ALL RECORDING");
  
  setIsRecording(false);
  setRecordingTime(0);
  
  // Clear ALL timers
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
  
  // Stop MediaRecorder
  if (mediaRecorderRef.current) {
    try {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.log("MediaRecorder already stopped");
    }
    mediaRecorderRef.current = null;
  }
  
  // Process chunks if we have any
  if (chunksRef.current.length > 0) {
    setTimeout(() => processRecording(chunksRef.current), 200);
  }
}, []);

// ✅ Replace your old stopRecording with this
const stopRecording = useCallback(() => {
  if (!isRecording) return;
  forceStopRecording();
}, [isRecording, forceStopRecording]);



  const renderClinicalReport = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {lines.map((line, i) => {
          if (line.startsWith('###')) {
            const status = line.replace(/###|REPORT_STATUS:/g, '').trim();
            const color = status.includes('OPTIMAL') || status.includes('STABLE') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200';
            return (
              <div key={i} className={`px-6 py-4 rounded-3xl border-2 font-black text-center uppercase tracking-[0.2em] text-sm shadow-sm ${color}`}>
                Vital Status: {status}
              </div>
            );
          }
          if (line.includes('[BPM:') || line.includes('[BP:') || line.includes('[HRV:')) {
            const parts = line.split(/(\[.*?\])/g);
            return (
              <div key={i} className="flex items-start gap-4 mb-2 border-l-2 border-slate-100 pl-4 py-1">
                <p className="text-slate-700 text-sm leading-relaxed">
                  {parts.map((part, idx) => {
                    if (part.startsWith('[BPM:')) return <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-black text-[10px] mx-1">HR: {part.replace('[BPM:', '').replace(']', '')}</span>;
                    if (part.startsWith('[BP:')) return <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-black text-[10px] mx-1">BP: {part.replace('[BP:', '').replace(']', '')}</span>;
                    if (part.startsWith('[HRV:')) return <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-black text-[10px] mx-1">HRV: {part.replace('[HRV:', '').replace(']', '')}</span>;
                    return <span key={idx}>{part.replace(/\*/g, '')}</span>;
                  })}
                </p>
              </div>
            );
          }
          if (line.startsWith('**AI Verdict:**')) {
            return (
              <div key={i} className="mt-8 pt-6 border-t border-slate-100">
                <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden group shadow-xl">
                  <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform duration-700"><Zap size={80} /></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">Final Verdict</p>
                  <p className="text-sm font-medium italic relative z-10 leading-relaxed">"{line.replace('**AI Verdict:**', '').trim()}"</p>
                </div>
              </div>
            );
          }
          if (line.startsWith('**')) return <h4 key={i} className="text-[11px] font-black text-slate-800 uppercase tracking-widest mt-8 mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>{line.replace(/\*\*/g, '')}</h4>;
          return line.trim() ? <p key={i} className="text-slate-500 text-sm leading-relaxed mb-1 pl-3.5">{line.replace(/\*/g, '')}</p> : null;
        })}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col items-center animate-in fade-in duration-700">
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">PhysNet Scan</h2>
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Activity size={18} className="text-blue-500" />
            <span>Biometric Signal Extraction Active</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => { setUseProxy(!useProxy); performCheck(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${useProxy ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
          >
            {useProxy ? 'Proxy Active' : 'Enable Proxy'}
            <Zap size={12} className={useProxy ? 'animate-pulse' : ''} />
          </button>
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border text-[11px] font-black uppercase tracking-widest shadow-sm ${ 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            {<Wifi size={14} />}
            {'Live Mode'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 w-full">
        <div className="lg:col-span-7 flex flex-col gap-8">
          <div className="relative aspect-video bg-slate-950 rounded-[3rem] overflow-hidden border-[12px] border-white shadow-2xl group ring-1 ring-slate-200">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            {isRecording && (
              <div className="absolute top-10 left-10">
                 <div className="bg-red-600 px-6 py-3 rounded-full text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-2xl">
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                    Capturing • {recordingTime}s
                 </div>
              </div>
            )}
            {!isRecording && !isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[4px] opacity-0 group-hover:opacity-100 transition-all duration-500">
                <button onClick={startRecording} className="bg-white text-slate-900 px-14 py-6 rounded-[2.5rem] font-black text-xl flex items-center gap-4 shadow-2xl hover:scale-105 active:scale-95 transition-all">
                  <Camera size={32} className="text-blue-600" />
                  Start Capture
                </button>
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white p-12 text-center">
                <Loader2 size={120} className="animate-spin text-blue-500/20 mb-12" />
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-4">Generating Report</h3>
                <p className="text-slate-400 text-sm font-medium">Processing physiological data and syncing to database...</p>
              </div>
            )}
          </div>
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex items-center justify-between border-l-[12px] border-l-blue-600">
            <div className="flex items-center gap-6">
              <div className="p-6 bg-blue-50 text-blue-600 rounded-[2rem]"><ShieldCheck size={40} /></div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medical Privacy</p>
                <p className="text-slate-900 font-black text-xl">Private Signal Analysis</p>
                <p className="text-slate-400 text-xs font-medium">Data is processed locally for your security.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col h-full">
          <div className="bg-white rounded-[4rem] border border-slate-200 shadow-2xl flex-1 flex flex-col overflow-hidden ring-4 ring-slate-50">
            <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight text-3xl">Clinical Scan</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {storageStatus === 'cloud' ? (
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100"><Cloud size={10}/> Cloud Synced</span>
                    ) : storageStatus === 'local' ? (
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-amber-600 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-100"><Database size={10}/> Local Database</span>
                    ) : null}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100"><FileText size={28} className="text-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Heart Rate</p>
                   <p className="text-3xl font-black text-slate-900">{result?.heartRate || '--'} <span className="text-[10px] opacity-30">BPM</span></p>
                </div>
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">BP Estimation</p>
                   <p className="text-3xl font-black text-slate-900">{result?.bloodPressure ? `${result.bloodPressure.systolic}/${result.bloodPressure.diastolic}` : '--/--'}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 p-10 overflow-y-auto bg-white min-h-[300px]">
              {error ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <XCircle size={48} className="text-rose-500" />
                  <h4 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Diagnostic Error</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100">{error}</p>
                  <div className="flex flex-col gap-2 w-full pt-4">
                    <button onClick={() => {setError(null); startCamera();}} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Retry Live</button>
                    {(
                      <button onClick={() => { window.location.reload(); }} className="w-full py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">Enable Simulation Mode</button>
                    )}
                  </div>
                </div>
              ) : result ? (
                renderClinicalReport(result.aiInterpretation || '')
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-8">
                  <Activity size={64} className="text-slate-100 animate-pulse" />
                  <div className="space-y-3">
                    <h4 className="font-black text-slate-900 text-xl tracking-tight uppercase">Ready</h4>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] max-w-[240px] mx-auto">Start a 15s session to generate your medical readout.</p>
                  </div>
                </div>
              )}
            </div>
            {result && (
              <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => setResult(null)} className="flex-1 p-5 bg-white border border-slate-200 text-slate-900 font-black rounded-[2rem] hover:bg-slate-100 shadow-sm transition-all">Clear</button>
                <button onClick={() => window.print()} className="flex-1 bg-slate-900 text-white font-black py-5 rounded-[2rem] hover:bg-slate-800 shadow-2xl flex items-center justify-center gap-3 transition-all"><Share2 size={20} className="text-blue-400" /> Export</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VitalScan;