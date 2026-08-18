import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AgritechLayout } from '../../components/agritech/AgritechLayout';
import { MetricsCard } from '../../components/agritech/MetricsCard';
import { QuickActions } from '../../components/agritech/QuickActions';
import { Search, UserCheck, FileText, AlertTriangle, Filter, X, SlidersHorizontal } from 'lucide-react';
import { OFFICIAL_BARANGAYS } from '../../constants/barangays.js';

const API_URL = '/api';

const STATUS_FILTERS = ['All', 'Claimed', 'Unclaimed', 'Pending'];

function AgriculturalTechnologistDashboard() {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ barangay: 'All', intervention: 'All', status: 'All' });
  const [availableFilters, setAvailableFilters] = useState({ barangays: [], interventions: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBeneficiaries();
  }, []);

  const fetchBeneficiaries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/beneficiaries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch beneficiaries');

      const data = await response.json();
      setBeneficiaries(data.beneficiaries);
      setAvailableFilters({ barangays: data.filters.barangays, interventions: data.filters.interventions });
      setError(null);
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      setError('Failed to load beneficiaries');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(
    () => [
      {
        icon: UserCheck,
        label: 'Pending Validation',
        value: beneficiaries.filter((b) => b.status === 'Pending' || !b.rsbsaNumber).length,
        tone: 'amber',
      },
      {
        icon: FileText,
        label: 'Active Interventions',
        value: beneficiaries.filter((b) => b.status === 'Unclaimed').length,
        tone: 'purple',
      },
      {
        icon: AlertTriangle,
        label: 'Reports Filed This Month',
        value: beneficiaries.filter((b) => b.status === 'Unclaimed').length > 0 ? 1 : 0,
        tone: 'red',
      },
    ],
    [beneficiaries]
  );

  const filteredBeneficiaries = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return beneficiaries.filter((beneficiary) => {
      // Search
      const haystack = `${beneficiary.name} ${beneficiary.rsbsaNumber || ''} ${beneficiary.barangay || ''}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;

      // Filters
      if (filters.barangay !== 'All' && beneficiary.barangay !== filters.barangay) return false;
      if (filters.intervention !== 'All' && beneficiary.intervention !== filters.intervention) return false;
      if (filters.status !== 'All' && beneficiary.status !== filters.status) return false;

      return true;
    });
  }, [beneficiaries, searchQuery, filters]);

  const hasActiveFilters = filters.barangay !== 'All' || filters.intervention !== 'All' || filters.status !== 'All';

  const clearFilters = () => {
    setFilters({ barangay: 'All', intervention: 'All', status: 'All' });
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AgritechLayout>
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Hello, Agritech</h1>
        <p className="text-base bg-gradient-to-r from-agapay-purple to-agapay-purpleDark bg-clip-text text-transparent font-semibold">
          Select an action to get started:
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <QuickActions />
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative bg-gradient-to-r from-agapay-purple to-agapay-purpleDark rounded-full p-1">
          <div className="flex items-center">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-white" size={18} />
            <input
              type="text"
              placeholder="Search beneficiary by name, RSBSA No., or barangay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-28 py-3 bg-transparent text-white placeholder-white/70 text-base focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={`absolute right-1.5 px-5 py-1.5 rounded-full font-semibold hover:bg-gray-100 transition-colors text-sm flex items-center gap-1.5 ${
                hasActiveFilters ? 'bg-agapay-lavender text-agapay-purple' : 'bg-white text-gray-800'
              }`}
            >
              <Filter size={14} />
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-agapay-purple" />
              Filter Beneficiaries
            </h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Barangay */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Barangay</label>
              <select
                value={filters.barangay}
                onChange={(e) => handleFilterChange('barangay', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
              >
                <option value="All">All Barangays</option>
                {OFFICIAL_BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
            </div>

            {/* Intervention */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Intervention</label>
              <select
                value={filters.intervention}
                onChange={(e) => handleFilterChange('intervention', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
              >
                <option value="All">All Interventions</option>
                {availableFilters.interventions.map((intervention) => (
                  <option key={intervention} value={intervention}>{intervention}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>{status === 'All' ? 'All Statuses' : status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {metrics.map((metric) => (
          <MetricsCard key={metric.label} {...metric} />
        ))}
      </div>

      {/* All Beneficiaries Table */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">All Beneficiaries</h2>
        <p className="text-sm text-gray-500 mt-1">
          Showing <span className="font-semibold">{filteredBeneficiaries.length}</span> beneficiary{filteredBeneficiaries.length !== 1 ? 'ies' : 'y'}
          {hasActiveFilters && ' (filtered)'}
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading beneficiaries...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">RSBSA Number</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Barangay</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Household</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Intervention</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBeneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No beneficiaries found
                    </td>
                  </tr>
                ) : (
                  filteredBeneficiaries.map((beneficiary) => (
                    <tr key={beneficiary.id} className="hover:bg-agapay-lavender transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{beneficiary.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {beneficiary.rsbsaNumber ? (
                          <div className="text-gray-600">{beneficiary.rsbsaNumber}</div>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                            (pending)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-600">{beneficiary.barangay}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-600">{beneficiary.household}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-agapay-lavender text-agapay-purple">
                          {beneficiary.intervention}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                          beneficiary.status === 'Claimed'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : beneficiary.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                        }`}>
                          {beneficiary.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AgritechLayout>
  );
}

export default AgriculturalTechnologistDashboard;
