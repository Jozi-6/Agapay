import { useAuth } from '../../context/AuthContext';
import { Bell, LogOut } from 'lucide-react';
import { DataEncoderSidebar } from './DataEncoderSidebar';

export function DataEncoderLayout({ children, metrics }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex bg-[#f3f3ff] overflow-hidden">
      <DataEncoderSidebar user={user} metrics={metrics} />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-indigo-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold flex items-center justify-center">
              A
            </div>
            <h1 className="text-xl font-bold text-indigo-700">Agapay</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-9 h-9 rounded-xl border border-indigo-100 hover:bg-indigo-50 text-gray-600 flex items-center justify-center"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>
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
