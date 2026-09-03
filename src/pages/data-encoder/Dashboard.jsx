import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Upload,
  UserPlus,
  AlertTriangle,
  Edit,
  Filter,
  ChevronDown,
  Loader2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';
import { DataEncoderExcelImportModal } from '../../components/data-encoder/DataEncoderExcelImportModal';
import { AddBeneficiaryModal } from '../../components/AddBeneficiaryModal';
import { UpdateBeneficiaryModal } from '../../components/data-encoder/UpdateBeneficiaryModal';
import { OFFICIAL_BARANGAYS } from '../../constants/barangays.js';
import { DA_INTERVENTIONS, MLGU_INTERVENTIONS } from '../../constants/interventions.js';

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
    return 'Data Encoder';
  }
  return userName.split(' ')[0];
}

function DataEncoderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    source: 'All',
    barangay: 'All',
    status: 'All',
    intervention: 'All'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0
  });

  // Modals
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);

  const greetingName = useMemo(() => getGreetingName(user?.name), [user?.name]);

  const fetchBeneficiaries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        barangay: filters.barangay,
        interventionType: filters.source === 'All' ? 'All' : filters.source,
        status: filters.status
      });

      const response = await fetch(`${API_URL}/data-encoder/beneficiaries?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load beneficiaries');
      }

      setBeneficiaries(data.beneficiaries || []);
      setPagination(data.pagination || pagination);
      setError(null);
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      setError('Failed to load beneficiaries');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [pagination.page, searchQuery, filters]);

  const handleUpdateBeneficiary = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setShowUpdateModal(true);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setFilters({
      source: 'All',
      barangay: 'All',
      status: 'All',
      intervention: 'All'
    });
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = filters.source !== 'All' || filters.barangay !== 'All' || 
                          filters.status !== 'All' || filters.intervention !== 'All' || searchQuery;

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
      label: 'Crisis Reports',
      icon: AlertTriangle,
      onClick: () => navigate('/data-encoder/crisis-reports')
    }
  ];

  return (
    <DataEncoderLayout>
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
            <p className="text-sm md:text-base text-indigo-700 font-semibold mt-1">Data Encoder Console - Manage beneficiary records</p>
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

        {/* Search Bar */}
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
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold transition-colors text-sm ${
                  hasActiveFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter size={14} />
                Filters
                {hasActiveFilters && <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>}
              </button>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Filter Beneficiaries</h2>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Sources</option>
                  <option value="DA">DA</option>
                  <option value="LGU">MLGU</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Barangay</label>
                <select
                  value={filters.barangay}
                  onChange={(e) => setFilters(prev => ({ ...prev, barangay: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Barangays</option>
                  {OFFICIAL_BARANGAYS.map(barangay => (
                    <option key={barangay} value={barangay}>{barangay}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Status</option>
                  <option value="Claimed">Claimed</option>
                  <option value="Unclaimed">Unclaimed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Intervention</label>
                <select
                  value={filters.intervention}
                  onChange={(e) => setFilters(prev => ({ ...prev, intervention: e.target.value, page: 1 }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="All">All Interventions</option>
                  {[...DA_INTERVENTIONS, ...MLGU_INTERVENTIONS].map((intervention, index) => (
                    <option key={`${intervention}-${index}`} value={intervention}>{intervention}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Beneficiary Table */}
        <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">Beneficiary Records</h2>
            <span className="text-sm text-gray-500">
              {pagination.total} total records
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Loading beneficiaries...
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No beneficiaries found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-indigo-50/60 sticky top-0">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Name</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">RSBSA No.</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Barangay</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Source</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Intervention</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Claim Status</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Qty Received</th>
                    <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {beneficiaries.map((beneficiary) => (
                    <tr key={beneficiary.id} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900 text-sm">{beneficiary.name}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {beneficiary.rsbsaNumber}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {beneficiary.barangay}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          beneficiary.intervention_type === 'DA' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {beneficiary.intervention_type === 'DA' ? 'DA' : 'MLGU'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {beneficiary.intervention}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          beneficiary.status === 'Claimed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {beneficiary.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {beneficiary.quantityReceived || '-'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleUpdateBeneficiary(beneficiary)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
                        >
                          <Edit size={14} />
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-5 py-4 border-t border-indigo-100 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="text-sm text-gray-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DataEncoderExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onImported={() => {
          setShowExcelModal(false);
          fetchBeneficiaries();
        }}
      />

      <AddBeneficiaryModal
        isOpen={showAddBeneficiaryModal}
        onClose={() => setShowAddBeneficiaryModal(false)}
        onSuccess={fetchBeneficiaries}
        interventionsEndpoint={`${API_URL}/data-encoder/interventions-list?type=LGU`}
        submitEndpoint={`${API_URL}/data-encoder/add-beneficiary`}
        title="Add Beneficiary Record"
      />

      <UpdateBeneficiaryModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          setSelectedBeneficiary(null);
        }}
        beneficiary={selectedBeneficiary}
        onSuccess={fetchBeneficiaries}
      />
    </DataEncoderLayout>
  );
}

export default DataEncoderDashboard;
