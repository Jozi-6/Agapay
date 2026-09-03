import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, LogOut, Menu, X, User } from 'lucide-react';
import { DataEncoderSidebar } from './DataEncoderSidebar';

export function DataEncoderLayout({ children, metrics }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex bg-[#f4f5ff] overflow-hidden">
      <div className="hidden md:block">
        <DataEncoderSidebar user={user} metrics={metrics} />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {mobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 md:hidden">
          <DataEncoderSidebar user={user} metrics={metrics} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-indigo-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center">
                A
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-indigo-700">Agapay</h1>
                <p className="text-[11px] text-gray-500">Data Encoder Console</p>
              </div>
            </div>
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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
