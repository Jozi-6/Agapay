import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

const ROOT = '/agricultural-technologist';

const actions = [
  {
    label: 'File Crisis Report',
    icon: AlertTriangle,
    primary: true,
    path: `${ROOT}/disaster-reports`,
  },
  {
    label: 'Interventions',
    icon: ArrowRight,
    primary: false,
    path: `${ROOT}/da-intervention`,
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm ${
              action.primary
                ? 'bg-agapay-purple text-white hover:bg-agapay-purpleDark'
                : 'bg-white border-2 border-agapay-purple text-gray-800 hover:bg-agapay-lavender'
            }`}
          >
            <Icon size={16} />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
