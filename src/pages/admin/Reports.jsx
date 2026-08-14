import { AdminLayout } from '../../components/AdminLayout';

function Reports() {
  return (
    <AdminLayout 
      title="Reports"
      description="Generate and view system reports"
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">Reports content will be displayed here.</p>
      </div>
    </AdminLayout>
  );
}

export default Reports;
