import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, LogOut, User } from 'lucide-react';
import { DataEncoderSidebar } from './DataEncoderSidebar';

export function DataEncoderLayout({ children, metrics }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex bg-[#f4f5ff] overflow-hidden">
      <DataEncoderSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-indigo-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Logo handled by sidebar */}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-9 h-9 rounded-xl border border-indigo-100 hover:bg-indigo-50 text-gray-600 flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>

            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white">
                  <User size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">Data Encoder</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 text-gray-700 hover:bg-indigo-50 transition-colors"
            >
              <LogOut size={16} />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 md:pl-20">
          {children}
        </main>
      </div>
    </div>
  );
}
