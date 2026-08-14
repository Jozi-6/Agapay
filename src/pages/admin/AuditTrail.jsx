import { AdminLayout } from '../../components/AdminLayout';

function AuditTrail() {
  return (
    <AdminLayout 
      title="Audit Trail"
      description="System activity and change logs"
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">Audit trail content will be displayed here.</p>
      </div>
    </AdminLayout>
  );
}

export default AuditTrail;
