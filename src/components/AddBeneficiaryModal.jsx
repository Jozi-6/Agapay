import { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

const API_URL = 'http://localhost:3001/api';
const BARANGAYS = [
  'Poblacion', 'Samoki', 'Bontoc Ili', 'Ambasing', 'Asid', 'Balili', 
  'Calot', 'Dalupirip', 'Fidelisan', 'Kadaclan', 'Libacao', 
  'Maligcong', 'Tocdo', 'Dalang', 'Singil', 'Tambac'
];

export function AddBeneficiaryModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthdate: '',
    age: '',
    address: '',
    barangay: '',
    contactNumber: '',
    farmLocation: '',
    cropType: '',
    rsbsaNumber: '',
    lguIntervention: '',
    interventionStatus: 'Unclaimed',
    interventionDate: new Date().toISOString().split('T')[0],
    household: '1 member'
  });

  const [lguInterventions, setLguInterventions] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen) {
      fetchLguInterventions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.birthdate) {
      calculateAge(formData.birthdate);
    }
  }, [formData.birthdate]);

  const fetchLguInterventions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/interventions-list?type=LGU`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLguInterventions(data.interventions);
      }
    } catch (err) {
      console.error('Error fetching LGU interventions:', err);
    }
  };

  const calculateAge = (birthdate) => {
    const birthDateObj = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }
    setFormData(prev => ({ ...prev, age: age.toString() }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.birthdate) {
      newErrors.birthdate = 'Birthdate is required';
    } else {
      const age = parseInt(formData.age);
      if (age < 18) {
        newErrors.age = 'Beneficiary must be 18 years old or above';
      }
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.barangay) {
      newErrors.barangay = 'Barangay is required';
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (!/^09\d{2}-\d{3}-\d{4}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = 'Contact number must be in format 09XX-XXX-XXXX';
    }

    if (!formData.lguIntervention) {
      newErrors.lguIntervention = 'LGU Intervention is required';
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
      const response = await fetch(`${API_URL}/admin/add-beneficiary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to add beneficiary' });
        return;
      }

      setMessage({ type: 'success', text: 'Beneficiary added successfully!' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error adding beneficiary:', error);
      setMessage({ type: 'error', text: 'Failed to add beneficiary. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-agapay-purple to-agapay-blue p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-white">Add Beneficiary to LGU Intervention</h2>
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
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Juan"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.firstName ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
                )}
              </div>

              {/* Middle Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Middle Name
                </label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  placeholder="Abenoja"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Dela Cruz"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.lastName ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
                )}
              </div>

              {/* Birthdate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Birthdate <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.birthdate ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {errors.birthdate && (
                  <p className="text-red-500 text-sm mt-1">{errors.birthdate}</p>
                )}
              </div>

              {/* Age (Display) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                </label>
                <input
                  type="text"
                  value={formData.age}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 focus:outline-none text-gray-500"
                />
                {errors.age && (
                  <p className="text-red-500 text-sm mt-1">{errors.age}</p>
                )}
              </div>

              {/* RSBSA Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RSBSA Number
                </label>
                <input
                  type="text"
                  name="rsbsaNumber"
                  value={formData.rsbsaNumber}
                  onChange={handleInputChange}
                  placeholder="RSBSA-XXXX"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="House No / Purok / Street"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.address ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {errors.address && (
                  <p className="text-red-500 text-sm mt-1">{errors.address}</p>
                )}
              </div>

              {/* Barangay */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barangay <span className="text-red-500">*</span>
                </label>
                <select
                  name="barangay"
                  value={formData.barangay}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.barangay ? 'border-red-500' : 'border-gray-200'
                  }`}
                >
                  <option value="">Select Barangay</option>
                  {BARANGAYS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                {errors.barangay && (
                  <p className="text-red-500 text-sm mt-1">{errors.barangay}</p>
                )}
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  placeholder="09XX-XXX-XXXX"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.contactNumber ? 'border-red-500' : 'border-gray-200'
                  }`}
                />
                {errors.contactNumber && (
                  <p className="text-red-500 text-sm mt-1">{errors.contactNumber}</p>
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
                  placeholder="Poblacion (1.5 hectares)"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                />
              </div>

              {/* Crop Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Crop Type
                </label>
                <input
                  type="text"
                  name="cropType"
                  value={formData.cropType}
                  onChange={handleInputChange}
                  placeholder="Cabbage"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* LGU Intervention Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">LGU Intervention Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LGU Intervention */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  LGU Intervention <span className="text-red-500">*</span>
                </label>
                <select
                  name="lguIntervention"
                  value={formData.lguIntervention}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all ${
                    errors.lguIntervention ? 'border-red-500' : 'border-gray-200'
                  }`}
                >
                  <option value="">Select LGU Intervention</option>
                  {lguInterventions.map(intervention => (
                    <option key={intervention} value={intervention}>{intervention}</option>
                  ))}
                </select>
                {errors.lguIntervention && (
                  <p className="text-red-500 text-sm mt-1">{errors.lguIntervention}</p>
                )}
              </div>

              {/* Intervention Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  name="interventionStatus"
                  value={formData.interventionStatus}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                >
                  <option value="Unclaimed">Unclaimed</option>
                  <option value="Claimed">Claimed</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              {/* Intervention Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervention Date
                </label>
                <input
                  type="date"
                  name="interventionDate"
                  value={formData.interventionDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                />
              </div>

              {/* Household */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Household
                </label>
                <input
                  type="text"
                  name="household"
                  value={formData.household}
                  onChange={handleInputChange}
                  placeholder="e.g., 3 members"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-agapay-lavender/30 focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all"
                />
              </div>
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-agapay-purple to-agapay-blue text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Submitting...
                </>
              ) : (
                <>
                  + Submit Registration
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddBeneficiaryModal;
