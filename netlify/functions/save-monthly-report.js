/* ============================================================
   netlify/functions/save-monthly-report.js
   The R3SC — Create a new monthly impact report

   After creating the MonthlyReports row, saves any donated
   items as individual rows in the DonatedItems table.

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

async function saveDonatedItems(base, reportRecordId, items) {
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

    const hygieneItems = (body.donatedItems || [])
    .filter((i) => i.quantity > 0)
    .reduce((sum, i) => sum + i.quantity, 0);

    // Create the MonthlyReports row
    const record = await base("MonthlyReports").create({
			monthYear: body.monthYear,
      hygieneItems: hygieneItems,
			monetaryDonations: body.monetaryDonations || 0,
			newPartnerships: body.newPartnerships || 0,
			houseWarmingBaskets: body.houseWarmingBaskets || 0,
			peopleServed: body.peopleServed || 0,
			locationsServed: body.locationsServed || "",
			narrative: body.narrative || "",
		});

    // Save donated items linked to this report
    await saveDonatedItems(base, record.id, body.donatedItems || []);

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
