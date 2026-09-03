import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AgritechSidebar } from './AgritechSidebar';
import { LogOut, User, Bell } from 'lucide-react';

export function AgritechLayout({ children, title, description }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-[#f4f5ff] overflow-hidden">
      <AgritechSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white/95 border-b border-indigo-100 px-4 py-3 md:px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-800 truncate">{title}</h1>
              {description && <p className="text-sm text-gray-500 truncate">{description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors relative" aria-label="Notifications">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={15} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">Agricultural Technologist</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 pt-20">
          {children}
        </main>
      </div>
    </div>
  );
}
