import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Home, FileText, Landmark, AlertTriangle, ShieldCheck, Package, BarChart3, User } from 'lucide-react';

const ROOT = '/agricultural-technologist';

const navItems = [
  { path: `${ROOT}/dashboard`, label: 'Home', icon: Home },
  { path: `${ROOT}/da-intervention`, label: 'DA Interventions', icon: FileText },
  { path: `${ROOT}/lgu-intervention`, label: 'MLGU Interventions', icon: Landmark },
  { path: `${ROOT}/crisis-reports`, label: 'Crisis Reports', icon: AlertTriangle }
];

const API_URL = '/api';

export function AgritechSidebar() {
  const location = useLocation();
  const [activeInterventions, setActiveInterventions] = useState(0);
  const [reportsThisMonth, setReportsThisMonth] = useState(0);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch interventions (both DA and LGU)
      const [daResponse, lguResponse] = await Promise.all([
        fetch(`${API_URL}/agritech/interventions?type=DA`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_URL}/agritech/interventions?type=LGU`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
      ]);
      
      let totalInterventions = 0;
      if (daResponse.ok) {
        const data = await daResponse.json();
        totalInterventions += (data.beneficiaries?.length || data.interventions?.length || 0);
      }
      if (lguResponse.ok) {
        const data = await lguResponse.json();
        totalInterventions += (data.beneficiaries?.length || data.interventions?.length || 0);
      }
      setActiveInterventions(totalInterventions);

      // Fetch reports this month
      const reportsResponse = await fetch(`${API_URL}/agritech/crisis-reports`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (reportsResponse.ok) {
        const data = await reportsResponse.json();
        const now = new Date();
        const thisMonth = data.reports?.filter(report => {
          const reportDate = new Date(report.createdAt);
          return reportDate.getMonth() === now.getMonth() && 
                 reportDate.getFullYear() === now.getFullYear();
        }) || [];
        setReportsThisMonth(thisMonth.length);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  return (
    <aside className="w-72 bg-white/95 border-r border-indigo-100 flex flex-col flex-shrink-0 h-full">
      <div className="border-b border-indigo-100 px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center font-black text-lg">
            A
          </div>
          <div>
            <p className="text-lg font-bold text-indigo-700 leading-tight">Agapay</p>
            <p className="text-[11px] text-gray-500 leading-tight">Agricultural Technologist</p>
          </div>
        </div>
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-in-out ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-indigo-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="font-medium text-sm flex-1 whitespace-nowrap">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
