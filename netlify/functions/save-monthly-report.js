/* ============================================================
   netlify/functions/save-monthly-report.js
   The R3SC — Create a new monthly impact report

   Required env vars:
     ADMIN_PASSWORD     — shared admin password
     AIRTABLE_API_KEY   — your Airtable PAT
     AIRTABLE_BASE_ID   — your R3SC base ID
   ============================================================ */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const Airtable = require("airtable");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // ── Auth ─────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  // ── Validate ──────────────────────────────────────────────
  if (!body.monthYear) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "monthYear is required." }) };
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  try {
    // Check for duplicate month
    const existing = await base("MonthlyReports")
      .select({ filterByFormula: `{monthYear} = '${body.monthYear}'` })
      .all();

    if (existing.length > 0) {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "A report for this month already exists." }),
      };
    }

    // ✅ Airtable auto-generates record IDs — do NOT pass an id field
    const record = await base("MonthlyReports").create({
      monthYear:           body.monthYear,
      hygieneItems:        body.hygieneItems        || 0,
      monetaryDonations:   body.monetaryDonations   || 0,
      newPartnerships:     body.newPartnerships      || 0,
      houseWarmingBaskets: body.houseWarmingBaskets  || 0,
      peopleServed:        body.peopleServed         || 0,
      locationsServed:     body.locationsServed      || "",
      narrative:           body.narrative            || "",
      itemsData:           JSON.stringify(body.itemsData || {}),
    });

    console.log(`Monthly report created: ${record.id} — ${body.monthYear}`);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        record: { id: record.id, ...record.fields },
      }),
    };
  } catch (error) {
    console.error("save-monthly-report error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
