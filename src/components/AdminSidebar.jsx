import { Home, FileText, UserPlus, AlertTriangle, Users, History, BarChart3, Package, Settings } from 'lucide-react';
import { UnifiedSidebar } from './UnifiedSidebar';

const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { path: '/admin/users', label: 'User Management', icon: Users },
  { path: '/admin/beneficiaries', label: 'Beneficiary Records', icon: FileText },
  { path: '/admin/da-interventions', label: 'DA Interventions', icon: FileText },
  { path: '/admin/lgu-interventions', label: 'MLGU Interventions', icon: FileText },
  { path: '/admin/inventory', label: 'Inventory', icon: Package },
  { path: '/admin/crisis-reports', label: 'Crisis Reports', icon: AlertTriangle },
  { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/audit-trail', label: 'Audit Trail', icon: History },
];

export function AdminSidebar({ isOpen, onToggle, onClose }) {
  return (
    <UnifiedSidebar
      navItems={navItems}
      roleLabel="Municipal Agriculturist"
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
}
