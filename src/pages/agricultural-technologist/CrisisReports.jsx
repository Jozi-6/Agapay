import { useState, useEffect } from 'react';
import { AgritechLayout } from '../../components/agritech/AgritechLayout';
import { DamageReportForm } from '../../components/agritech/DamageReportForm';
import { PhotoGalleryModal } from '../../components/PhotoGalleryModal';
import { MapPin, FileText, AlertTriangle, Plus, Eye } from 'lucide-react';

const API_URL = '/api';

function CrisisReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/crisis-reports`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch crisis reports');

      const data = await response.json();
      setReports(data.reports || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching crisis reports:', err);
      setError('Failed to load crisis reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const openReport = (report) => {
    setSelectedReport(report);
  };

  return (
    <AgritechLayout
      title="Crisis Reports"
      description="File and track agricultural crisis / damage reports"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-agapay-purple to-agapay-blue text-white flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Filed Reports</h1>
              <p className="text-sm text-gray-600">Agricultural crisis reports submitted for review</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-agapay-purple to-agapay-blue text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            Add Crisis Report
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-agapay-lavender rounded-lg flex items-center justify-center">
              <FileText size={20} className="text-agapay-purple" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Crisis Reports</h2>
              <p className="text-sm text-gray-500">{reports.length} report{reports.length === 1 ? '' : 's'} filed</p>
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <p className="text-center text-gray-500 py-8">Loading reports...</p>
            ) : error ? (
              <p className="text-center text-red-500 py-8">{error}</p>
            ) : reports.length === 0 ? (
              <div className="text-center py-10">
                <AlertTriangle size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No crisis reports filed yet.</p>
                <p className="text-sm text-gray-400 mt-1">Submit your first report using the add button.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reports.map((report) => (
                  <div key={report.id} className="border border-gray-200 rounded-xl p-4 hover:border-agapay-purple hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{report.farmerName}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{report.disaster}</p>
                      </div>
                      
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {report.barangay}
                      {report.cropType ? ` · ${report.cropType}` : ''}
                    </p>
                    {report.latitude && report.longitude && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} className="text-agapay-purple" />
                        {report.latitude}, {report.longitude}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Filed {new Date(report.createdAt).toLocaleString()}</p>
                    <button
                      type="button"
                      onClick={() => openReport(report)}
                      className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-agapay-purple to-agapay-blue p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-white">Add Crisis Report</h2>
                <p className="text-sm text-white/80">Submit a crop damage report for validation</p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <DamageReportForm onSubmit={() => { setShowForm(false); fetchReports(); }} />
            </div>
          </div>
        </div>
      )}

      <PhotoGalleryModal
        isOpen={Boolean(selectedReport)}
        report={selectedReport}
        photos={selectedReport?.photos || []}
        onClose={() => setSelectedReport(null)}
      />
    </AgritechLayout>
  );
}

export default CrisisReports;
