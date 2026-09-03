import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AdminSidebar } from './AdminSidebar';
import { AgapayLogoText } from './AgapayLogo';
import { LogOut, User, Bell, Moon, Sun, Menu, X } from 'lucide-react';

export function AdminLayout({ children, title, description, showHeader = true }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="flex h-screen bg-[#f4f5ff] overflow-hidden">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={toggleMobileMenu} />
      )}

      {mobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 md:hidden">
          <AdminSidebar onMobile={true} onClose={toggleMobileMenu} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showHeader && (
          <header className="bg-white/95 border-b border-indigo-100 px-4 py-3 md:px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                onClick={toggleMobileMenu}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="hidden md:block">
                <AgapayLogoText />
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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
