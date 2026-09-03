// Department of Agriculture (DA) Interventions
export const DA_INTERVENTIONS = [
  'PAFF', // Presidential Assistance to Farmers, Fisherfolk, and Families
  'RFFA', // Rice Farmers Financial Assistance
  'Organic Liquid Fertilizer',
  'Certified Rice Seeds',
  'Complete Fertilizer',
  'HDPE Pipes',
  'Molasses',
  'Agricultural Machinery',
  'Other DA Production Inputs'
];

// Municipal Local Government Unit (MLGU) Interventions
export const MLGU_INTERVENTIONS = [
  'Complete Fertilizer',
  'Other Locally Funded Program',
  'Other Locally Funded Agricultural Production Inputs'
];

// Intervention source types
export const INTERVENTION_SOURCES = {
  DA: 'DA',
  MLGU: 'MLGU'
};

// Helper function to get interventions by source
export function getInterventionsBySource(source) {
  if (source === INTERVENTION_SOURCES.DA) {
    return DA_INTERVENTIONS;
  } else if (source === INTERVENTION_SOURCES.MLGU) {
    return MLGU_INTERVENTIONS;
  }
  return [];
}

// Validate intervention name and source combination
export function isValidInterventionForSource(interventionName, source) {
  const validInterventions = getInterventionsBySource(source);
  return validInterventions.includes(interventionName);
}