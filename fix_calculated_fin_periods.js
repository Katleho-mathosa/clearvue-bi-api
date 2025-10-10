const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const SalesHeader = db.collection('Sales_Header');

    function lastSaturday(date) {
      const d = new Date(date);
      d.setDate(0); // last day of previous month
      while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
      return d;
    }

    function lastFriday(date) {
      const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
      return d;
    }

    function calculateFIN_PERIOD(date) {
      const lastSatPrev = lastSaturday(date);
      const lastFriCurr = lastFriday(date);
      const year = lastFriCurr.getFullYear();
      const month = lastFriCurr.getMonth() + 1;
      return parseInt(`${year}${month.toString().padStart(2, '0')}`);
    }

    // FIND all documents and fix incorrect calculated_FIN_PERIOD
    const cursor = SalesHeader.find({});
    let updatedCount = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const docDate = new Date(doc.DOC_DATE);
      const correctPeriod = calculateFIN_PERIOD(docDate);

      if (doc.calculated_FIN_PERIOD !== correctPeriod) {
        await SalesHeader.updateOne(
          { _id: doc._id },
          { $set: { calculated_FIN_PERIOD: correctPeriod } }
        );
        updatedCount++;
        console.log(`✅ Updated DOC_NUMBER ${doc.DOC_NUMBER}: ${doc.calculated_FIN_PERIOD} → ${correctPeriod}`);
      }
    }

    console.log(`🔧 Finished. Total rows updated: ${updatedCount}`);
    process.exit();
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();
