
// const BACKEND_URL = 'http://localhost:3000';
// const RPPG_URL = 'http://localhost:8001';

// // Public development proxy
// const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// export interface ServiceStatus {
//   ok: boolean;
//   message: string;
//   errorType?: 'CORS' | 'DOWN' | '404' | 'UNKNOWN';
//   rawError?: string;
//   latency?: number;
//   simulated?: boolean;
//   usingProxy?: boolean;
// }

// export const localServices = {
//   async checkHealth(forceSimulate: boolean = false, useProxy: boolean = false): Promise<{ backend: ServiceStatus, rppg: ServiceStatus }> {
//     if (forceSimulate) {
//       return {
//         backend: { ok: true, message: 'Simulated', simulated: true },
//         rppg: { ok: true, message: 'Simulated', simulated: true }
//       };
//     }

//     const check = async (url: string): Promise<ServiceStatus> => {
//       // NOTE: Public proxies cannot see localhost. This only works if URLs are public.
//       const targetUrl = useProxy ? `${CORS_PROXY}${url}` : url;
//       const start = Date.now();
//       try {
//         const res = await fetch(targetUrl, { 
//           mode: 'cors',
//           cache: 'no-cache',
//           headers: useProxy ? { 'X-Requested-With': 'XMLHttpRequest' } : {}
//         });
//         const latency = Date.now() - start;
//         return { ok: res.ok, message: res.ok ? 'Connected' : `Error ${res.status}`, latency, usingProxy: useProxy };
//       } catch (e: any) {
//         return { ok: false, message: 'Network Error', errorType: 'CORS', rawError: e.toString() };
//       }
//     };

//     const [backend, rppg] = await Promise.all([
//       check(`${BACKEND_URL}/api/health`),
//       check(`${RPPG_URL}/health`)
//     ]);

//     return { backend, rppg };
//   },

//   async analyzeVideo(videoBlob: Blob, simulate: boolean = false, useProxy: boolean = false) {
//     if (simulate) {
//       console.log("%c[SIMULATION] Generating vitals...", "color: #f59e0b; font-weight: bold");
//       await new Promise(r => setTimeout(r, 2000));
//       return {
//         heart_rate: 68 + Math.floor(Math.random() * 12),
//         hrv: 35 + Math.floor(Math.random() * 35),
//         blood_pressure: {
//           systolic: 115 + Math.floor(Math.random() * 15),
//           diastolic: 75 + Math.floor(Math.random() * 10)
//         },
//         stress_index: Math.floor(Math.random() * 100)
//       };
//     }

//     const formData = new FormData();
//     formData.append('file', videoBlob, 'capture.webm');

//     const targetUrl = useProxy ? `${CORS_PROXY}${RPPG_URL}/analyze-video` : `${RPPG_URL}/analyze-video`;
    
//     console.log(`%c[LIVE] Sending to ${targetUrl}`, "color: #3b82f6; font-weight: bold");

//     const response = await fetch(targetUrl, {
//       method: 'POST',
//       body: formData,
//       headers: useProxy ? { 'X-Requested-With': 'XMLHttpRequest' } : {}
//     });

//     if (!response.ok) {
//       throw new Error(`Server responded with ${response.status}. Check if rPPG engine is running on 8001.`);
//     }
//     return response.json();
//   },

//   async saveScanResult(result: any, simulate: boolean = false) {
//     // Format result for MongoDB storage
//     const scanData = {
//       heartRate: result.heart_rate || result.heartRate || 0,
//       hrv: result.hrv || 0,
//       bloodPressure: {
//         systolic: result.blood_pressure?.systolic || result.bloodPressure?.systolic || 0,
//         diastolic: result.blood_pressure?.diastolic || result.bloodPressure?.diastolic || 0
//       },
//       stressIndex: result.stress_index || result.stressIndex || 0,
//       aiInterpretation: result.aiInterpretation || 'Scan completed successfully.',
//       timestamp: new Date().toISOString()
//     };

//     console.group("Database Update Log");
//     console.table(scanData);

//     if (simulate) {
//       console.log("%c✅ MONGODB: Skipped (Simulation Mode)", "color: #f59e0b; font-weight: bold");
//       console.groupEnd();
//       return true;
//     }

//     // SAVE TO MONGODB VIA BACKEND API
//     try {
//       const response = await fetch(`${BACKEND_URL}/api/scans`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(scanData)
//       });
//       if (response.ok) {
//         const savedData = await response.json();
//         console.log("%c✅ MONGODB: Scan saved successfully", "color: #10b981; font-weight: bold");
//         console.log("Document ID:", savedData._id);
//         console.groupEnd();
//         return true;
//       }
//       console.error("%c❌ MONGODB: Save Failed", "color: #ef4444; font-weight: bold");
//       console.error(`Server responded with status: ${response.status}`);
//     } catch (e: any) {
//       console.error("%c❌ MONGODB: Connection Error", "color: #ef4444; font-weight: bold");
//       console.error(e.message);
//     }
//     console.groupEnd();
//     return false;
//   },

//   async getScanHistory(simulate: boolean = false) {
//     if (simulate) {
//       console.log("%c📊 Using simulated data", "color: #f59e0b; font-weight: bold");
//       return [];
//     }

//     try {
//       console.log("%c🔄 Fetching scan history from MongoDB...", "color: #3b82f6; font-weight: bold");
//       const response = await fetch(`${BACKEND_URL}/api/scans`);
      
//       if (response.ok) {
//         const data = await response.json();
//         console.log("%c✅ MONGODB: Scans retrieved", "color: #10b981; font-weight: bold");
//         console.log(`Found ${data.length} scans`);
        
//         // Transform MongoDB data to expected format
//         return data.map((scan: any) => ({
//           heartRate: scan.heartRate,
//           hrv: scan.hrv,
//           bloodPressure: scan.bloodPressure,
//           stressIndex: scan.stressIndex,
//           aiInterpretation: scan.aiInterpretation,
//           timestamp: scan.timestamp,
//           _id: scan._id
//         }));
//       }
      
//       console.error("%c❌ MONGODB: Failed to fetch", "color: #ef4444; font-weight: bold");
//       return [];
//     } catch (e: any) {
//       console.error("%c❌ MONGODB: Connection Error", "color: #ef4444; font-weight: bold");
//       console.error(e.message);
//       return [];
//     }
//   }
// };
const BACKEND_URL = 'http://localhost:3000';
const RPPG_URL = 'http://localhost:8001';

// Public development proxy
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export interface ServiceStatus {
  ok: boolean;
  message: string;
  errorType?: 'CORS' | 'DOWN' | '404' | 'UNKNOWN';
  rawError?: string;
  latency?: number;
  usingProxy?: boolean;
}

export const localServices = {
  async checkHealth(useProxy: boolean = false): Promise<{ backend: ServiceStatus, rppg: ServiceStatus }> {
    const check = async (url: string): Promise<ServiceStatus> => {
      const targetUrl = useProxy ? `${CORS_PROXY}${url}` : url;
      const start = Date.now();
      try {
        const res = await fetch(targetUrl, { 
          mode: 'cors',
          cache: 'no-cache',
          headers: useProxy ? { 'X-Requested-With': 'XMLHttpRequest' } : {}
        });
        const latency = Date.now() - start;
        return { ok: res.ok, message: res.ok ? 'Connected' : `Error ${res.status}`, latency, usingProxy: useProxy };
      } catch (e: any) {
        return { ok: false, message: 'Network Error', errorType: 'CORS', rawError: e.toString() };
      }
    };

    const [backend, rppg] = await Promise.all([
      check(`${BACKEND_URL}/api/health`),
      check(`${RPPG_URL}/health`)
    ]);

    return { backend, rppg };
  },

  async analyzeVideo(videoBlob: Blob, useProxy: boolean = false) {
    const formData = new FormData();
    formData.append('file', videoBlob, 'capture.webm');

    const targetUrl = useProxy ? `${CORS_PROXY}${RPPG_URL}/analyze-video` : `${RPPG_URL}/analyze-video`;
    
    console.log(`%c[LIVE] Sending to ${targetUrl}`, "color: #3b82f6; font-weight: bold");

    const response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      headers: useProxy ? { 'X-Requested-With': 'XMLHttpRequest' } : {}
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}. Check if rPPG engine is running on 8001.`);
    }
    return response.json();
  },

  async saveScanResult(result: any) {
    // Format result for MongoDB storage
    const scanData = {
      heartRate: result.heart_rate || result.heartRate || 0,
      hrv: result.hrv || 0,
      bloodPressure: {
        systolic: result.blood_pressure?.systolic || result.bloodPressure?.systolic || 0,
        diastolic: result.blood_pressure?.diastolic || result.bloodPressure?.diastolic || 0
      },
      stressIndex: result.stress_index || result.stressIndex || 0,
      aiInterpretation: result.aiInterpretation || 'Scan completed successfully.',
      timestamp: new Date().toISOString()
    };

    console.group("Database Update Log");
    console.table(scanData);

    // SAVE TO MONGODB VIA BACKEND API
    try {
      const response = await fetch(`${BACKEND_URL}/api/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanData)
      });
      if (response.ok) {
        const savedData = await response.json();
        console.log("%c✅ MONGODB: Scan saved successfully", "color: #10b981; font-weight: bold");
        console.log("Document ID:", savedData._id);
        console.groupEnd();
        return true;
      }
      console.error("%c❌ MONGODB: Save Failed", "color: #ef4444; font-weight: bold");
      console.error(`Server responded with status: ${response.status}`);
    } catch (e: any) {
      console.error("%c❌ MONGODB: Connection Error", "color: #ef4444; font-weight: bold");
      console.error(e.message);
    }
    console.groupEnd();
    return false;
  },

  async getScanHistory() {
    try {
      console.log("%c🔄 Fetching scan history from MongoDB...", "color: #3b82f6; font-weight: bold");
      const response = await fetch(`${BACKEND_URL}/api/scans`);
      
      if (response.ok) {
        const data = await response.json();
        console.log("%c✅ MONGODB: Scans retrieved", "color: #10b981; font-weight: bold");
        console.log(`Found ${data.length} scans`);
        
        // Transform MongoDB data to expected format
        return data.map((scan: any) => ({
          heartRate: scan.heartRate,
          hrv: scan.hrv,
          bloodPressure: scan.bloodPressure,
          stressIndex: scan.stressIndex,
          aiInterpretation: scan.aiInterpretation,
          timestamp: scan.timestamp,
          _id: scan._id
        }));
      }
      
      console.error("%c❌ MONGODB: Failed to fetch", "color: #ef4444; font-weight: bold");
      return [];
    } catch (e: any) {
      console.error("%c❌ MONGODB: Connection Error", "color: #ef4444; font-weight: bold");
      console.error(e.message);
      return [];
    }
  }
};
