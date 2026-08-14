import { useAuth } from '../context/AuthContext';
import { AdminSidebar } from './AdminSidebar';
import { LogOut, User, Bell } from 'lucide-react';

export function AdminLayout({ children, title, description, showHeader = true }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-agapay-lavender overflow-hidden">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header - Optional */}
        {showHeader && (
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-800 truncate">{title}</h1>
              {description && <p className="text-sm text-gray-500 truncate">{description}</p>}
            </div>
            
            <div className="flex items-center gap-4 ml-4 flex-shrink-0">
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell size={20} />
              </button>
              
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-agapay-purple rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">Municipal Agriculturist</p>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
