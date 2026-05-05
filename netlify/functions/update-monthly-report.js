/* ============================================================
   netlify/functions/update-monthly-report.js
   The R3SC — Update an existing monthly impact report

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

  if (!body.id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "id is required." }) };
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  try {
    const updated = await base("MonthlyReports").update(body.id, {
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

    console.log(`Monthly report updated: ${updated.id} — ${body.monthYear}`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        record: { id: updated.id, ...updated.fields },
      }),
    };
  } catch (error) {
    console.error("update-monthly-report error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
