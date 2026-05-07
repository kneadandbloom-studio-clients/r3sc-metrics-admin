/* ============================================================
   netlify/functions/save-donated-items.js
   The R3SC — Save itemized donated items for a monthly report

   Deletes existing DonatedItems rows for the given MonthlyReports
   record ID, then batch-creates new rows.

   Called internally by save-monthly-report.js and
   update-monthly-report.js — not a public endpoint.

   Required env vars:
     ADMIN_PASSWORD     — shared admin passwords (comma-separated)
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

// ── itemName → itemType mapping ───────────────────────────────────
const ITEM_TYPE_MAP = {
  "Body Wash":          "Hygiene",
  "Conditioner":        "Hygiene",
  "Deodorant":          "Hygiene",
  "Hand Sanitizer":     "Hygiene",
  "Hand Soap":          "Hygiene",
  "Lotion":             "Hygiene",
  "Shampoo":            "Hygiene",
  "Soap (Bar)":         "Hygiene",
  "Toothbrush":         "Hygiene",
  "Toothpaste":         "Hygiene",
  "All-Purpose Cleaner":"Household",
  "Bleach":             "Household",
  "Broom":              "Household",
  "Dish Detergent":     "Household",
  "Laundry Detergent":  "Household",
  "Mop":                "Household",
  "Paper Towels":       "Household",
  "Sponge":             "Household",
  "Toilet Tissue":      "Household",
  "Trash Bags":         "Household",
};

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

  // reportRecordId = the Airtable record ID of the MonthlyReports row
  // items = [{ itemName, quantity }]
  const { reportRecordId, items } = body;

  if (!reportRecordId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "reportRecordId is required." }) };
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  try {
    // ── 1. Delete existing DonatedItems rows for this report ──────
    const existing = await base("DonatedItems")
      .select({
        filterByFormula: `FIND("${reportRecordId}", ARRAYJOIN(RECORD_ID({monthYear})))`,
      })
      .all();

    if (existing.length > 0) {
      // Airtable batch delete max 10 at a time
      const ids = existing.map(r => r.id);
      for (let i = 0; i < ids.length; i += 10) {
        await base("DonatedItems").destroy(ids.slice(i, i + 10));
      }
    }

    // ── 2. Bail early if no items to save ────────────────────────
    if (!items || items.length === 0) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, created: 0 }),
      };
    }

    // ── 3. Batch-create new rows (max 10 per request) ────────────
    const validItems = items.filter(i => i.itemName && i.quantity > 0);
    let created = 0;

    for (let i = 0; i < validItems.length; i += 10) {
      const batch = validItems.slice(i, i + 10).map(item => ({
        fields: {
          itemType:  ITEM_TYPE_MAP[item.itemName] || "Hygiene",
          itemName:  item.itemName,
          quantity:  item.quantity,
          monthYear: [reportRecordId], // linked record — must be array
        },
      }));
      await base("DonatedItems").create(batch);
      created += batch.length;
    }

    console.log(`DonatedItems saved: ${created} rows for report ${reportRecordId}`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, created }),
    };

  } catch (error) {
    console.error("save-donated-items error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
