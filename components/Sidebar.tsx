
import React from 'react';
import { View } from '../types';
import { Activity, MessageSquare, FileText, Heart, ScanFace, User } from 'lucide-react';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange }) => {
  const navItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: Activity },
    { id: View.VITAL_SCAN, label: 'Vital Scan', icon: ScanFace },
    { id: View.CHAT, label: 'Symptom AI', icon: MessageSquare },
    { id: View.REPORTS, label: 'Report Analyzer', icon: FileText },
    
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg text-white">
          <Heart size={24} fill="currentColor" />
        </div>
        <span className="text-xl font-bold tracking-tight text-white">CardiaX</span>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeView === item.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
        
      </nav>

      <div className="p-6 space-y-6">
       

        <div className="border-t border-slate-700 pt-4">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-slate-800 group">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:bg-blue-500/30 transition-colors">
              <User size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">User Profile</p>
              
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
