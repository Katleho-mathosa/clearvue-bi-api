require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

async function simulateRealtimeSales() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('RealTime_Transactions');

    setInterval(async () => {
      const now = new Date();
      const newSale = {
        transaction_id: `SIM-${now.getTime()}`,
        customer_number: `CUST-${Math.floor(Math.random() * 1000)}`,
        amount: parseFloat((Math.random() * 5000 + 100).toFixed(2)),
        product_code: `PROD-${Math.floor(Math.random() * 100)}`,
        createdAt: now,
        status: 'completed',
        simulation_note: 'Simulated real-time sale'
      };

      await collection.insertOne(newSale);
      console.log(`🟢 New simulated sale inserted: ${newSale.transaction_id} at ${now.toISOString()}`);
    }, 5000); // every 5 seconds

  } catch (err) {
    console.error('❌ Simulation error:', err);
  }
}

simulateRealtimeSales();
