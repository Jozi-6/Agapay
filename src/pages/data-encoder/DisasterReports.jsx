import { useEffect, useState } from 'react';
import { MapPin, FileText } from 'lucide-react';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';
import { DamageReportForm } from '../../components/agritech/DamageReportForm';

const API_URL = '/api';

function DataEncoderDisasterReports() {
  const [reports, setReports] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [reportsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/data-encoder/disaster-reports`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/encoding/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const reportsData = await reportsResponse.json();
      const statsData = await statsResponse.json();

      if (!reportsResponse.ok) {
        throw new Error(reportsData.message || 'Failed to load disaster reports');
      }

      setReports(reportsData.reports || []);
      setError('');

      if (statsResponse.ok) {
        setMetrics(statsData);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <DataEncoderLayout metrics={metrics}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600">
            <h2 className="text-lg font-bold text-white">Create Disaster Report</h2>
            <p className="text-sm text-indigo-100">Encode and submit agricultural damage records.</p>
          </div>
          <div className="p-5">
            <DamageReportForm apiPathPrefix="/data-encoder" onSubmit={fetchData} />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-indigo-100 flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Filed Reports</h2>
          </div>

          <div className="p-4 flex-1 overflow-auto">
            {loading ? (
              <p className="text-sm text-gray-500">Loading reports...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-gray-500">No reports found.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((report) => (
                  <li key={report.id} className="rounded-2xl border border-gray-200 p-3">
                    <p className="font-semibold text-gray-900 text-sm">{report.farmerName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{report.disaster}</p>
                    <p className="text-xs text-gray-500 mt-1">{report.barangay}</p>
                    {report.latitude && report.longitude && (
                      <p className="text-xs text-gray-500 mt-1 inline-flex items-center gap-1">
                        <MapPin size={12} className="text-indigo-600" />
                        {report.latitude}, {report.longitude}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(report.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DataEncoderLayout>
  );
}

export default DataEncoderDisasterReports;
