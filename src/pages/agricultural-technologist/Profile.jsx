import { AgritechLayout } from '../../components/agritech/AgritechLayout';

function AgritechProfile() {
  return (
    <AgritechLayout
      title="Profile Settings"
      description="Review and update your account details"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Profile settings will be available in a future update.</p>
      </div>
    </AgritechLayout>
  );
}

export default AgritechProfile;