import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Package, AlertTriangle, Upload, User, ChevronDown } from 'lucide-react';

const navItems = [
  { path: '/data-encoder/dashboard', label: 'Home', icon: Home },
  { path: '/data-encoder/intervention-records', label: 'Intervention Records', icon: FileText },
  { path: '/data-encoder/inventory', label: 'Inventory', icon: Package },
  { path: '/data-encoder/crisis-reports', label: 'Crisis Reports', icon: AlertTriangle },
];

function formatMetricValue(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '0';
  }
  return String(value);
}

export function DataEncoderSidebar({ user, metrics }) {
  const location = useLocation();

  const profileInitial = user?.name?.charAt(0)?.toUpperCase() || 'E';
  const profileName = user?.id ? `Encoder_${String(user.id).padStart(2, '0')}` : user?.name || 'Encoder';

  return (
    <aside className="w-72 bg-white/95 border-r border-indigo-100 flex flex-col h-full flex-shrink-0">
      <div className="px-5 py-4 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold">
            A
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-700 leading-tight">Agapay</p>
            <p className="text-xs text-gray-500 leading-tight">Data Encoder Console</p>
          </div>
        </div>
      </div>

      <nav className="px-3 pb-3 flex-1 overflow-y-auto">
        <p className="px-3 pt-2 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
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
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-indigo-50'
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
