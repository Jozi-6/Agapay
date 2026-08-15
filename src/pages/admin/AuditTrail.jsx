import { AdminLayout } from '../../components/AdminLayout';
import { AuditTrailPanel } from '../../components/AuditTrailPanel';

function AuditTrail() {
  return (
    <AdminLayout 
      title="Audit Trail"
      description="System activity and change logs"
    >
      <AuditTrailPanel />
    </AdminLayout>
  );
}

export default AuditTrail;
