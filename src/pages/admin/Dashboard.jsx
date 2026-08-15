import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/AdminLayout';
import { Search, Filter, Plus, Download, Upload, Package, ArrowRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = '/api';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalBeneficiaries: 0,
    pendingRSBSA: 0,
    activeInterventions: 0,
    activeDisasterReports: 0
  });

  useEffect(() => {
    fetchBeneficiaries();
  }, [searchQuery]);

  const fetchBeneficiaries = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = searchQuery 
        ? `${API_URL}/admin/beneficiaries?search=${encodeURIComponent(searchQuery)}`
        : `${API_URL}/admin/beneficiaries`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch beneficiaries');
      }

      const data = await response.json();
      setBeneficiaries(data.beneficiaries);
      setError(null);
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
      setError('Failed to load beneficiaries');
      // Use mock data as fallback
      setBeneficiaries([
        {
          id: 1,
          name: 'Juan Dela Cruz',
          rsbsaNumber: 'RSBSA - 0231',
          barangay: 'Poblacion',
          household: '3 members',
          intervention: 'DA - Seeds',
          status: 'Claimed'
        },
        {
          id: 2,
          name: 'Maria Santos',
          rsbsaNumber: 'RSBSA - 0198',
          barangay: 'Samoki',
          household: '1 member',
          intervention: 'LGU - Fertilizer',
          status: 'Claimed'
        },
        {
          id: 3,
          name: 'Pedro Reyes',
          rsbsaNumber: '(pending)',
          barangay: 'Bontoc Ili',
          household: '2 members',
          intervention: 'LGU - Newly Reg.',
          status: 'Unclaimed'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleBeneficiaryClick = (beneficiary) => {
    console.log('Clicked beneficiary:', beneficiary);
    // TODO: Navigate to beneficiary details page
  };

  const quickActions = [
    { label: 'Add User', icon: Plus, onClick: () => navigate('/admin/users') },
    { label: 'Export List', icon: Download, onClick: () => console.log('Export') },
    { label: 'Interventions', icon: ArrowRight, onClick: () => navigate('/admin/da-interventions') },
    { label: 'Upload Excel', icon: Upload, onClick: () => console.log('Upload Excel') },
    { label: 'Inventory', icon: Package, onClick: () => console.log('Inventory') },
    { label: 'Audit Trail', icon: FileText, onClick: () => navigate('/admin/audit-trail') },
  ];

  return (
    <AdminLayout 
      showHeader={false}
    >
      {/* Top Bar with User Info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-agapay-purple rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{user?.name?.charAt(0) || 'A'}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{user?.name}</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Greeting Section */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Hello, Admin</h1>
        <p className="text-base bg-gradient-to-r from-agapay-purple to-agapay-purpleDark bg-clip-text text-transparent font-semibold">
          Select an action to get started:
        </p>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-agapay-purple rounded-full font-semibold text-gray-800 hover:bg-agapay-lavender transition-all duration-200 shadow-sm text-sm"
            >
              <Icon size={16} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative bg-gradient-to-r from-agapay-purple to-agapay-purpleDark rounded-full p-1">
          <div className="flex items-center">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-white" size={18} />
            <input
              type="text"
              placeholder="Search beneficiary by name, RSBSA No., or barangay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-28 py-3 bg-transparent text-white placeholder-white/70 text-base focus:outline-none"
            />
            <button className="absolute right-1.5 px-5 py-1.5 bg-white text-gray-800 rounded-full font-semibold hover:bg-gray-100 transition-colors text-sm">
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Beneficiary Table Card */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          Loading beneficiaries...
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Beneficiary Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Card Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-agapay-purple/10 rounded-lg flex items-center justify-center">
                <Filter size={20} className="text-agapay-purple" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">All Beneficiaries</h2>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      RSBSA Number
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Barangay
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Household
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Intervention
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {beneficiaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No beneficiaries found
                      </td>
                    </tr>
                  ) : (
                    beneficiaries.map((beneficiary) => (
                      <tr
                        key={beneficiary.id}
                        onClick={() => handleBeneficiaryClick(beneficiary)}
                        className="hover:bg-agapay-lavender cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{beneficiary.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-600">{beneficiary.rsbsaNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-600">{beneficiary.barangay}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-600">{beneficiary.household}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-agapay-lavender text-agapay-purple">
                            {beneficiary.intervention}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            beneficiary.status === 'Claimed' 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {beneficiary.status || 'Unclaimed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </AdminLayout>
  );
}

export default AdminDashboard;
