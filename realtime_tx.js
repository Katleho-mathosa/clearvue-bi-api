const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://KatlehMmathosa_group2:tpk-katleho-g2@theprimarykeys.bijpgsv.mongodb.net/clearvue_bi?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function simulateRealTime() {
  await client.connect();
  const db = client.db("your_db_name");
  const col = db.collection("RealTime_Transactions");

  setInterval(async () => {
    const fakeSale = {
      DOC_NUMBER: `RT${Math.floor(Math.random() * 10000)}`,
      TRANS_DATE: new Date(),
      CUSTOMER_NAME: "Demo Customer",
      INVENTORY_CODE: "ITEM-" + Math.floor(Math.random() * 100),
      QUANTITY: Math.ceil(Math.random() * 5),
      UNIT_PRICE: Math.ceil(Math.random() * 100),
      TOTAL_AMOUNT: Math.ceil(Math.random() * 500),
      createdAt: new Date()
    };
    await col.insertOne(fakeSale);
    console.log("New sale inserted:", fakeSale.DOC_NUMBER);
  }, 5000); // every 5 seconds
}

simulateRealTime();
