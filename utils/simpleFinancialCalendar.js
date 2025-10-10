// utils/simpleFinancialCalendar.js

/**
 * SIMPLE VERSION: Calculate financial period using basic date logic
 * Financial month = last Saturday of previous month to last Friday of current month
 */
class SimpleFinancialCalendar {
  
  /**
   * Get last day of the month
   */
  static getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0);
  }

  /**
   * Get last specific weekday of the month
   */
  static getLastWeekdayOfMonth(year, month, targetDay) {
    const lastDay = this.getLastDayOfMonth(year, month);
    let lastWeekday = new Date(lastDay);
    
    // Go backwards until we find the target weekday
    while (lastWeekday.getDay() !== targetDay) {
      lastWeekday.setDate(lastWeekday.getDate() - 1);
    }
    
    return lastWeekday;
  }

  /**
   * Get financial period for a date (SIMPLE VERSION)
   */
  static getFinancialPeriod(date) {
    const inputDate = new Date(date);
    const year = inputDate.getFullYear();
    const month = inputDate.getMonth(); // 0-11
    
    // For prototype, we'll use a simplified approach
    // Financial month roughly corresponds to calendar month with some adjustment
    
    // Get approximate financial period
    let financialMonth = month + 1; // 1-12
    
    // Simple adjustment: if date is in first few days, it might belong to previous financial month
    // This is a simplified version for prototype
    if (inputDate.getDate() <= 5) {
      // Could be end of previous financial month
      // For prototype, we'll keep it simple and use current month
    }
    
    return `${year}-M${financialMonth.toString().padStart(2, '0')}`;
  }

  /**
   * Get financial quarter
   */
  static getFinancialQuarter(financialPeriod) {
    const [year, monthPart] = financialPeriod.split('-');
    const month = parseInt(monthPart.replace('M', ''));
    
    if (month >= 1 && month <= 3) return `${year}-Q1`;
    if (month >= 4 && month <= 6) return `${year}-Q2`;
    if (month >= 7 && month <= 9) return `${year}-Q3`;
    if (month >= 10 && month <= 12) return `${year}-Q4`;
    
    return `${year}-Unknown`;
  }

  /**
   * Test function to show how it works
   */
  static testCalendar() {
    const testDates = [
      new Date(2025, 0, 28),  // Jan 28
      new Date(2025, 0, 31),  // Jan 31
      new Date(2025, 1, 1),   // Feb 1
      new Date(2025, 1, 27),  // Feb 27
      new Date(2025, 1, 28),  // Feb 28
    ];
    
    console.log('🧪 Testing Financial Calendar Logic');
    console.log('='.repeat(50));
    
    testDates.forEach(date => {
      const period = this.getFinancialPeriod(date);
      const quarter = this.getFinancialQuarter(period);
      console.log(`${date.toDateString()} → ${period} → ${quarter}`);
    });
    
    return testDates.map(date => ({
      date: date.toDateString(),
      financialPeriod: this.getFinancialPeriod(date),
      quarter: this.getFinancialQuarter(this.getFinancialPeriod(date))
    }));
  }
}

module.exports = SimpleFinancialCalendar;