import { X, MapPin, CalendarDays, CheckCircle2, AlertCircle, FileText, Leaf, Coins } from 'lucide-react';

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `₱${num.toLocaleString()}`;
}

export function PhotoGalleryModal({ isOpen, photos = [], onClose, report = null, title = 'Photo Gallery' }) {
  if (!isOpen) return null;


  const detailRows = [
    { label: 'Farmer / Beneficiary', value: report?.farmerName || report?.beneficiaryName || '—' },
    { label: 'Crisis Type', value: report?.disaster || report?.crisisType || '—' },
    { label: 'Barangay', value: report?.barangay || '—' },
    { label: 'Crop Type', value: report?.cropType || '—' },
    { label: 'Crop Stage', value: report?.cropStage || '—' },
    { label: 'Farm Location', value: report?.farmLocation || '—' },
    { label: 'Total Area', value: report?.totalAreaHectares ? `${report.totalAreaHectares} ha` : '—' },
    { label: 'Damaged Area', value: report?.damagedAreaHectares ? `${report.damagedAreaHectares} ha` : '—' },
    { label: 'Production Loss', value: report?.productionLossMt ? `${report.productionLossMt} MT` : '—' },
    { label: 'Estimated Damage', value: formatMoney(report?.estimatedDamageCost) },
    { label: 'Status', value: report?.status || '—' },
    { label: 'Date Filed', value: report?.createdAt ? new Date(report.createdAt).toLocaleString() : '—' },
    { label: 'GPS', value: report?.latitude && report?.longitude ? `${report.latitude}, ${report.longitude}` : '—' },
    { label: 'Remarks', value: report?.remarks || 'No remarks provided.' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {report && (
              <p className="text-sm text-gray-300 mt-1">{report.disaster || report.crisisType || 'Crisis report'} details</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {report && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{report.farmerName || report.beneficiaryName || 'Farmer Record'}</h3>
                  <p className="text-sm text-gray-600">{report.barangay || 'Barangay not provided'}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                {detailRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      {row.label === 'Barangay' && <MapPin size={14} />}
                      {row.label === 'Date Filed' && <CalendarDays size={14} />}
                      {row.label === 'Crisis Type' && <FileText size={14} />}
                      {row.label === 'Crop Type' && <Leaf size={14} />}
                      {row.label === 'Estimated Damage' && <Coins size={14} />}
                      <span className="font-medium">{row.label}</span>
                    </div>
                    <p className="text-gray-800 break-words">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
