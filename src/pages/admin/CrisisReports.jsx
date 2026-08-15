import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Search, Filter, X, Plus, FileText, Check, Download, FileJson } from 'lucide-react';
import { NewCrisisReportModal } from '../../components/NewCrisisReportModal';
import { PhotoGalleryModal } from '../../components/PhotoGalleryModal';

const API_URL = '/api';
const CRISIS_TYPES = [
  'Typhoon',
  'Drought / El Niño',
  'Flood',
  'Earthquake',
  'Pest and Disease',
  'Water Crisis',
  'Other Agricultural Crisis'
];

const CROP_STAGES = [
  'Vegetative',
  'Reproductive',
  'Maturing',
  'Harvested'
];

function CrisisReports() {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({
    farmersAffected: 0,
    totalAreaDamaged: 0,
    productionLoss: 0,
    estimatedCost: 0
  });
  const [filters, setFilters] = useState({
    crisisType: 'All',
    barangay: 'All',
    status: 'All',
    search: ''
  });
  const [availableFilters, setAvailableFilters] = useState({
    crisisTypes: [],
    barangays: [],
    statuses: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);

  useEffect(() => {
    fetchCrisisReports();
    fetchSummary();
  }, [filters]);

  const fetchCrisisReports = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.crisisType !== 'All') params.append('crisisType', filters.crisisType);
      if (filters.barangay !== 'All') params.append('barangay', filters.barangay);
      if (filters.status !== 'All') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      
      const url = `${API_URL}/admin/crisis-reports${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch crisis reports');

      const data = await response.json();
      setReports(data.reports);
      setAvailableFilters(data.filters);
      setError(null);
    } catch (err) {
      console.error('Error fetching crisis reports:', err);
      setError('Failed to load crisis reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.crisisType !== 'All') params.append('crisisType', filters.crisisType);
      if (filters.barangay !== 'All') params.append('barangay', filters.barangay);
      if (filters.status !== 'All') params.append('status', filters.status);
      
      const url = `${API_URL}/admin/crisis-reports/summary${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch summary');

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      crisisType: 'All',
      barangay: 'All',
      status: 'All',
      search: ''
    });
  };

  const handleValidateReport = async (reportId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/crisis-reports/${reportId}/validate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to validate report');

      fetchCrisisReports();
      fetchSummary();
    } catch (err) {
      console.error('Error validating report:', err);
      alert('Failed to validate report');
    }
  };

  const handleExportExcel = () => {
    if (reports.length === 0) {
      alert('No data to export');
      return;
    }

    const csvContent = [
      ['Beneficiary Name', 'Barangay', 'Crop Type', 'Crop Stage', 'Total Area (ha)', 'Damaged Area (ha)', 'Production Loss (MT)', 'Estimated Cost (₱)', 'Status', 'Date'],
      ...reports.map(r => [
        r.beneficiaryName,
        r.barangay,
        r.cropType || '',
        r.cropStage || '',
        r.totalAreaHectares || '',
        r.damagedAreaHectares || '',
        r.productionLossMt || '',
        r.estimatedDamageCost || '',
        r.status,
        new Date(r.createdAt).toLocaleDateString()
      ])
    ];

    let csv = csvContent.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crisis-reports-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleGeneratePDF = () => {
    alert('PDF generation feature coming soon');
  };

  const hasActiveFilters = filters.crisisType !== 'All' || filters.barangay !== 'All' || filters.status !== 'All' || filters.search;

  return (
    <AdminLayout 
      title="Crisis / Crop Damage Report"
      description="Agricultural crisis and crop damage reporting system"
    >
      {/* Page Header */}
      <div className="mb-6 flex justify-between items-start">
        <div className="flex items-center gap-3">
          <FileText size={28} className="text-agapay-purple" />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-agapay-purple to-agapay-blue text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          <Plus size={20} />
          New Damage Report
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Crisis Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Crisis Type</label>
            <select
              value={filters.crisisType}
              onChange={(e) => handleFilterChange('crisisType', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
            >
              <option value="All">All</option>
              {availableFilters.crisisTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Barangay */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Barangay</label>
            <select
              value={filters.barangay}
              onChange={(e) => handleFilterChange('barangay', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
            >
              <option value="All">All</option>
              {availableFilters.barangays.map(barangay => (
                <option key={barangay} value={barangay}>{barangay}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white"
            >
              <option value="All">All</option>
              {availableFilters.statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Beneficiary Name</label>
            <input
              type="text"
              placeholder="Search by name..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Farmers Affected */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Farmers Affected</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{summary.farmersAffected}</p>
        </div>

        {/* Total Area Damaged */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Total Area Damaged (ha)</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{summary.totalAreaDamaged.toFixed(2)}</p>
        </div>

        {/* Production Loss */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Production Loss (MT)</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{summary.productionLoss.toFixed(2)}</p>
        </div>

        {/* Estimated Cost */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Est. Cost of Damage (₱)</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {summary.estimatedCost >= 1000000
              ? `₱${(summary.estimatedCost / 1000000).toFixed(1)}M`
              : `₱${summary.estimatedCost.toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Reported Damage Records */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Reported Damage Records</h2>
        <p className="text-sm text-gray-600 mt-1">
          Showing <span className="font-semibold">{reports.length}</span> {hasActiveFilters ? 'filtered ' : ''}crisis report{reports.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading crisis reports...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No crisis reports found.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-agapay-purple text-white rounded-lg hover:bg-agapay-purpleDark transition-colors"
          >
            + New Damage Report
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Barangay</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Crop / Farm</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Stage</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Damaged Area</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Loss (MT)</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Cost of Damage</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{report.beneficiaryName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{report.barangay}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{report.cropType || '-'}</div>
                      {report.farmLocation && <div className="text-sm text-gray-500">{report.farmLocation}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{report.cropStage || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">
                        {report.totalAreaHectares}/{report.damagedAreaHectares} ha
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">{report.productionLossMt || 0} MT</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-600">
                        ₱{report.estimatedDamageCost ? report.estimatedDamageCost.toLocaleString() : '0'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        report.status === 'Validated'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : report.status === 'For Validation'
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.status === 'For Validation' && (
                        <button
                          onClick={() => handleValidateReport(report.id)}
                          className="text-agapay-purple hover:text-agapay-purpleDark flex items-center gap-1 text-sm"
                          title="Validate report"
                        >
                          <Check size={16} />
                          Validate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      {reports.length > 0 && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            Export to Excel
          </button>
          <button
            onClick={handleGeneratePDF}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileJson size={18} />
            Generate PDF Report
          </button>
        </div>
      )}

      {/* Modals */}
      <NewCrisisReportModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchCrisisReports();
          fetchSummary();
        }}
      />

      <PhotoGalleryModal 
        isOpen={showPhotoModal}
        photos={selectedPhotos}
        onClose={() => setShowPhotoModal(false)}
      />
    </AdminLayout>
  );
}

export default CrisisReports;
