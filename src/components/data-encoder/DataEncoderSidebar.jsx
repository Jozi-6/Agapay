import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Package, ChevronDown } from 'lucide-react';

const navItems = [
  { path: '/data-encoder/dashboard', label: 'Home', icon: Home },
  { path: '/data-encoder/beneficiary-profiles', label: 'Beneficiary Profiles', icon: Users },
  { path: '/data-encoder/intervention-records', label: 'Intervention Records', icon: FileText },
  { path: '/data-encoder/inventory', label: 'Inventory', icon: Package }
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
    <aside className="w-72 bg-white border-r border-indigo-100 flex flex-col h-full flex-shrink-0">
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

      <div className="px-4 pt-4 pb-3">
        <button
          type="button"
          className="w-full rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-3 text-left flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center">
            {profileInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{profileName}</p>
            <p className="text-xs text-gray-500 truncate">Data Encoder</p>
          </div>
          <ChevronDown size={16} className="text-gray-500" />
        </button>
      </div>

      <nav className="px-3 pb-3 flex-1 overflow-y-auto">
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

      <div className="m-3 mt-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-4 shadow-lg">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <p className="text-3xl font-extrabold leading-none">{formatMetricValue(metrics?.encodedThisMonth)}</p>
            <p className="text-xs mt-1 text-indigo-100">Encoded This Month</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold leading-none">{formatMetricValue(metrics?.recordsToBeUpdated)}</p>
            <p className="text-xs mt-1 text-indigo-100">Records to be Updated</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold leading-none">{formatMetricValue(metrics?.lowStockItems)}</p>
            <p className="text-xs mt-1 text-indigo-100">Low Stock Items</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
