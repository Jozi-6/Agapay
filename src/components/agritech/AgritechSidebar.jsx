import { Link, useLocation } from 'react-router-dom';
import { Home, UserCheck, FileText, Landmark, AlertTriangle, ShieldCheck } from 'lucide-react';

const ROOT = '/agricultural-technologist';

const navItems = [
  { path: `${ROOT}/dashboard`, label: 'Home', icon: Home },
  { path: `${ROOT}/beneficiary-validation`, label: 'Beneficiary Validation', icon: UserCheck, badge: 4 },
  { path: `${ROOT}/da-intervention`, label: 'DA Intervention', icon: FileText },
  { path: `${ROOT}/lgu-intervention`, label: 'LGU Intervention', icon: Landmark },
  { path: `${ROOT}/disaster-reports`, label: 'Disaster Reports', icon: AlertTriangle },
];

const quickMetrics = [
  { label: 'Pending Validation', value: 4 },
  { label: 'Active Interventions', value: 2 },
  { label: 'Reports Filed This Month', value: 1 },
];

export function AgritechSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-agapay-purple rounded-xl flex items-center justify-center text-white font-black text-lg">
            A
          </div>
          <div>
            <h1 className="text-xl font-bold text-agapay-purple leading-tight">AGAPAY</h1>
            <p className="text-[11px] text-gray-500 leading-tight">Agricultural Tech</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="px-3 pt-1 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Menu
        </p>
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
                  <span className="font-medium text-sm flex-1 whitespace-nowrap">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span
                      className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                        isActive
                          ? 'bg-white text-agapay-purple'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quick Metrics */}
      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <div className="bg-agapay-lavender rounded-xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Metrics
          </p>
          <ul className="space-y-2.5">
            {quickMetrics.map((metric) => (
              <li key={metric.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-600">{metric.label}</span>
                <span className="min-w-[24px] h-6 px-1.5 rounded-md bg-white border border-gray-200 text-xs font-bold text-agapay-purple flex items-center justify-center shadow-sm">
                  {metric.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Role Footer */}
      <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-2">
        <ShieldCheck size={14} className="text-agapay-purple flex-shrink-0" />
        <p className="text-[11px] text-gray-500">Agricultural Technologist</p>
      </div>
    </aside>
  );
}
