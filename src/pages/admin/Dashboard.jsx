import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/AdminLayout';
import { Search, Filter, Plus, Download, Upload, Package, ArrowRight, FileText, X, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OFFICIAL_BARANGAYS } from '../../constants/barangays.js';
import { DA_INTERVENTIONS, MLGU_INTERVENTIONS } from '../../constants/interventions.js';

import { API_URL } from '../../config/api.js';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalBeneficiaries: 0,
    pendingRSBSA: 0,
    activeInterventions: 0,
    activeCrisisReports: 0
  });
  
  // Filters
  const [filters, setFilters] = useState({
    barangay: 'All',
    interventionType: 'All',
    status: 'All'
  });
  const [showFilters, setShowFilters] = useState(false);

  const userName = user?.name || 'Municipal Agriculturist';

  useEffect(() => {
    fetchBeneficiaries();
  }, [searchQuery, filters]);

  const fetchBeneficiaries = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Build query parameters for filtering
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filters.barangay !== 'All') params.append('barangay', filters.barangay);
      if (filters.interventionType !== 'All') params.append('interventionType', filters.interventionType);
      if (filters.status !== 'All') params.append('status', filters.status);
      
      const url = params.toString() 
        ? `${API_URL}/admin/beneficiaries?${params}`
        : `${API_URL}/admin/beneficiaries`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch beneficiaries');
      }

      const data = await response.json();
      setBeneficiaries(data.beneficiaries);
      setError(null);
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      setError('Failed to load beneficiaries');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleBeneficiaryClick = (beneficiary) => {
    console.log('Clicked beneficiary:', beneficiary);
    // TODO: Navigate to beneficiary details page
  };

  const clearFilters = () => {
    setFilters({
      barangay: 'All',
      interventionType: 'All',
      status: 'All'
    });
    setSearchQuery('');
  };

  const hasActiveFilters = filters.barangay !== 'All' || filters.interventionType !== 'All' || filters.status !== 'All' || searchQuery;

  const quickActions = [
    { label: 'Add User', icon: Plus, onClick: () => navigate('/admin/users') },
    { label: 'Export List', icon: Download, onClick: () => console.log('Export') },
    { label: 'Interventions', icon: ArrowRight, onClick: () => navigate('/admin/da-interventions') },
    { label: 'Upload Excel', icon: Upload, onClick: () => console.log('Upload Excel') },
    { label: 'Inventory', icon: Package, onClick: () => console.log('Inventory') },
    { label: 'Audit Trail', icon: FileText, onClick: () => navigate('/admin/audit-trail') },
  ];

  return (
    <AdminLayout 
      showHeader={false}
    >
      {/* Top Bar with User Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-agapay-purple rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{userName.charAt(0)}</span>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-agapay-purple rounded-full font-semibold text-gray-800 hover:bg-agapay-lavender transition-all duration-200 shadow-sm text-sm"
            >
              <Icon size={16} />
              <span>{action.label}</span>
            </button>
          );
        })}
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
                onChange={(e) => setFilters(prev => ({ ...prev, barangay: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
              >
                <option value="All">All Barangays</option>
                {OFFICIAL_BARANGAYS.map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
            </div>

            {/* Intervention Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Intervention Type</label>
              <select
                value={filters.interventionType}
                onChange={(e) => setFilters(prev => ({ ...prev, interventionType: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
              >
                <option value="All">All Types</option>
                <option value="DA">DA Interventions</option>
                <option value="LGU">MLGU Interventions</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Claimed">Claimed</option>
                <option value="Unclaimed">Unclaimed</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Beneficiary Table Card */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading beneficiaries...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Beneficiary Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Card Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-agapay-purple/10 rounded-lg flex items-center justify-center">
                <Filter size={20} className="text-agapay-purple" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">All Beneficiaries</h2>
            </div>

            {/* Table */}
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
                      Intervention
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {beneficiaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No beneficiaries found
                      </td>
                    </tr>
                  ) : (
                    beneficiaries.map((beneficiary) => (
                      <tr
                        key={beneficiary.id}
                        onClick={() => handleBeneficiaryClick(beneficiary)}
                        className="hover:bg-agapay-lavender cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{beneficiary.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-600">{beneficiary.rsbsaNumber}</div>
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
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            beneficiary.status === 'Claimed' 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {beneficiary.status || 'Unclaimed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
