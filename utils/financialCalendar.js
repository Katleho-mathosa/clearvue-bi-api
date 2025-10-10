// utils/financialCalendar.js

/**
 * Calculate the last Saturday of a given month
 * @param {Date} date - Any date in the target month
 * @returns {Date} - Last Saturday of the month
 */
function getLastSaturdayOfMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Start from the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastDay.getDay(); // 0=Sunday, 6=Saturday
  
  // Calculate how many days to go back to reach Saturday (6)
  let daysToSubtract = (lastDayOfWeek + 1) % 7; // +1 because we want Saturday (6), not Sunday (0)
  if (daysToSubtract === 0) daysToSubtract = 6; // If it's already Saturday, no subtraction needed
  
  const lastSaturday = new Date(lastDay);
  lastSaturday.setDate(lastDay.getDate() - daysToSubtract);
  
  return lastSaturday;
}

/**
 * Calculate the last Friday of a given month
 * @param {Date} date - Any date in the target month
 * @returns {Date} - Last Friday of the month
 */
function getLastFridayOfMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Start from the last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastDay.getDay(); // 0=Sunday, 6=Saturday
  
  // Calculate how many days to go back to reach Friday (5)
  let daysToSubtract = (lastDayOfWeek + 2) % 7; // +2 because we want Friday (5)
  if (daysToSubtract === 0) daysToSubtract = 6;
  
  const lastFriday = new Date(lastDay);
  lastFriday.setDate(lastDay.getDate() - daysToSubtract);
  
  return lastFriday;
}

/**
 * Get ClearVue's financial period for a given date
 * Financial month = last Saturday of previous month to last Friday of current month
 * @param {Date} inputDate - The date to check
 * @returns {string} - Financial period in format "YYYY-MM" (e.g., "2025-M08")
 */
function getFinancialPeriod(inputDate) {
  const date = new Date(inputDate);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0=January, 11=December
  
  // Get financial month boundaries
  const currentMonth = new Date(year, month, 15); // Middle of current month
  const previousMonth = new Date(year, month - 1, 15); // Middle of previous month
  
  const financialMonthStart = getLastSaturdayOfMonth(previousMonth);
  const financialMonthEnd = getLastFridayOfMonth(currentMonth);
  
  // Adjust times to start/end of day
  financialMonthStart.setHours(0, 0, 0, 0);
  financialMonthEnd.setHours(23, 59, 59, 999);
  
  // Check if date falls within this financial month
  if (date >= financialMonthStart && date <= financialMonthEnd) {
    // Date is in the financial month that corresponds to the calendar month
    const financialMonth = month + 1; // Convert to 1-12
    return `${year}-M${financialMonth.toString().padStart(2, '0')}`;
  } else if (date < financialMonthStart) {
    // Date is in previous financial month
    const prevMonthDate = new Date(date);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    return getFinancialPeriod(prevMonthDate);
  } else {
    // Date is in next financial month
    const nextMonthDate = new Date(date);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    return getFinancialPeriod(nextMonthDate);
  }
}

/**
 * Get financial quarter for a given financial period
 * @param {string} financialPeriod - Format "YYYY-MM"
 * @returns {string} - Quarter in format "YYYY-Q1", "YYYY-Q2", etc.
 */
function getFinancialQuarter(financialPeriod) {
  const [year, monthPart] = financialPeriod.split('-');
  const month = parseInt(monthPart.replace('M', ''));
  
  if (month >= 1 && month <= 3) return `${year}-Q1`;
  if (month >= 4 && month <= 6) return `${year}-Q2`;
  if (month >= 7 && month <= 9) return `${year}-Q3`;
  if (month >= 10 && month <= 12) return `${year}-Q4`;
  
  return `${year}-Unknown`;
}

/**
 * Get financial period boundaries for a given financial period
 * @param {string} financialPeriod - Format "YYYY-MM"
 * @returns {Object} - { start: Date, end: Date }
 */
function getFinancialPeriodBoundaries(financialPeriod) {
  const [yearStr, monthPart] = financialPeriod.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthPart.replace('M', '')) - 1; // Convert to 0-11
  
  const currentMonth = new Date(year, month, 15);
  const previousMonth = new Date(year, month - 1, 15);
  
  const start = getLastSaturdayOfMonth(previousMonth);
  const end = getLastFridayOfMonth(currentMonth);
  
  // Set times
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Test function to display financial calendar for a year
 * @param {number} year - The year to display
 */
function displayFinancialCalendar(year) {
  console.log(`\n📅 ClearVue Financial Calendar ${year}`);
  console.log('=' .repeat(50));
  
  for (let month = 0; month < 12; month++) {
    const currentMonth = new Date(year, month, 15);
    const previousMonth = new Date(year, month - 1, 15);
    
    const start = getLastSaturdayOfMonth(previousMonth);
    const end = getLastFridayOfMonth(currentMonth);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    console.log(`${monthNames[month].padEnd(12)}: ${start.toDateString()} to ${end.toDateString()}`);
  }
}

// Test the implementation
if (require.main === module) {
  console.log('🧪 Testing ClearVue Financial Calendar Logic');
  console.log('=' .repeat(50));
  
  // Test specific examples from ClearVue's requirement
  const testDates = [
    new Date(2025, 0, 28),  // January 28, 2025
    new Date(2025, 0, 31),  // January 31, 2025  
    new Date(2025, 1, 1),   // February 1, 2025
    new Date(2025, 1, 27),  // February 27, 2025
    new Date(2025, 1, 28),  // February 28, 2025
    new Date(2025, 2, 1)    // March 1, 2025
  ];
  
  testDates.forEach(date => {
    const financialPeriod = getFinancialPeriod(date);
    console.log(`${date.toDateString()} → Financial Period: ${financialPeriod}`);
  });
  
  displayFinancialCalendar(2025);
}

module.exports = {
  getFinancialPeriod,
  getFinancialQuarter,
  getFinancialPeriodBoundaries,
  getLastSaturdayOfMonth,
  getLastFridayOfMonth,
  displayFinancialCalendar
};