/* ============================================================
   netlify/functions/get-monthly-reports.js
   The R3SC — Monthly Impact Reports

   Fetches all MonthlyReports and attaches their related
   DonatedItems rows (via linked record field).

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
    // ── 1. Fetch all MonthlyReports ───────────────────────────────
    const reportRecords = await base("MonthlyReports")
      .select({ sort: [{ field: "monthYear", direction: "desc" }] })
      .all();

    // ── 2. Fetch all DonatedItems ─────────────────────────────────
    const itemRecords = await base("DonatedItems").select().all();

    // ── 3. Group DonatedItems by linked MonthlyReports record ID ──
    // monthYear field is a linked record array e.g. ["recXXXXXX"]
    const itemsByReport = {};
    itemRecords.forEach((item) => {
      const linked = item.fields.monthYear;
      if (!linked || linked.length === 0) return;
      const reportId = linked[0];
      if (!itemsByReport[reportId]) itemsByReport[reportId] = [];
      itemsByReport[reportId].push({
        itemType: item.fields.itemType || "",
        itemName: item.fields.itemName || "",
        quantity: item.fields.quantity || 0,
      });
    });

    // ── 4. Shape reports and attach items ─────────────────────────
    const reports = reportRecords.map((record) => {
      const f = record.fields;
      return {
        id:                  record.id,
        monthYear:           f.monthYear           || "",
        hygieneItems:        f.hygieneItems         || 0,
        monetaryDonations:   f.monetaryDonations    || 0,
        newPartnerships:     f.newPartnerships       || 0,
        houseWarmingBaskets: f.houseWarmingBaskets   || 0,
        peopleServed:        f.peopleServed          || 0,
        locationsServed:     f.locationsServed       || "",
        narrative:           f.narrative             || "",
        donatedItems:        itemsByReport[record.id] || [],
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
