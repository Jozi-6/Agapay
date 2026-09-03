import { Users, Clock, Activity, AlertTriangle } from 'lucide-react';

export function StatisticsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Beneficiaries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-agapay-purple/10 rounded-lg flex items-center justify-center">
            <Users className="text-agapay-purple" size={24} />
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            Total
          </span>
        </div>
        <p className="text-3xl font-bold text-gray-800">{stats.totalBeneficiaries}</p>
        <p className="text-sm text-gray-600 mt-1">Total Beneficiaries</p>
      </div>

      {/* Needs Review */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center">
            <Clock className="text-orange-500" size={24} />
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            Review
          </span>
        </div>
        <p className="text-3xl font-bold text-gray-800">{stats.pendingRSBSA}</p>
        <p className="text-sm text-gray-600 mt-1">Needs Review</p>
      </div>

      {/* Active Interventions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
            <Activity className="text-green-500" size={24} />
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
        <p className="text-3xl font-bold text-gray-800">{stats.activeInterventions}</p>
        <p className="text-sm text-gray-600 mt-1">Active Interventions</p>
      </div>

      {/* Active Crisis Reports */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
        <p className="text-3xl font-bold text-gray-800">{stats.activeCrisisReports}</p>
        <p className="text-sm text-gray-600 mt-1">Active Crisis Reports</p>
      </div>
    </div>
  );
}
