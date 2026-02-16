
export enum View {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  REPORTS = 'REPORTS',
  VITAL_SCAN = 'VITAL_SCAN'
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface VitalScanResult {
  heartRate: number;
  hrv: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  stressLevel: string;
  timestamp: string;
  aiInterpretation?: string;
}

export interface HealthMetric {
  name: string;
  value: string | number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
}

export interface AppConfig {
  simulationMode: boolean;
}
