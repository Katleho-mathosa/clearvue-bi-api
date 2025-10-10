const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const SalesHeader = db.collection('Sales_Header');

    // 🧮 Calculate financial period: "Last Saturday → Last Friday" rule
    function getFinancialPeriod(date) {
      if (!date || isNaN(new Date(date))) return null;

      const d = new Date(date);

      // find the Friday on or before the given date
      const friday = new Date(d);
      friday.setDate(friday.getDate() - ((friday.getDay() + 2) % 7));

      const year = friday.getFullYear();
      const month = (friday.getMonth() + 1).toString().padStart(2, '0');
      return parseInt(`${year}${month}`);
    }

    const cursor = SalesHeader.find({});
    let updatedCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const correctPeriod = getFinancialPeriod(doc.DOC_DATE);

      if (correctPeriod && doc.calculated_FIN_PERIOD !== correctPeriod) {
        await SalesHeader.updateOne(
          { _id: doc._id },
          { $set: { calculated_FIN_PERIOD: correctPeriod } }
        );
        updatedCount++;
        console.log(
          `✅ Updated DOC_NUMBER ${doc.DOC_NUMBER}: ${doc.calculated_FIN_PERIOD} → ${correctPeriod}`
        );
      }
    }

    console.log(`🔧 Finished. Total rows updated: ${updatedCount}`);
    await mongoose.disconnect();
    process.exit();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
