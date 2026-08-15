import { useState, useEffect, useMemo } from 'react';
import { AgritechLayout } from '../../components/agritech/AgritechLayout';
import { Search, Check, X, UserCheck } from 'lucide-react';

const API_URL = '/api';

function BeneficiaryValidation() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBeneficiaries();
  }, []);

  const fetchBeneficiaries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/beneficiaries?pending=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch validation queue');

      const data = await response.json();
      setBeneficiaries(data.beneficiaries);
      setError(null);
    } catch (err) {
      console.error('Error fetching validation queue:', err);
      setError('Failed to load validation queue');
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredBeneficiaries = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return beneficiaries;
    return beneficiaries.filter((beneficiary) =>
      `${beneficiary.name} ${beneficiary.rsbsaNumber || ''} ${beneficiary.barangay || ''}`
        .toLowerCase()
        .includes(query)
    );
  }, [beneficiaries, searchQuery]);

  const handleValidate = async (beneficiaryId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/beneficiaries/${beneficiaryId}/validate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to validate beneficiary');

      setBeneficiaries((prev) => prev.filter((beneficiary) => beneficiary.id !== beneficiaryId));
    } catch (err) {
      console.error('Error validating beneficiary:', err);
    }
  };

  const handleReject = async (beneficiaryId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/beneficiaries/${beneficiaryId}/reject`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to reject beneficiary');

      setBeneficiaries((prev) => prev.filter((beneficiary) => beneficiary.id !== beneficiaryId));
    } catch (err) {
      console.error('Error rejecting beneficiary:', err);
    }
  };

  return (
    <AgritechLayout
      title="Beneficiary Validation"
      description="Review and validate pending beneficiary records"
    >
      {/* Search */}
      <div className="mb-6">
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
              className="absolute right-1.5 px-5 py-1.5 bg-white text-gray-800 rounded-full font-semibold hover:bg-gray-100 transition-colors text-sm"
            >
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Queue Summary */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">
          Pending Validation ({filteredBeneficiaries.length})
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Beneficiaries awaiting RSBSA / record validation by the Agricultural Technologist.
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading validation queue...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : filteredBeneficiaries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <UserCheck size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No pending beneficiaries found.</p>
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Farm Location</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Household</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBeneficiaries.map((beneficiary) => (
                  <tr key={beneficiary.id} className="hover:bg-agapay-lavender transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{beneficiary.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={beneficiary.rsbsaNumber ? 'text-gray-600' : 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200'}>
                        {beneficiary.rsbsaNumber || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{beneficiary.barangay}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{beneficiary.farmLocation || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{beneficiary.household || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleValidate(beneficiary.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Check size={14} />
                          Validate
                        </button>
                        <button
                          onClick={() => handleReject(beneficiary.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AgritechLayout>
  );
}

export default BeneficiaryValidation;
