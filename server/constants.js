/**
 * Official AGAPAY Barangays
 * 
 * These are the only 16 valid barangays for the AGAPAY system.
 * All barangay dropdowns, validations, and data must use these exact values.
 */

export const OFFICIAL_BARANGAYS = [
  "Alab Oriente",
  "Alab Proper", 
  "Bayyo",
  "Balili",
  "Bontoc Ili",
  "Can-eo",
  "Caluttit",
  "Dalican",
  "Gonogon",
  "Guina-ang",
  "Mainit",
  "Maligcong",
  "Poblacion",
  "Samoki",
  "Talubin",
  "Tocucan"
];

/**
 * Validates if a barangay is one of the official 16 barangays
 * @param {string} barangay - The barangay to validate
 * @returns {boolean} True if the barangay is valid, false otherwise
 */
export function isValidBarangay(barangay) {
  if (!barangay || typeof barangay !== 'string') {
    return false;
  }
  return OFFICIAL_BARANGAYS.includes(barangay.trim());
}

/**
 * Gets an error message for invalid barangay
 * @returns {string} Validation error message
 */
export function getBarangayValidationError() {
  return "Invalid barangay. Please select one of the 16 official barangays.";
}