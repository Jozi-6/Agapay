import { AgritechLayout } from './AgritechLayout';

export function AgritechPlaceholder({ title, description }) {
  return (
    <AgritechLayout title={title} description={description}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-agapay-lavender rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚜</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500">
          This module is under construction. Content will be available soon.
        </p>
      </div>
    </AgritechLayout>
  );
}
