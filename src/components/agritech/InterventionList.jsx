import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';

const API_URL = '/api';

export function InterventionList({ type }) {
  const isDA = type === 'DA';
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInterventions();
  }, [type]);

  const fetchInterventions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/interventions?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch interventions');

      const data = await response.json();
      setBeneficiaries(data.beneficiaries);
      setError(null);
    } catch (err) {
      console.error('Error fetching interventions:', err);
      setError('Failed to load interventions');
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

  return (
    <div>
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

      {/* Count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-800">{filteredBeneficiaries.length}</span> {isDA ? 'DA' : 'LGU'} intervention beneficiary{filteredBeneficiaries.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading interventions...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : filteredBeneficiaries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-600">No {isDA ? 'DA' : 'LGU'} intervention beneficiaries found.</p>
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
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">{isDA ? 'DA' : 'LGU'} Intervention</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Household</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBeneficiaries.map((beneficiary) => (
                  <tr key={beneficiary.id} className="hover:bg-agapay-lavender transition-colors">
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
                      <div className="text-gray-600">{beneficiary.household}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        beneficiary.status === 'Claimed'
                          ? 'bg-green-100 text-green-700 border border-green-200'
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
    </div>
  );
}
