/* ============================================================
   netlify/functions/get-monthly-reports.js
   The R3SC — Monthly Impact Reports

   Returns all monthly report records from Airtable.
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
    const records = await base("MonthlyReports")
      .select({ sort: [{ field: "monthYear", direction: "desc" }] })
      .all();

    const reports = records.map((record) => {
      const f = record.fields;
      let itemsData = {};
      if (f.itemsData) {
        try {
          itemsData =
            typeof f.itemsData === "string" ? JSON.parse(f.itemsData) : f.itemsData;
        } catch {
          itemsData = {};
        }
      }
      return {
        id: record.id,                                    // ✅ was r.id (bug fix)
        monthYear: f.monthYear || "",
        hygieneItems: f.hygieneItems || 0,
        monetaryDonations: f.monetaryDonations || 0,
        newPartnerships: f.newPartnerships || 0,
        houseWarmingBaskets: f.houseWarmingBaskets || 0,
        peopleServed: f.peopleServed || 0,
        locationsServed: f.locationsServed || "",
        narrative: f.narrative || "",
        itemsData,
      };
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ reports }),
    };
  } catch (error) {
    console.error("get-monthly-reports error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
