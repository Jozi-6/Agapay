import { Home, FileText, Landmark, AlertTriangle } from 'lucide-react';
import { UnifiedSidebar } from '../UnifiedSidebar';

const ROOT = '/agricultural-technologist';

const navItems = [
  { path: `${ROOT}/dashboard`, label: 'Home', icon: Home },
  { path: `${ROOT}/da-intervention`, label: 'DA Interventions', icon: FileText },
  { path: `${ROOT}/lgu-intervention`, label: 'MLGU Interventions', icon: Landmark },
  { path: `${ROOT}/crisis-reports`, label: 'Crisis Reports', icon: AlertTriangle }
];

export function AgritechSidebar({ isOpen, onToggle, onClose }) {
  return (
    <UnifiedSidebar
      navItems={navItems}
      roleLabel="Agricultural Technologist"
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}
