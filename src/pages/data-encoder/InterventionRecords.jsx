import { useEffect, useState } from 'react';
import { FileText, Search, Loader2 } from 'lucide-react';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';

const API_URL = '/api';

function InterventionRecords() {
  const [records, setRecords] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const [recordsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/data-encoder/intervention-records?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/encoding/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const recordsData = await recordsResponse.json();
      const statsData = await statsResponse.json();

      if (recordsResponse.ok) {
        setRecords(recordsData.records || []);
      }
      if (statsResponse.ok) {
        setMetrics(statsData);
      }
    } catch (error) {
      console.error(error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <DataEncoderLayout metrics={metrics}>
      <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-indigo-100 flex items-center gap-2">
          <FileText size={18} className="text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Intervention Records</h1>
        </div>

        <div className="p-4 border-b border-indigo-100">
          <div className="relative rounded-full border border-indigo-200 bg-indigo-50/40 px-4 py-2 flex items-center gap-2">
            <Search size={16} className="text-indigo-600" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search interventions"
              className="w-full bg-transparent outline-none text-sm"
            />
            <button
              type="button"
              onClick={refresh}
              className="text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-semibold"
            >
              Search
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-gray-500 inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Loading records...
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-sm text-gray-500">No intervention records found.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-indigo-50/60">
                <tr>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Beneficiary</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Type</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Intervention</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 text-xs uppercase tracking-wide text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((row) => (
                  <tr key={row.id} className="hover:bg-indigo-50/40">
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{row.beneficiaryName}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.type}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.intervention}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.status}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{row.date || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DataEncoderLayout>
  );
}

export default InterventionRecords;
