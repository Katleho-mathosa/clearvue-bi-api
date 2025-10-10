// utils/simpleCalendar.js

/**
 * Simple quarter calculation
 */
function getSimpleQuarter(finPeriod) {
  if (!finPeriod) return 'Unknown';
  
  const periodStr = finPeriod.toString();
  if (periodStr.length !== 6) return 'Invalid';
  
  const year = periodStr.substring(0, 4);
  const month = parseInt(periodStr.substring(4, 6));
  
  if (month >= 1 && month <= 3) return `${year}-Q1`;
  if (month >= 4 && month <= 6) return `${year}-Q2`;
  if (month >= 7 && month <= 9) return `${year}-Q3`;
  if (month >= 10 && month <= 12) return `${year}-Q4`;
  
  return `${year}-Unknown`;
}

/**
 * Get latest financial period from data
 */
async function getLatestFinancialPeriod(db) {
  try {
    const latest = await db.collection('Sales_Header')
      .findOne({}, { sort: { FIN_PERIOD: -1 } });
    return latest ? latest.FIN_PERIOD : 202312;
  } catch (error) {
    console.error('Error getting latest period:', error);
    return 202312;
  }
}

module.exports = {
  getSimpleQuarter,
  getLatestFinancialPeriod
};