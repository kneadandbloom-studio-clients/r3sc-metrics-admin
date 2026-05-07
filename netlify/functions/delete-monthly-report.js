/* ============================================================
   netlify/functions/delete-monthly-report.js
   The R3SC — Delete a monthly impact report

   Also deletes all related DonatedItems rows for this report.

   Required env vars:
     ADMIN_PASSWORDS    — comma-separated admin passwords
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

function isValidPassword(submitted) {
  const stored = process.env.ADMIN_PASSWORDS || process.env.ADMIN_PASSWORD || "";
  return stored.split(",").map(p => p.trim()).includes(submitted);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  if (!isValidPassword(body.password)) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  if (!body.id) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "id is required." }) };
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  try {
    // ── 1. Delete related DonatedItems rows first ─────────────────
    const allItems = await base("DonatedItems").select().all();
    const toDelete = allItems.filter(r => {
      const linked = r.fields.monthYear;
      return Array.isArray(linked) && linked.includes(body.id);
    });

    if (toDelete.length > 0) {
      const ids = toDelete.map(r => r.id);
      for (let i = 0; i < ids.length; i += 10) {
        await base("DonatedItems").destroy(ids.slice(i, i + 10));
      }
      console.log(`Deleted ${toDelete.length} DonatedItems for report ${body.id}`);
    }

    // ── 2. Delete the MonthlyReports row ─────────────────────────
    await base("MonthlyReports").destroy(body.id);

    console.log(`Monthly report deleted: ${body.id}`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("delete-monthly-report error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
