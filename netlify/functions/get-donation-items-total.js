/* ============================================================
   netlify/functions/get-donation-items-total.js
   The R3SC — Aggregate item donation totals across all reports

   Public read endpoint — no password required.

   Required env vars:
     AIRTABLE_API_KEY   — your Airtable PAT
     AIRTABLE_BASE_ID   — your R3SC base ID
   ============================================================ */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const Airtable = require("airtable");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  try {
    const records = await base("MonthlyReports").select().all();

    const totals = {};
    let grandTotal = 0;

    records.forEach((record) => {
      const itemsData = record.fields.itemsData;
      if (itemsData) {
        try {
          const items =
            typeof itemsData === "string" ? JSON.parse(itemsData) : itemsData;
          Object.keys(items).forEach((itemName) => {
            const qty = items[itemName];
            totals[itemName] = (totals[itemName] || 0) + qty;
            grandTotal += qty;
          });
        } catch (e) {
          console.warn("Could not parse itemsData:", e);
        }
      }
    });

    const sorted = Object.entries(totals)
      .map(([item, quantity]) => ({ item, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ totals: sorted, grandTotal }),
    };
  } catch (error) {
    console.error("get-donation-items-total error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
