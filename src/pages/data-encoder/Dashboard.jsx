import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Upload,
  UserPlus,
  AlertTriangle,
  Calendar,
  FileWarning,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';
import { DataEncoderExcelImportModal } from '../../components/data-encoder/DataEncoderExcelImportModal';
import { AddBeneficiaryModal } from '../../components/AddBeneficiaryModal';

const API_URL = '/api';

function formatShortDate(dateValue) {
  if (!dateValue) {
    return 'N/A';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getGreetingName(userName) {
  if (!userName) {
    return 'Encoder';
  }
  return userName.split(' ')[0];
}

function DataEncoderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState({
    stats: {
      encodedThisMonth: 0,
      recordsToBeUpdated: 0,
      lowStockItems: 0
    },
    pendingQueue: []
  });
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);

  const greetingName = useMemo(() => getGreetingName(user?.name), [user?.name]);

  const fetchDashboardData = async () => {
    try {
      setLoadingDashboard(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/dashboard/data-encoder`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load Data Encoder dashboard');
      }

      setDashboardData(data);
      setDashboardError('');
    } catch (error) {
      console.error('Dashboard loading error:', error);
      setDashboardError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/beneficiaries/search?q=${encodeURIComponent(query)}&limit=12`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Search failed');
        }

        setSearchResults(data.beneficiaries || []);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const actionButtons = [
    {
      label: 'Upload Excel',
      icon: Upload,
      onClick: () => setShowExcelModal(true)
    },
    {
      label: 'Add Beneficiary',
      icon: UserPlus,
      onClick: () => setShowAddBeneficiaryModal(true)
    },
    {
      label: 'Disaster Reports',
      icon: AlertTriangle,
      onClick: () => navigate('/data-encoder/disaster-reports')
    }
  ];

  return (
    <DataEncoderLayout metrics={dashboardData?.stats}>
      <div
        className="rounded-3xl border border-indigo-100 bg-[#f7f7ff] p-4 md:p-6"
        style={{
          backgroundImage:
            'linear-gradient(rgba(126, 134, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(126, 134, 255, 0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
      >
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900">Hello, {greetingName}</h1>
            <p className="text-sm md:text-base text-indigo-700 font-semibold mt-1">Select an action to get started.</p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {actionButtons.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-indigo-200 shadow-sm text-gray-800 font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <Icon size={16} />
                  <span className="text-sm">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative mb-6">
          <div className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 p-[3px] shadow-md">
            <div className="rounded-full bg-white flex items-center gap-3 px-4 py-2.5">
              <Search size={18} className="text-indigo-500 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search beneficiary by name, RSBSA No., or barangay..."
                className="w-full bg-transparent outline-none text-sm md:text-base"
              />
              {searchLoading && <Loader2 size={16} className="animate-spin text-indigo-500" />}
            </div>
          </div>

          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-indigo-100 bg-white shadow-xl overflow-hidden z-20">
              {searchResults.length === 0 && !searchLoading ? (
                <p className="px-4 py-3 text-sm text-gray-500">No matching records found.</p>
              ) : (
                <ul className="max-h-72 overflow-auto">
                  {searchResults.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/data-encoder/beneficiary-profiles?query=${encodeURIComponent(result.name)}`)}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors"
                      >
                        <p className="font-semibold text-gray-900 text-sm">{result.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {result.rsbsaNumber || 'No RSBSA'} • {result.barangay || 'No barangay'}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {dashboardError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {dashboardError}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-indigo-100 flex items-center gap-2">
            <FileWarning size={18} className="text-indigo-600" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">Pending Encoding Queue</h2>
          </div>

          {loadingDashboard ? (
            <div className="p-8 text-gray-500 text-sm">Loading queue...</div>
          ) : dashboardData.pendingQueue?.length === 0 ? (
            <div className="p-8 text-gray-500 text-sm">No pending records found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-indigo-50/60">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Name</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Source</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Issue</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboardData.pendingQueue.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-indigo-50/50 cursor-pointer"
                      onClick={() => navigate(`/data-encoder/beneficiary-profiles?query=${encodeURIComponent(item.name)}`)}
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{item.source}</td>
                      <td className="px-5 py-3 text-sm text-amber-700">{item.issue}</td>
                      <td className="px-5 py-3 text-sm text-gray-500 inline-flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatShortDate(item.dateAdded)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DataEncoderExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onImported={() => {
          setShowExcelModal(false);
          fetchDashboardData();
        }}
      />

      <AddBeneficiaryModal
        isOpen={showAddBeneficiaryModal}
        onClose={() => setShowAddBeneficiaryModal(false)}
        onSuccess={fetchDashboardData}
        interventionsEndpoint={`${API_URL}/data-encoder/interventions-list?type=LGU`}
        submitEndpoint={`${API_URL}/data-encoder/add-beneficiary`}
        title="Add Beneficiary Record"
      />
    </DataEncoderLayout>
  );
}

export default DataEncoderDashboard;
