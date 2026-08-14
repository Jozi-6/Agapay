import { AdminLayout } from '../../components/AdminLayout';

function NewlyRegistered() {
  return (
    <AdminLayout 
      title="Newly Registered"
      description="Recently registered beneficiaries"
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">Newly registered beneficiaries content will be displayed here.</p>
      </div>
    </AdminLayout>
  );
}

export default NewlyRegistered;
