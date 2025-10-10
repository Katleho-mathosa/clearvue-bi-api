// utils/financialCalendar.js

/**
 * Calculate ClearVue's financial quarter from financial period
 * @param {number} finPeriod - Format: YYYYMM (e.g., 202501)
 * @returns {string} - Quarter in format "YYYY-Q1", "YYYY-Q2", etc.
 */
function getFinancialQuarter(finPeriod) {
  const periodStr = finPeriod.toString();
  const year = parseInt(periodStr.substring(0, 4));
  const month = parseInt(periodStr.substring(4, 6));
  
  // Map ClearVue's financial months to quarters
  // Assuming financial months align with calendar months for simplicity
  // Adjust this mapping based on ClearVue's actual financial calendar
  if (month >= 1 && month <= 3) return `${year}-Q1`;
  if (month >= 4 && month <= 6) return `${year}-Q2`;
  if (month >= 7 && month <= 9) return `${year}-Q3`;
  if (month >= 10 && month <= 12) return `${year}-Q4`;
  
  return `${year}-Unknown`;
}

/**
 * Check if a financial period is within year-to-date range
 * @param {number} finPeriod - Financial period to check
 * @param {number} currentPeriod - Current financial period
 * @returns {boolean}
 */
function isYearToDate(finPeriod, currentPeriod) {
  const periodStr = finPeriod.toString();
  const currentStr = currentPeriod.toString();
  
  const year = parseInt(periodStr.substring(0, 4));
  const currentYear = parseInt(currentStr.substring(0, 4));
  const month = parseInt(periodStr.substring(4, 6));
  const currentMonth = parseInt(currentStr.substring(4, 6));
  
  return year === currentYear && month <= currentMonth;
}

/**
 * Get current financial period (simulated - would be dynamic in production)
 * @returns {number}
 */
function getCurrentFinancialPeriod() {
  // For demo purposes, use the latest period in your data
  // In production, this would be dynamic based on current date
  return 202312; // Example - adjust based on your data
}

module.exports = {
  getFinancialQuarter,
  isYearToDate,
  getCurrentFinancialPeriod
};