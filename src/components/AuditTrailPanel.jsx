import { useState, useEffect } from 'react';
import { Search, Filter, FileText, X, ChevronDown } from 'lucide-react';

import { API_URL } from '../config/api.js';

export function AuditTrailPanel() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [availableActions, setAvailableActions] = useState([]);
  const [filters, setFilters] = useState({
    username: '',
    action: 'All',
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, [filters]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.username) params.append('username', filters.username);
      if (filters.action && filters.action !== 'All') params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('limit', '20');
      
      const url = `${API_URL}/admin/audit-trail${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit trail');
      }

      const data = await response.json();
      setAuditLogs(data.auditLogs);
      setAvailableActions(['All', ...data.actions]);
      setError(null);
    } catch (err) {
      console.error('Error fetching audit trail:', err);
      setError('Failed to load audit trail');
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      username: '',
      action: 'All',
      startDate: '',
      endDate: ''
    });
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const hasActiveFilters = filters.username || filters.action !== 'All' || filters.startDate || filters.endDate;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-agapay-purple" />
            <h2 className="text-lg font-semibold text-gray-800">Audit Trail</h2>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Filter size={16} />
            Filters
            <ChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search by User */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search by User
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Enter username..."
                  value={filters.username}
                  onChange={(e) => handleFilterChange('username', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent bg-white text-sm"
              >
                {availableActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent text-sm"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent text-sm"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={16} />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading audit trail...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">
            {error}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No audit records found.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-agapay-purple text-white rounded-lg hover:bg-agapay-purpleDark transition-colors text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Record Affected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatTimestamp(log.created_at)}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.username}</div>
                    <div className="text-xs text-gray-500">{log.user_role}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                    {log.action}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {log.record_affected || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View All Button */}
      {auditLogs.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button className="w-full text-center text-sm text-agapay-purple hover:text-agapay-purpleDark font-medium transition-colors">
            View Full Audit Trail
          </button>
        </div>
      )}
    </div>
  );
}
