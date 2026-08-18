import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Loader2 } from 'lucide-react';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';
import { AddBeneficiaryModal } from '../../components/AddBeneficiaryModal';

const API_URL = '/api';

function BeneficiaryProfiles() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchMetrics = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/encoding/statistics`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setMetrics(data);
    }
  };

  const fetchRows = async (nextQuery) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/beneficiaries/search?q=${encodeURIComponent(nextQuery || '')}&limit=120`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to load beneficiaries');
    }
    setRows(data.beneficiaries || []);
  };

  const refreshAll = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRows(query), fetchMetrics()]);
    } catch (error) {
      console.error(error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <DataEncoderLayout metrics={metrics}>
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">Beneficiary Profiles</h1>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Add Beneficiary
          </button>
        </div>

        <div className="p-4 border-b border-indigo-100">
          <div className="relative rounded-full border border-indigo-200 bg-indigo-50/40 px-4 py-2 flex items-center gap-2">
            <Search size={16} className="text-indigo-600" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, RSBSA, or barangay"
              className="w-full bg-transparent outline-none text-sm"
            />
            <button
              type="button"
              onClick={refreshAll}
              className="text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-semibold"
            >
              Search
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-gray-500 text-sm inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Loading beneficiaries...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-gray-500 text-sm">No matching beneficiaries.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[780px]">
              <thead className="bg-indigo-50/60">
                <tr>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Name</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">RSBSA No.</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Barangay</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Interventions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-indigo-50/40">
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{row.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.rsbsaNumber || 'Pending'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.barangay || 'N/A'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.validationStatus || 'Pending'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.interventions?.join(', ') || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddBeneficiaryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refreshAll}
        interventionsEndpoint={`${API_URL}/data-encoder/interventions-list?type=LGU`}
        submitEndpoint={`${API_URL}/data-encoder/add-beneficiary`}
        title="Add Beneficiary Record"
      />
    </DataEncoderLayout>
  );
}

export default BeneficiaryProfiles;
