import { Home, FileText, Package, AlertTriangle } from 'lucide-react';
import { UnifiedSidebar } from '../UnifiedSidebar';

const navItems = [
  { path: '/data-encoder/dashboard', label: 'Home', icon: Home },
  { path: '/data-encoder/intervention-records', label: 'Intervention Records', icon: FileText },
  { path: '/data-encoder/inventory', label: 'Inventory', icon: Package },
  { path: '/data-encoder/crisis-reports', label: 'Crisis Reports', icon: AlertTriangle },
];

export function DataEncoderSidebar({ isOpen, onToggle, onClose }) {
  return (
    <UnifiedSidebar
      navItems={navItems}
      roleLabel="Data Encoder"
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}
