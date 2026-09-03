import { AdminLayout } from '../../components/AdminLayout';

function Users() {
  return (
    <AdminLayout 
      title="User Management"
      description="Manage system accounts, approvals, and role assignments"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">User administration and account approvals are managed from the system workspace.</p>
      </div>
    </AdminLayout>
  );
}

export default Users;
