import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, UserPlus, AlertTriangle, Users, History, BarChart3, Package, Settings } from 'lucide-react';
import { AgapayLogoText } from './AgapayLogo';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { path: '/admin/users', label: 'User Management', icon: Users },
  { path: '/admin/beneficiaries', label: 'Beneficiary Records', icon: FileText },
  { path: '/admin/da-interventions', label: 'DA Interventions', icon: FileText },
  { path: '/admin/lgu-interventions', label: 'MLGU Interventions', icon: FileText },
  { path: '/admin/inventory', label: 'Inventory', icon: Package },
  { path: '/admin/crisis-reports', label: 'Crisis Reports', icon: AlertTriangle },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/audit-trail', label: 'Audit Trail', icon: History },
];

export function AdminSidebar({ onMobile = false, onClose }) {
  const location = useLocation();

  const handleNavClick = () => {
    if (onMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside className="w-72 bg-white/95 border-r border-indigo-100 flex flex-col flex-shrink-0 h-full">
      <div className="border-b border-indigo-100 px-5 py-4 flex-shrink-0">
        <AgapayLogoText />
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Menu
        </p>
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-in-out ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-indigo-50 hover:text-gray-900'
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
    </aside>
  );
}
