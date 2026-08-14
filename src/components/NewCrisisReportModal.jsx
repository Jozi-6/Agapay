import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

const CRISIS_TYPES = [
  'Typhoon',
  'Drought / El Niño',
  'Flood',
  'Earthquake',
  'Pest and Disease',
  'Water Crisis',
  'Other Agricultural Crisis'
];

const CROP_STAGES = [
  'Vegetative',
  'Reproductive',
  'Maturing',
  'Harvested'
];

const BARANGAYS = [
  'Poblacion', 'Samoki', 'Bontoc Ili', 'Ambasing', 'Asid', 'Balili', 
  'Calot', 'Dalupirip', 'Fidelisan', 'Kadaclan', 'Libacao', 
  'Maligcong', 'Tocdo', 'Dalang', 'Singil', 'Tambac'
];

export function NewCrisisReportModal({ isOpen, onClose, onSuccess }) {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [formData, setFormData] = useState({
    beneficiaryId: '',
    crisisType: '',
    crisisDate: new Date().toISOString().split('T')[0],
    barangay: '',
    farmLocation: '',
    cropType: '',
    cropStage: '',
    totalAreaHectares: '',
    damagedAreaHectares: '',
    productionLossMt: '',
    estimatedDamageCost: '',
    remarks: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      fetchBeneficiaries();
    }
  }, [isOpen]);

  const fetchBeneficiaries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/beneficiaries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setBeneficiaries(data.beneficiaries);
      }
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.beneficiaryId) {
      newErrors.beneficiaryId = 'Beneficiary is required';
    }

    if (!formData.crisisType) {
      newErrors.crisisType = 'Crisis type is required';
    }

    if (!formData.crisisDate) {
      newErrors.crisisDate = 'Crisis date is required';
    }

    if (!formData.barangay) {
      newErrors.barangay = 'Barangay is required';
    }

    if (!formData.cropType) {
      newErrors.cropType = 'Crop type is required';
    }

    if (!formData.totalAreaHectares || parseFloat(formData.totalAreaHectares) <= 0) {
      newErrors.totalAreaHectares = 'Total area must be greater than 0';
    }

    if (!formData.damagedAreaHectares || parseFloat(formData.damagedAreaHectares) <= 0) {
      newErrors.damagedAreaHectares = 'Damaged area must be greater than 0';
    }

    if (parseFloat(formData.damagedAreaHectares) > parseFloat(formData.totalAreaHectares)) {
      newErrors.damagedAreaHectares = 'Damaged area cannot exceed total area';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setMessage({ type: 'error', text: 'Please fix the errors in the form' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/crisis-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          beneficiaryId: parseInt(formData.beneficiaryId),
          crisisType: formData.crisisType,
          crisisDate: formData.crisisDate,
          barangay: formData.barangay,
          farmLocation: formData.farmLocation,
          cropType: formData.cropType,
          cropStage: formData.cropStage,
          totalAreaHectares: parseFloat(formData.totalAreaHectares),
          damagedAreaHectares: parseFloat(formData.damagedAreaHectares),
          productionLossMt: formData.productionLossMt ? parseFloat(formData.productionLossMt) : 0,
          estimatedDamageCost: formData.estimatedDamageCost ? parseFloat(formData.estimatedDamageCost) : 0,
          remarks: formData.remarks
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to create crisis report' });
        return;
      }

      setMessage({ type: 'success', text: 'Crisis report created successfully!' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error creating crisis report:', error);
      setMessage({ type: 'error', text: 'Failed to create crisis report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-agapay-purple to-agapay-blue p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-white">New Crisis / Crop Damage Report</h2>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Beneficiary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beneficiary <span className="text-red-500">*</span>
            </label>
            <select
              name="beneficiaryId"
              value={formData.beneficiaryId}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                errors.beneficiaryId ? 'border-red-500' : 'border-gray-200'
              }`}
            >
              <option value="">Select a beneficiary</option>
              {beneficiaries.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.beneficiaryId && (
              <p className="text-red-500 text-sm mt-1">{errors.beneficiaryId}</p>
            )}
          </div>

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crisis Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crisis Type <span className="text-red-500">*</span>
              </label>
              <select
                name="crisisType"
                value={formData.crisisType}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                  errors.crisisType ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <option value="">Select crisis type</option>
                {CRISIS_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.crisisType && (
                <p className="text-red-500 text-sm mt-1">{errors.crisisType}</p>
              )}
            </div>

            {/* Crisis Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crisis Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="crisisDate"
                value={formData.crisisDate}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                  errors.crisisDate ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.crisisDate && (
                <p className="text-red-500 text-sm mt-1">{errors.crisisDate}</p>
              )}
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Barangay */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barangay <span className="text-red-500">*</span>
              </label>
              <select
                name="barangay"
                value={formData.barangay}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                  errors.barangay ? 'border-red-500' : 'border-gray-200'
                }`}
              >
                <option value="">Select barangay</option>
                {BARANGAYS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {errors.barangay && (
                <p className="text-red-500 text-sm mt-1">{errors.barangay}</p>
              )}
            </div>

            {/* Farm Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Farm Location
              </label>
              <input
                type="text"
                name="farmLocation"
                value={formData.farmLocation}
                onChange={handleInputChange}
                placeholder="e.g., Poblacion Farm"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crop Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crop Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="cropType"
                value={formData.cropType}
                onChange={handleInputChange}
                placeholder="e.g., Rice, Cabbage"
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                  errors.cropType ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.cropType && (
                <p className="text-red-500 text-sm mt-1">{errors.cropType}</p>
              )}
            </div>

            {/* Crop Stage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crop Stage
              </label>
              <select
                name="cropStage"
                value={formData.cropStage}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
              >
                <option value="">Select crop stage</option>
                {CROP_STAGES.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Total Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Farm Area (hectares) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="totalAreaHectares"
                value={formData.totalAreaHectares}
                onChange={handleInputChange}
                placeholder="e.g., 1.20"
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                  errors.totalAreaHectares ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.totalAreaHectares && (
                <p className="text-red-500 text-sm mt-1">{errors.totalAreaHectares}</p>
              )}
            </div>

            {/* Damaged Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Damaged Area (hectares) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="damagedAreaHectares"
                value={formData.damagedAreaHectares}
                onChange={handleInputChange}
                placeholder="e.g., 0.80"
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                  errors.damagedAreaHectares ? 'border-red-500' : 'border-gray-200'
                }`}
              />
              {errors.damagedAreaHectares && (
                <p className="text-red-500 text-sm mt-1">{errors.damagedAreaHectares}</p>
              )}
            </div>
          </div>

          {/* Row 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Production Loss */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Production Loss (MT)
              </label>
              <input
                type="number"
                step="0.01"
                name="productionLossMt"
                value={formData.productionLossMt}
                onChange={handleInputChange}
                placeholder="e.g., 2.4"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
              />
            </div>

            {/* Estimated Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Cost of Damage (₱)
              </label>
              <input
                type="number"
                step="1"
                name="estimatedDamageCost"
                value={formData.estimatedDamageCost}
                onChange={handleInputChange}
                placeholder="e.g., 72000"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks / Description
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              placeholder="Additional information about the crisis/damage..."
              rows="4"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 border-t border-gray-200 pt-6">
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-agapay-purple to-agapay-blue text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Submitting...
                </>
              ) : (
                'Submit Damage Report'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
