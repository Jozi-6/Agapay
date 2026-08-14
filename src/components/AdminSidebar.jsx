import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, UserPlus, AlertTriangle, Users, History, BarChart3 } from 'lucide-react';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { path: '/admin/da-interventions', label: 'DA Intervention', icon: FileText },
  { path: '/admin/lgu-interventions', label: 'LGU Intervention', icon: FileText },
  { path: '/admin/newly-registered', label: 'Newly Registered', icon: UserPlus },
  { path: '/admin/disaster-reports', label: 'Crisis Reports', icon: AlertTriangle },
  { path: '/admin/users', label: 'User Management', icon: Users },
  { path: '/admin/audit-trail', label: 'Audit Trail', icon: History },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200 flex-shrink-0">
        <h1 className="text-2xl font-bold text-agapay-purple">AGAPAY</h1>
        <p className="text-xs text-gray-500 mt-1 leading-tight">Agricultural Management System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out ${
                    isActive
                      ? 'bg-agapay-purple text-white shadow-sm'
                      : 'text-gray-700 hover:bg-agapay-lavender hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
