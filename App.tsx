import React, { useState } from 'react';
import { View } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatAssistant from './components/ChatAssistant';
import ReportAnalyzer from './components/ReportAnalyzer';
import VitalScan from './components/VitalScan';
import { Activity, AlertCircle, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const renderContent = () => {
    switch (activeView) {
      case View.DASHBOARD:
        return <Dashboard />;
      case View.CHAT:
        return <ChatAssistant />;
      case View.REPORTS:
        return <ReportAnalyzer />;
      case View.VITAL_SCAN:
        return <VitalScan />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-red-100 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={28} />
              <h2 className="text-xl font-bold">Medical Disclaimer</h2>
            </div>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Vivitsu Medical AI is an AI assistant and is <strong>not a substitute for professional medical advice</strong>, diagnosis, or treatment. 
              Always seek the advice of your physician.
            </p>
            <button 
              onClick={() => setShowDisclaimer(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
       
        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
