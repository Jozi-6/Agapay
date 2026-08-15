export function MetricsCard({ icon: Icon, label, value, tone = 'purple' }) {
  const toneClasses = {
    purple: 'bg-agapay-lavender text-agapay-purple',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-600',
  };

  const iconTone = toneClasses[tone] || toneClasses.purple;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconTone}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
        <p className="text-sm text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}
