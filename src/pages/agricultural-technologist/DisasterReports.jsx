import { useState, useEffect } from 'react';
import { AgritechLayout } from '../../components/agritech/AgritechLayout';
import { DamageReportForm } from '../../components/agritech/DamageReportForm';
import { MapPin, FileText } from 'lucide-react';

const API_URL = '/api';

function DisasterReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/damage-reports`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch damage reports');

      const data = await response.json();
      setReports(data.reports);
      setError(null);
    } catch (err) {
      console.error('Error fetching damage reports:', err);
      setError('Failed to load damage reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgritechLayout
      title="Disaster Reports"
      description="File and track agricultural disaster / damage reports"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Report Form */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-agapay-purple to-agapay-blue">
            <h2 className="text-xl font-bold text-white">New Damage Report</h2>
            <p className="text-sm text-white/80">Submit a crop damage report for validation</p>
          </div>
          <div className="p-6">
            <DamageReportForm onSubmit={fetchReports} />
          </div>
        </div>

        {/* Filed Reports */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-agapay-lavender rounded-lg flex items-center justify-center">
              <FileText size={20} className="text-agapay-purple" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Filed Reports</h2>
              <p className="text-sm text-gray-500">Reports submitted this month</p>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center text-gray-500 py-8">Loading reports...</p>
            ) : error ? (
              <p className="text-center text-red-500 py-8">{error}</p>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No damage reports filed yet.</p>
                <p className="text-sm text-gray-400 mt-1">Submit your first report using the form.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {reports.map((report) => (
                  <li key={report.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{report.farmerName}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{report.disaster}</p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        report.status === 'Validated'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : report.status === 'Rejected'
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {report.barangay}
                      {report.cropType ? ` · ${report.cropType}` : ''}
                      {report.cropStage ? ` · ${report.cropStage}` : ''}
                    </p>
                    {report.latitude && report.longitude && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} className="text-agapay-purple" />
                        {report.latitude}, {report.longitude}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Filed {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AgritechLayout>
  );
}

export default DisasterReports;
