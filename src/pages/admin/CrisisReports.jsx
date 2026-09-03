import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Search, Filter, X, Plus, FileText, Check, Download, FileJson, Eye } from 'lucide-react';
import { NewCrisisReportModal } from '../../components/NewCrisisReportModal';
import { PhotoGalleryModal } from '../../components/PhotoGalleryModal';
import { OFFICIAL_BARANGAYS } from '../../constants/barangays.js';

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
    search: ''
  });
  const [availableFilters, setAvailableFilters] = useState({
    crisisTypes: [],
    barangays: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

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
      search: ''
    });
  };

  const handleExportExcel = () => {
    if (reports.length === 0) {
      alert('No data to export');
      return;
    }

    const csvContent = [
      ['Beneficiary Name', 'Barangay', 'Crop Type', 'Crop Stage', 'Total Area (ha)', 'Damaged Area (ha)', 'Production Loss (MT)', 'Estimated Cost (₱)', 'Date'],
      ...reports.map(r => [
        r.beneficiaryName,
        r.barangay,
        r.cropType || '',
        r.cropStage || '',
        r.totalAreaHectares || '',
        r.damagedAreaHectares || '',
        r.productionLossMt || '',
        r.estimatedDamageCost || '',
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

  const hasActiveFilters = filters.crisisType !== 'All' || filters.barangay !== 'All' || filters.search;

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
              {OFFICIAL_BARANGAYS.map(barangay => (
                <option key={barangay} value={barangay}>{barangay}</option>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {reports.map((report) => (
              <div key={report.id} className="border border-gray-200 rounded-xl p-4 hover:border-agapay-purple hover:shadow-md transition-all bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{report.beneficiaryName}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{report.crisisType || report.disaster}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p><span className="font-medium">Barangay:</span> {report.barangay}</p>
                  {report.cropType && <p><span className="font-medium">Crop:</span> {report.cropType}</p>}
                  {report.totalAreaHectares && <p><span className="font-medium">Area:</span> {report.totalAreaHectares} ha</p>}
                  {report.estimatedDamageCost && <p><span className="font-medium">Cost:</span> ₱{Number(report.estimatedDamageCost).toLocaleString()}</p>}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-400">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Eye size={14} />
                    View Details
                  </button>
                </div>
              </div>
            ))}
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
        isOpen={Boolean(selectedReport)}
        report={selectedReport}
        photos={selectedReport?.photos || []}
        onClose={() => setSelectedReport(null)}
      />
    </AdminLayout>
  );
}

export default CrisisReports;
