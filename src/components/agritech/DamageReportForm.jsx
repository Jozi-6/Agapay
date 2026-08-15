import { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, MapPin, Search } from 'lucide-react';
import {
  DISASTER_OPTIONS,
  BARANGAY_OPTIONS,
  CROP_OPTIONS,
  CROP_STAGE_OPTIONS,
  DEFAULT_DISASTER,
} from './constants';

const API_URL = '/api';

const initialForm = {
  disaster: DEFAULT_DISASTER,
  barangay: '',
  beneficiaryId: '',
  farmerName: '',
  farmLocation: '',
  cropType: '',
  cropStage: '',
  totalArea: '',
  partialArea: '',
  latitude: '',
  longitude: '',
};

function AgritechField({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

export function DamageReportForm({ onSubmit }) {
  const [formData, setFormData] = useState(initialForm);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [photos, setPhotos] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    fetchBeneficiaries();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBeneficiaries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agritech/beneficiaries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBeneficiaries(data.beneficiaries);
      }
    } catch (err) {
      console.error('Error fetching beneficiaries:', err);
    }
  };

  const filteredBeneficiaries = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return beneficiaries.filter((beneficiary) => {
      const haystack = `${beneficiary.name} ${beneficiary.rsbsaNumber || ''} ${beneficiary.barangay || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [beneficiaries, searchQuery]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectBeneficiary = (beneficiary) => {
    setFormData((prev) => ({
      ...prev,
      beneficiaryId: String(beneficiary.id),
      farmerName: beneficiary.name,
      barangay: prev.barangay || beneficiary.barangay || '',
    }));
    setSearchQuery(beneficiary.name);
    setIsSearchOpen(false);
  };

  const handleFarmerNameChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    setFormData((prev) => ({ ...prev, farmerName: value, beneficiaryId: '' }));
    setIsSearchOpen(true);
    if (errors.farmerName) {
      setErrors((prev) => ({ ...prev, farmerName: '' }));
    }
  };

  const handlePhotoAdd = (event) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => file.type.startsWith('image/'));
    setPhotos((prev) => [...prev, ...validFiles].slice(0, 5));
    event.target.value = '';
  };

  const handlePhotoRemove = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.farmerName.trim()) {
      newErrors.farmerName = 'Farmer / Beneficiary name is required';
    }

    if (!formData.barangay) {
      newErrors.barangay = 'Barangay is required';
    }

    if (!formData.latitude.trim()) {
      newErrors.latitude = 'Latitude is required';
    } else {
      const latitude = parseFloat(formData.latitude);
      if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
        newErrors.latitude = 'Latitude must be between -90 and 90';
      }
    }

    if (!formData.longitude.trim()) {
      newErrors.longitude = 'Longitude is required';
    } else {
      const longitude = parseFloat(formData.longitude);
      if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
        newErrors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    if (formData.totalArea && formData.partialArea) {
      const total = parseFloat(formData.totalArea);
      const partial = parseFloat(formData.partialArea);
      if (Number.isNaN(total) || Number.isNaN(partial) || partial > total) {
        newErrors.partialArea = 'Partial area cannot exceed total area';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      setMessage({ type: 'error', text: 'Please fix the errors in the form before submitting.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const formPayload = new FormData();

      formPayload.append('disaster', formData.disaster);
      formPayload.append('barangay', formData.barangay);
      formPayload.append('farmerName', formData.farmerName.trim());
      if (formData.beneficiaryId) formPayload.append('beneficiaryId', formData.beneficiaryId);
      formPayload.append('farmLocation', formData.farmLocation.trim());
      formPayload.append('cropType', formData.cropType);
      formPayload.append('cropStage', formData.cropStage);
      if (formData.totalArea) formPayload.append('totalArea', formData.totalArea);
      if (formData.partialArea) formPayload.append('partialArea', formData.partialArea);
      formPayload.append('latitude', formData.latitude.trim());
      formPayload.append('longitude', formData.longitude.trim());
      photos.forEach((photo) => formPayload.append('photos', photo));

      const response = await fetch(`${API_URL}/agritech/damage-reports`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formPayload,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to submit damage report' });
        return;
      }

      setMessage({ type: 'success', text: 'Damage report submitted successfully! ✓' });
      if (onSubmit) onSubmit(data);

      setFormData(initialForm);
      setPhotos([]);
      setSearchQuery('');
      setErrors({});
    } catch (error) {
      console.error('Error submitting damage report:', error);
      setMessage({ type: 'error', text: 'Failed to submit damage report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const inputBaseClass = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-agapay-purple focus:border-transparent transition-all text-sm';
  const inputErrorClass = 'border-red-500 focus:ring-red-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Status Messages */}
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-100 text-green-700 border border-green-200'
            : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Disaster & Barangay */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AgritechField label="Disaster" required>
          <select
            name="disaster"
            value={formData.disaster}
            onChange={handleInputChange}
            className={`${inputBaseClass} ${errors.disaster ? inputErrorClass : ''}`}
          >
            {DISASTER_OPTIONS.map((disaster) => (
              <option key={disaster} value={disaster}>{disaster}</option>
            ))}
          </select>
        </AgritechField>

        <AgritechField label="Barangay" required error={errors.barangay}>
          <select
            name="barangay"
            value={formData.barangay}
            onChange={handleInputChange}
            className={`${inputBaseClass} ${errors.barangay ? inputErrorClass : ''}`}
          >
            <option value="">Select barangay</option>
            {BARANGAY_OPTIONS.map((barangay) => (
              <option key={barangay} value={barangay}>{barangay}</option>
            ))}
          </select>
        </AgritechField>
      </div>

      {/* Farmer / Beneficiary */}
      <AgritechField label="Farmer / Beneficiary" required error={errors.farmerName}>
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleFarmerNameChange}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Type a name, RSBSA No., or barangay..."
            className={`${inputBaseClass} ${inputErrorClass ? '' : ''} pl-10`}
          />
          {isSearchOpen && filteredBeneficiaries.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {filteredBeneficiaries.map((beneficiary) => (
                <li key={beneficiary.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectBeneficiary(beneficiary)}
                    className="w-full text-left px-4 py-2.5 hover:bg-agapay-lavender transition-colors"
                  >
                    <span className="block text-sm font-medium text-gray-800">{beneficiary.name}</span>
                    <span className="block text-xs text-gray-500">
                      {beneficiary.rsbsaNumber || 'No RSBSA'} · {beneficiary.barangay}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isSearchOpen && filteredBeneficiaries.length === 0 && (
            <p className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
              No matching beneficiaries. You can type the name manually.
            </p>
          )}
        </div>
      </AgritechField>

      {/* Crop / Farm Location & Crop Stage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AgritechField label="Crop / Farm Location">
          <select
            name="cropType"
            value={formData.cropType}
            onChange={handleInputChange}
            className={inputBaseClass}
          >
            <option value="">Select crop</option>
            {CROP_OPTIONS.map((crop) => (
              <option key={crop} value={crop}>{crop}</option>
            ))}
          </select>
        </AgritechField>

        <AgritechField label="Farm Location">
          <input
            type="text"
            name="farmLocation"
            value={formData.farmLocation}
            onChange={handleInputChange}
            placeholder="e.g., Poblacion Farm"
            className={inputBaseClass}
          />
        </AgritechField>

        <AgritechField label="Crop Stage">
          <select
            name="cropStage"
            value={formData.cropStage}
            onChange={handleInputChange}
            className={inputBaseClass}
          >
            <option value="">Select stage</option>
            {CROP_STAGE_OPTIONS.map((stage) => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </AgritechField>
      </div>

      {/* Area Coverage */}
      <AgritechField label="Area Coverage">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Total Area (ha)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="totalArea"
              value={formData.totalArea}
              onChange={handleInputChange}
              placeholder="e.g., 1.20"
              className={inputBaseClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Partial / Damaged Area (ha) {errors.partialArea && (
                <span className="text-red-500 text-xs font-normal"> - {errors.partialArea}</span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="partialArea"
              value={formData.partialArea}
              onChange={handleInputChange}
              placeholder="e.g., 0.80"
              className={`${inputBaseClass} ${errors.partialArea ? inputErrorClass : ''}`}
            />
          </div>
        </div>
      </AgritechField>

      {/* GPS Coordinates */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={16} className="text-agapay-purple" />
          <label className="text-sm font-medium text-gray-700">
            GPS Coordinates <span className="text-red-500">*</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AgritechField label="Latitude" required error={errors.latitude}>
            <input
              type="number"
              step="0.0001"
              name="latitude"
              value={formData.latitude}
              onChange={handleInputChange}
              placeholder="e.g., 17.0894"
              className={`${inputBaseClass} ${errors.latitude ? inputErrorClass : ''}`}
            />
          </AgritechField>
          <AgritechField label="Longitude" required error={errors.longitude}>
            <input
              type="number"
              step="0.0001"
              name="longitude"
              value={formData.longitude}
              onChange={handleInputChange}
              placeholder="e.g., 120.9750"
              className={`${inputBaseClass} ${errors.longitude ? inputErrorClass : ''}`}
            />
          </AgritechField>
        </div>
      </div>

      {/* Photo / Attachment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photo / Site Attachment
        </label>
        <div className="flex items-center justify-center w-full">
          <label className="w-full flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-agapay-purple hover:bg-agapay-lavender transition-colors">
            <Upload size={24} className="text-agapay-purple mb-2" />
            <span className="text-sm font-medium text-gray-700">Click to upload site photos</span>
            <span className="text-xs text-gray-500 mt-1">JPG, PNG up to 5 images (proof of damage)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoAdd}
              className="hidden"
            />
          </label>
        </div>
        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Site photo ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => handlePhotoRemove(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                  title="Remove photo"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setFormData(initialForm);
            setPhotos([]);
            setSearchQuery('');
            setErrors({});
            setMessage({ type: '', text: '' });
          }}
          disabled={loading}
          className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Form
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-6 py-3 bg-agapay-purple text-white font-bold rounded-xl hover:bg-agapay-purpleDark transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              Submitting...
            </>
          ) : (
            'Submit Damage Report'
          )}
        </button>
      </div>
    </form>
  );
}
