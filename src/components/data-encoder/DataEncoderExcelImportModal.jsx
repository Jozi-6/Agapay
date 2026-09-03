import { useMemo, useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

const API_URL = '/api';

export function DataEncoderExcelImportModal({ isOpen, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('beneficiary');
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasBlockingErrors = useMemo(() => {
    if (!previewData?.errors) {
      return false;
    }
    return previewData.errors.length > 0;
  }, [previewData]);

  if (!isOpen) {
    return null;
  }

  const resetState = () => {
    setFile(null);
    setImportType('beneficiary');
    setPreviewData(null);
    setError('');
    setSuccess('');
    setLoadingPreview(false);
    setConfirming(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePreview = async () => {
    if (!file) {
      setError('Please select an Excel file first.');
      return;
    }

    setLoadingPreview(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);
      form.append('importType', importType);

      const response = await fetch(`${API_URL}/encoding/excel/preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate preview.');
      }

      setPreviewData(data);
      setSuccess('Excel file loaded successfully. Preview ready.');
    } catch (err) {
      setError(err.message || 'Failed to generate preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData?.previewToken) {
      setError('Preview token is missing. Please regenerate preview.');
      return;
    }

    setConfirming(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/encoding/excel/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ previewToken: previewData.previewToken })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to import records.');
      }

      setSuccess(`Import completed: ${data.imported} row(s) imported.`);
      if (onImported) {
        onImported(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to confirm import.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={22} />
            <div>
              <h2 className="font-bold text-xl">Upload Excel</h2>
              <p className="text-xs text-indigo-100">Validate records before importing to AGAPAY.</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-auto">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Import Type</label>
                <select
                  value={importType}
                  onChange={(event) => {
                    setImportType(event.target.value);
                    setPreviewData(null);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="beneficiary">Beneficiary Records</option>
                  <option value="crisis_report">Crisis Reports</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Excel File (.xlsx or .xls)</label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-indigo-200 cursor-pointer hover:bg-indigo-50 transition-colors">
                    <Upload size={16} />
                    <span className="text-sm font-medium">Choose File</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] || null);
                        setPreviewData(null);
                        setError('');
                        setSuccess('');
                      }}
                    />
                  </label>
                  <span className="text-sm text-gray-600">{file ? file.name : 'No file selected'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePreview}
                disabled={loadingPreview || !file}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPreview ? 'Validating...' : 'Preview Import'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 p-3 text-sm flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {previewData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-indigo-100 p-3 bg-white">
                  <p className="text-xs text-gray-500">Total Rows</p>
                  <p className="text-2xl font-bold text-gray-900">{previewData.summary?.totalRows ?? 0}</p>
                </div>
                <div className="rounded-xl border border-green-100 p-3 bg-white">
                  <p className="text-xs text-gray-500">Valid Rows</p>
                  <p className="text-2xl font-bold text-green-700">{previewData.summary?.validRows ?? 0}</p>
                </div>
                <div className="rounded-xl border border-red-100 p-3 bg-white">
                  <p className="text-xs text-gray-500">Rows With Issues</p>
                  <p className="text-2xl font-bold text-red-700">{previewData.summary?.errorRows ?? 0}</p>
                </div>
              </div>

              {previewData.errors?.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <h3 className="font-semibold text-red-800 mb-2">Import Errors</h3>
                  <ul className="space-y-2 max-h-44 overflow-auto text-sm text-red-700">
                    {previewData.errors.map((err) => (
                      <li key={`err-${err.line}`}>
                        Row {err.line}: {err.issues.join('; ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">Preview</h3>
                </div>
                <div className="overflow-auto max-h-72">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr>
                        {(previewData.headers || []).map((header) => (
                          <th key={`header-${header}`} className="px-3 py-2 text-left whitespace-nowrap">
                            {header || 'Column'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview?.slice(0, 100).map((row) => (
                        <tr key={`row-${row.line}`} className="border-t border-gray-100">
                          {(previewData.headers || []).map((header) => (
                            <td key={`${row.line}-${header}`} className="px-3 py-2 whitespace-nowrap">
                              {row[header] ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-indigo-100 bg-white flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!previewData || hasBlockingErrors || confirming}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
