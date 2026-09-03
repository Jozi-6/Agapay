import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { OFFICIAL_BARANGAYS } from '../../constants/barangays.js';
import { DA_INTERVENTIONS, MLGU_INTERVENTIONS } from '../../constants/interventions.js';

import { API_URL } from '../../config/api.js';

export function UpdateBeneficiaryModal({ isOpen, onClose, beneficiary, onSuccess }) {
  const [formData, setFormData] = useState({
    status: '',
    customInterventionName: '',
    quantityReceived: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (beneficiary && isOpen) {
      setFormData({
        status: beneficiary.status || 'Unclaimed',
        customInterventionName: beneficiary.custom_intervention_name || '',
        quantityReceived: beneficiary.quantityReceived || ''
      });
    }
  }, [beneficiary, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/data-encoder/beneficiaries/${beneficiary.id}/intervention`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || data.message || 'Failed to update beneficiary' });
        return;
      }

      setMessage({ type: 'success', text: 'Beneficiary updated successfully!' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error updating beneficiary:', error);
      setMessage({ type: 'error', text: 'Failed to update beneficiary. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isMLGU = beneficiary?.intervention_type === 'LGU';
  const isOtherIntervention =
    beneficiary?.intervention_name === 'Other Locally Funded Program' ||
    beneficiary?.intervention_name === 'Other Locally Funded Agricultural Production Inputs';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-white">Update Beneficiary Intervention</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Messages */}
        {message.text && (
          <div className={`mx-6 mt-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Beneficiary Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Beneficiary Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>
              <span className="ml-2 font-medium text-gray-900">{beneficiary?.name}</span>
            </div>
            <div>
              <span className="text-gray-500">RSBSA Number:</span>
              <span className="ml-2 font-medium text-gray-900">{beneficiary?.rsbsaNumber}</span>
            </div>
            <div>
              <span className="text-gray-500">Barangay:</span>
              <span className="ml-2 font-medium text-gray-900">{beneficiary?.barangay}</span>
            </div>
            <div>
              <span className="text-gray-500">Source:</span>
              <span className="ml-2 font-medium text-gray-900">{beneficiary?.intervention_type === 'DA' ? 'DA' : 'MLGU'}</span>
            </div>
            <div>
              <span className="text-gray-500">Current Intervention:</span>
              <span className="ml-2 font-medium text-gray-900">{beneficiary?.intervention}</span>
            </div>
            <div>
              <span className="text-gray-500">Current Status:</span>
              <span className="ml-2 font-medium text-gray-900">{beneficiary?.status}</span>
            </div>
          </div>
        </div>

        {/* Update Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Update Intervention Information</h3>
          
          <div className="space-y-4">
            {/* Claim Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Claim Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                <option value="Unclaimed">Unclaimed</option>
                <option value="Claimed">Claimed</option>
              </select>
            </div>

            {/* Custom MLGU Intervention */}
            {isMLGU && isOtherIntervention && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type of Intervention Claimed
                </label>
                <input
                  type="text"
                  value={formData.customInterventionName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customInterventionName: e.target.value }))}
                  placeholder="e.g., Vegetable Seeds, Livestock Feed, Farm Tools"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Specify the actual MLGU intervention that was claimed
                </p>
              </div>
            )}

            {/* Quantity Received */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity Received (Optional)
              </label>
              <input
                type="number"
                value={formData.quantityReceived}
                onChange={(e) => setFormData(prev => ({ ...prev, quantityReceived: e.target.value }))}
                placeholder="Enter quantity if applicable"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only record quantity if it was actually measured
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 mt-8 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Updating...
                </>
              ) : (
                <>
                  Save Update
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
