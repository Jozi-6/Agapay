import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { AddBeneficiaryModal } from '../../components/AddBeneficiaryModal';
import { Search, Filter, X, Plus } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

function LGUInterventions() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    rsbsa: '',
    barangay: '',
    intervention: ''
  });
  const [availableFilters, setAvailableFilters] = useState({
    barangays: [],
    interventions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchLGUInterventions();
  }, [filters]);

  const fetchLGUInterventions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.rsbsa) params.append('rsbsa', filters.rsbsa);
      if (filters.barangay) params.append('barangay', filters.barangay);
      if (filters.intervention) params.append('intervention', filters.intervention);
      
      const url = `${API_URL}/admin/lgu-interventions${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LGU interventions');
      }

      const data = await response.json();
      setBeneficiaries(data.beneficiaries);
      setAvailableFilters(data.filters);
      setError(null);
    } catch (err) {
      console.error('Error fetching LGU interventions:', err);
      setError('Failed to load LGU interventions');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      rsbsa: '',
      barangay: '',
      intervention: ''
    });
  };

  const hasActiveFilters = filters.search || filters.rsbsa || filters.barangay || filters.intervention;

  return (
    <AdminLayout 
      title="LGU Interventions"
      description="Local Government Unit intervention programs"
    >
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-agapay-purple to-agapay-blue text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          Add Beneficiary
        </button>
        
      {/* Filters Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Filter size={20} className="text-agapay-purple" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search by Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Enter beneficiary name..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent"
              />
            </div>
          </div>

          {/* Filter by RSBSA Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RSBSA Number
            </label>
            <input
              type="text"
              placeholder="Enter RSBSA number..."
              value={filters.rsbsa}
              onChange={(e) => handleFilterChange('rsbsa', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent"
            />
          </div>

          {/* Filter by Barangay */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Barangay
            </label>
            <select
              value={filters.barangay}
              onChange={(e) => handleFilterChange('barangay', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
            >
              <option value="">All Barangays</option>
              {availableFilters.barangays.map(barangay => (
                <option key={barangay} value={barangay}>{barangay}</option>
              ))}
            </select>
          </div>

          {/* Filter by LGU Intervention */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LGU Intervention
            </label>
            <select
              value={filters.intervention}
              onChange={(e) => handleFilterChange('intervention', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
            >
              <option value="">All LGU Interventions</option>
              {availableFilters.interventions.map(intervention => (
                <option key={intervention} value={intervention}>{intervention}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Result Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-800">{beneficiaries.length}</span> LGU intervention beneficiaries
          {hasActiveFilters && ' (filtered)'}
        </p>
      </div>

      {/* Beneficiary Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading LGU interventions...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <Filter size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No LGU intervention beneficiaries found.</p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-agapay-purple text-white rounded-lg hover:bg-agapay-purpleDark transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    RSBSA Number
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Barangay
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    LGU Intervention
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Household
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {beneficiaries.map((beneficiary) => (
                  <tr key={beneficiary.id} className="hover:bg-agapay-lavender transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{beneficiary.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{beneficiary.rsbsaNumber || 'Pending'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{beneficiary.barangay}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-agapay-lavender text-agapay-purple">
                        {beneficiary.intervention}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{beneficiary.household}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        beneficiary.status === 'Claimed' 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : beneficiary.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {beneficiary.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600 text-sm">
                        {beneficiary.date ? new Date(beneficiary.date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Beneficiary Modal */}
      <AddBeneficiaryModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => fetchLGUInterventions()}
      />
    </AdminLayout>
  );
}

export default LGUInterventions;
