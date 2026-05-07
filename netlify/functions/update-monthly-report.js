/* ============================================================
   netlify/functions/update-monthly-report.js
   The R3SC — Update an existing monthly impact report

   Deletes existing DonatedItems rows for this report and
   recreates them from the submitted list.

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

const ITEM_TYPE_MAP = {
  "Body Wash":           "Hygiene",
  "Conditioner":         "Hygiene",
  "Deodorant":           "Hygiene",
  "Hand Sanitizer":      "Hygiene",
  "Hand Soap":           "Hygiene",
  "Lotion":              "Hygiene",
  "Shampoo":             "Hygiene",
  "Soap (Bar)":          "Hygiene",
  "Toothbrush":          "Hygiene",
  "Toothpaste":          "Hygiene",
  "All-Purpose Cleaner": "Household",
  "Bleach":              "Household",
  "Broom":               "Household",
  "Dish Detergent":      "Household",
  "Laundry Detergent":   "Household",
  "Mop":                 "Household",
  "Paper Towels":        "Household",
  "Sponge":              "Household",
  "Toilet Tissue":       "Household",
  "Trash Bags":          "Household",
};

function isValidPassword(submitted) {
  const stored = process.env.ADMIN_PASSWORDS || process.env.ADMIN_PASSWORD || "";
  return stored.split(",").map(p => p.trim()).includes(submitted);
}

async function replaceDonatedItems(base, reportRecordId, items) {
  // Fetch all DonatedItems and filter by linked record ID in JS
  const allItems = await base("DonatedItems").select().all();
  const toDelete = allItems.filter(r => {
    const linked = r.fields.monthYear;
    return Array.isArray(linked) && linked.includes(reportRecordId);
  });

  if (toDelete.length > 0) {
    const ids = toDelete.map(r => r.id);
    for (let i = 0; i < ids.length; i += 10) {
      await base("DonatedItems").destroy(ids.slice(i, i + 10));
    }
  }

  // Recreate
  if (!items || items.length === 0) return;
  const valid = items.filter(i => i.itemName && i.quantity > 0);
  for (let i = 0; i < valid.length; i += 10) {
    const batch = valid.slice(i, i + 10).map(item => ({
      fields: {
        itemType:  ITEM_TYPE_MAP[item.itemName] || "Hygiene",
        itemName:  item.itemName,
        quantity:  item.quantity,
        monthYear: [reportRecordId],
      },
    }));
    await base("DonatedItems").create(batch);
  }
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
    const updated = await base("MonthlyReports").update(body.id, {
      monthYear:           body.monthYear,
      hygieneItems:        body.hygieneItems        || 0,
      monetaryDonations:   body.monetaryDonations   || 0,
      newPartnerships:     body.newPartnerships      || 0,
      houseWarmingBaskets: body.houseWarmingBaskets  || 0,
      peopleServed:        body.peopleServed         || 0,
      locationsServed:     body.locationsServed      || "",
      narrative:           body.narrative            || "",
    });

    // Replace donated items for this report
    await replaceDonatedItems(base, body.id, body.donatedItems || []);

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
