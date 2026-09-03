import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AdminSidebar } from './AdminSidebar';
import { LogOut, User, Bell, Moon, Sun } from 'lucide-react';

export function AdminLayout({ children, title, description, showHeader = true }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-[#f4f5ff] overflow-hidden">
      <AdminSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showHeader && (
          <header className="bg-white/95 border-b border-indigo-100 px-4 py-3 md:px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                {/* Logo handled by sidebar */}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors" aria-label="Notifications">
                <Bell size={18} />
              </button>

              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={15} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">System Administrator</p>
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
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6 md:pl-20">
          {children}
        </main>
      </div>
    </div>
  );
}
