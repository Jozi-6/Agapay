import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { CalendarDays, FileDown, Loader2, AlertCircle } from 'lucide-react';

const API_URL = '/api';

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' }
];

const EMPTY_FORM = {
  program: 'All (DA & LGU)',
  format: 'pdf',
  startDate: '',
  endDate: '',
  distributionCycle: ''
};

const inputClasses =
  'w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-colors';

function Reports() {
  const [programs, setPrograms] = useState(['All (DA & LGU)', 'DA Intervention', 'LGU Intervention']);
  const [distributionCycles, setDistributionCycles] = useState([]);
  const [filtersError, setFiltersError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState({ type: null, message: '' });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchFilters();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchFilters = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/reports/filters`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load report filters');
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      setPrograms(data.programs);
      setDistributionCycles(data.distributionCycles);
      setFiltersError(null);
    } catch (err) {
      console.error('Error fetching report filters:', err);
      if (isMountedRef.current) {
        setFiltersError('Unable to load report filters. Please try again.');
      }
    }
  };

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setValidationError(null);
  };

  const handleGenerate = async () => {
    if (isGenerating) return;

    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setValidationError('Start Date cannot be later than End Date.');
      return;
    }

    setIsGenerating(true);
    setStatus({ type: 'loading', message: 'Generating Report...' });
    setValidationError(null);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (form.program) params.append('program', form.program);
      if (form.startDate) params.append('startDate', form.startDate);
      if (form.endDate) params.append('endDate', form.endDate);
      if (form.distributionCycle) params.append('distributionCycle', form.distributionCycle);
      params.append('format', form.format);

      const response = await fetch(`${API_URL}/admin/reports/generate?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        let message = 'Unable to generate report. Please try again.';
        try {
          const data = await response.json();
          if (data.error) message = data.error;
        } catch (e) {
          // Non-JSON error body; keep default message.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const fileNameMatch = /filename="([^"]+)"/.exec(disposition);
      const fileName = fileNameMatch ? fileNameMatch[1] : `AGAPAY_Report.${form.format === 'xlsx' ? 'xlsx' : form.format}`;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setStatus({ type: 'success', message: 'Report generated and downloaded successfully.' });
    } catch (err) {
      const message = err.message || 'Unable to generate report. Please try again.';
      setStatus({
        type: message.includes('No records found') ? 'empty' : 'error',
        message: message.includes('No records found')
          ? 'No records found for the selected filters.'
          : 'Unable to generate report. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isGeneratingAny = isGenerating || status.type === 'loading';

  return (
    <AdminLayout
      title="Reports"
      description="Generate beneficiary intervention reports"
    >
      <div className="max-w-3xl">
        {/* White rounded card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-agapay-purple to-agapay-purpleDark flex items-center justify-center flex-shrink-0">
              <FileDown size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">REPORTS</h2>
              <p className="text-sm text-gray-500">Generate downloadable reports from beneficiary records</p>
            </div>
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
              <AlertCircle size={16} className="flex-shrink-0" />
              {validationError}
            </div>
          )}

          {/* Filters error */}
          {filtersError && (
            <div className="mb-6 flex items-center justify-between gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
              <span className="flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                {filtersError}
              </span>
              <button
                onClick={fetchFilters}
                className="px-3 py-1 bg-agapay-purple text-white text-xs rounded-lg hover:bg-agapay-purpleDark transition-colors flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* Program */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Program
              </label>
              <select
                value={form.program}
                onChange={(e) => setField('program', e.target.value)}
                className={inputClasses}
              >
                {programs.map(program => (
                  <option key={program} value={program}>{program}</option>
                ))}
              </select>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Export Format
              </label>
              <select
                value={form.format}
                onChange={(e) => setField('format', e.target.value)}
                className={inputClasses}
              >
                {EXPORT_FORMATS.map(formatOption => (
                  <option key={formatOption.value} value={formatOption.value}>{formatOption.label}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <div className="relative">
                  <CalendarDays size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField('startDate', e.target.value)}
                    className={`${inputClasses} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <div className="relative">
                  <CalendarDays size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setField('endDate', e.target.value)}
                    className={`${inputClasses} pl-10`}
                  />
                </div>
              </div>
            </div>

            {/* Distribution Cycle */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Distribution Cycle
              </label>
              <select
                value={form.distributionCycle}
                onChange={(e) => setField('distributionCycle', e.target.value)}
                className={inputClasses}
              >
                <option value="">All Cycles</option>
                {distributionCycles.map(cycle => (
                  <option key={cycle} value={cycle}>{cycle}</option>
                ))}
              </select>
            </div>

            {/* Generate Report */}
            <button
              onClick={handleGenerate}
              disabled={isGeneratingAny}
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-agapay-purple to-agapay-purpleDark text-white font-semibold text-base shadow-md hover:from-agapay-purpleDark hover:to-agapay-purpleDark transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGeneratingAny ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileDown size={20} />
                  + Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status feedback */}
        {status.type && !isGeneratingAny && (
          <div className={`mt-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-2 ${
            status.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : status.type === 'empty'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            {status.type === 'success' && <FileDown size={18} className="flex-shrink-0" />}
            {status.type === 'empty' && <AlertCircle size={18} className="flex-shrink-0" />}
            {status.type === 'error' && <AlertCircle size={18} className="flex-shrink-0" />}
            {status.message}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Reports;
