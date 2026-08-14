import { AdminLayout } from '../../components/AdminLayout';

function Users() {
  return (
    <AdminLayout 
      title="User Management"
      description="Manage Agricultural Technologists and Data Encoders"
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">User management content will be displayed here.</p>
      </div>
    </AdminLayout>
  );
}

export default Users;
