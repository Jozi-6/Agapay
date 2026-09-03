import { useEffect, useState } from 'react';
import { MapPin, FileText, Plus, AlertTriangle, Eye } from 'lucide-react';
import { DataEncoderLayout } from '../../components/data-encoder/DataEncoderLayout';
import { CrisisReportForm } from '../../components/data-encoder/CrisisReportForm';
import { PhotoGalleryModal } from '../../components/PhotoGalleryModal';

import { API_URL } from '../../config/api.js';

function DataEncoderCrisisReports() {
  const [reports, setReports] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [reportsResponse, statsResponse] = await Promise.all([
        fetch(`${API_URL}/data-encoder/crisis-reports`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/encoding/statistics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const reportsData = await reportsResponse.json();
      const statsData = await statsResponse.json();

      if (!reportsResponse.ok) {
        throw new Error(reportsData.message || 'Failed to load crisis reports');
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

  const handleFormSubmit = () => {
    setShowForm(false);
    fetchData();
  };

  return (
    <DataEncoderLayout metrics={metrics}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Crisis Reports</h1>
              <p className="text-sm text-gray-600">Manage agricultural crisis and damage reports</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            <Plus size={20} />
            Add Crisis Report
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Filed Reports</h2>
            <span className="text-sm text-gray-500">({reports.length})</span>
          </div>

          <div className="p-6">
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-8">Loading reports...</p>
            ) : error ? (
              <p className="text-sm text-red-600 text-center py-8">{error}</p>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No crisis reports found.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + Add Crisis Report
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{report.farmerName}</p>
                        <p className="text-xs text-indigo-600 font-medium mt-1">{report.disaster}</p>
                      </div>
                     
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="font-medium">Barangay:</span> {report.barangay}
                      </p>
                      {report.cropType && (
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="font-medium">Crop:</span> {report.cropType}
                        </p>
                      )}
                      {report.totalAreaHectares && (
                        <p className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="font-medium">Area:</span> {report.totalAreaHectares} ha
                        </p>
                      )}
                      {report.latitude && report.longitude && (
                        <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                          <MapPin size={12} className="text-indigo-600" />
                          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(report.createdAt).toLocaleDateString()} at {new Date(report.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReport(report)}
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
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-white">Add Crisis Report</h2>
                <p className="text-sm text-indigo-100">Submit a new agricultural crisis report</p>
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
              <CrisisReportForm apiPathPrefix="/data-encoder" onSubmit={handleFormSubmit} />
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
    </DataEncoderLayout>
  );
}

export default DataEncoderCrisisReports;
