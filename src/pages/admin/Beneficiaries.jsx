import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Search, Filter, Download, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';

import { API_URL } from '../../config/api.js';

const initialFilters = {
  search: '',
  barangay: 'All',
  interventionType: 'All',
  status: 'All'
};

function Beneficiaries() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 25 });

  const barangayOptions = useMemo(() => [
    'All',
    'Bacarra', 'Bacnotan', 'Bangar', 'Banna', 'Burgos', 'Cabugao', 'Caoayan', 'City of Vigan', 'Currimao', 'Dingras', 'Dumalneg', 'Laoag City', 'Pagudpud', 'Paoay', 'Pasuquin', 'Piddig', 'San Nicolas', 'Sarrat', 'Solsona', 'Vintar'
  ], []);

  const fetchBeneficiaries = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.barangay !== 'All') params.set('barangay', filters.barangay);
      if (filters.interventionType !== 'All') params.set('interventionType', filters.interventionType);
      if (filters.status !== 'All') params.set('status', filters.status);

      const response = await fetch(`${API_URL}/admin/beneficiaries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error('Unable to load beneficiary records');
      }

      const data = await response.json();
      setBeneficiaries(data.beneficiaries || []);
      setPagination(data.pagination || { total: 0, totalPages: 1, page, limit });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load beneficiary records.');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [page, filters.barangay, filters.interventionType, filters.status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBeneficiaries();
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  return (
    <AdminLayout
      title="Beneficiary Records"
      description="Manage all beneficiary profiles and intervention records"
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <form className="flex-1" onSubmit={handleSearchSubmit}>
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Search by name, RSBSA, or barangay"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent"
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchBeneficiaries()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <RefreshCcw size={16} />
                Refresh
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-agapay-purple rounded-lg hover:bg-agapay-purpleDark"
              >
                <Download size={16} />
                Export
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <select
              value={filters.barangay}
              onChange={(e) => setFilters((prev) => ({ ...prev, barangay: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
            >
              {barangayOptions.map((barangay) => (
                <option key={barangay} value={barangay}>{barangay}</option>
              ))}
            </select>

            <select
              value={filters.interventionType}
              onChange={(e) => setFilters((prev) => ({ ...prev, interventionType: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
            >
              <option value="All">All Programs</option>
              <option value="DA">DA</option>
              <option value="LGU">MLGU</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-agapay-purple"
            >
              <option value="All">All Status</option>
              <option value="Claimed">Claimed</option>
              <option value="Unclaimed">Unclaimed</option>
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50"
            >
              <Filter size={16} />
              Clear Filters
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">All Beneficiaries</h2>
              <p className="text-sm text-gray-500">{pagination.total} total records</p>
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Beneficiary</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Barangay</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">RSBSA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-500">
                      Loading beneficiary records...
                    </td>
                  </tr>
                ) : beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  beneficiaries.map((beneficiary) => (
                    <tr key={beneficiary.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-gray-900">{beneficiary.name}</div>
                        <div className="text-xs text-gray-500">{beneficiary.address || 'No address'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.barangay || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.intervention_type || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.rsbsaNumber || beneficiary.rsbsa_number || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${beneficiary.status === 'Claimed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {beneficiary.status || 'Unclaimed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.quantityReceived ?? beneficiary.quantity_received ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages || 1}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(pagination.totalPages || prev, prev + 1))}
                disabled={page >= (pagination.totalPages || 1) || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Beneficiaries;
