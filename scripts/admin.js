let adminPassword = "";
let editingId = null;
let narrativeDirty = false;

// ── AUTH ──────────────────────────────────────────────────────────
function unlock() {
	const pw = document.getElementById("passwordInput").value.trim();
	if (!pw) return;
	adminPassword = pw;
	document.getElementById("lockScreen").style.display = "none";
	document.getElementById("adminPanel").classList.add("visible");
	loadReports();
}

function logout() {
	adminPassword = "";
	editingId = null;
	narrativeDirty = false;
	document.getElementById("passwordInput").value = "";
	document.getElementById("lockError").classList.remove("visible");
	document.getElementById("lockScreen").style.display = "";
	document.getElementById("adminPanel").classList.remove("visible");
	resetForm();
}

// ── ACCORDION ─────────────────────────────────────────────────────
function toggleCard(id) {
	document.getElementById(id).classList.toggle("open");
}

// ── ITEM TYPE MAP ─────────────────────────────────────────────────
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

const HYGIENE_ITEMS = Object.keys(ITEM_TYPE_MAP).filter((k) => ITEM_TYPE_MAP[k] === "Hygiene");
const HOUSEHOLD_ITEMS = Object.keys(ITEM_TYPE_MAP).filter((k) => ITEM_TYPE_MAP[k] === "Household");

// ── REPORT CACHE ──────────────────────────────────────────────────
let cachedReports = [];

// ── MONTH/YEAR AUTO-POPULATE ──────────────────────────────────────
function onMonthYearChange() {
	const selected = document.getElementById("f-monthYear").value;
	if (!selected || editingId) {
		// If already in edit mode, just run normal form change
		onFormChange();
		return;
	}
	const existing = cachedReports.find((r) => r.monthYear === selected);
	if (existing) {
		startEdit(existing);
		showResult(
			"newReportResult",
			"newReportResultTitle",
			"newReportResultBody",
			"info",
			"ℹ Report Loaded",
			`A report for <strong>${formatMonthYear(selected)}</strong> already exists and has been loaded for editing.`
		);
	} else {
		onFormChange();
	}
}

// ── ITEMIZED DONATIONS ────────────────────────────────────────────
function addItemRow(itemName = "", qty = "") {
	const list = document.getElementById("itemsList");
	const row = document.createElement("div");
	row.className = "item-row";

	const hygieneOptions = HYGIENE_ITEMS.map((i) => `<option value="${i}" ${i === itemName ? "selected" : ""}>${i}</option>`).join("");
	const householdOptions = HOUSEHOLD_ITEMS.map((i) => `<option value="${i}" ${i === itemName ? "selected" : ""}>${i}</option>`).join("");

	row.innerHTML = `
      <select class="item-select" onchange="onFormChange()">
        <option value="" disabled ${!itemName ? "selected" : ""}>Select item…</option>
        <optgroup label="🧴 Hygiene">${hygieneOptions}</optgroup>
        <optgroup label="🏠 Household">${householdOptions}</optgroup>
      </select>
      <input type="number" class="qty" placeholder="Qty" min="1" value="${qty}" oninput="onFormChange()" />
      <button class="remove-item-btn" onclick="this.closest('.item-row').remove(); onFormChange();" title="Remove">×</button>
    `;
	list.appendChild(row);
}

function getDonatedItems() {
	const items = [];
	document.querySelectorAll("#itemsList .item-row").forEach((row) => {
		const select = row.querySelector("select");
		const qtyInput = row.querySelector("input.qty");
		const itemName = select ? select.value : "";
		const quantity = parseInt(qtyInput ? qtyInput.value : "0", 10);
		if (itemName && quantity > 0) items.push({ itemName, quantity });
	});
	return items;
}

// ── NARRATIVE AUTO-GENERATE ───────────────────────────────────────

function onNarrativeManualEdit() {
	narrativeDirty = true;
	document.getElementById("regenBtn").classList.add("visible");
	setNarrativeHint("muted", "✎", "Manually edited — click ↺ Regenerate to refresh from current data.");
}

function onFormChange() {
	if (!narrativeDirty) generateNarrative();
}

function regenNarrative() {
	narrativeDirty = false;
	document.getElementById("regenBtn").classList.remove("visible");
	generateNarrative();
}

// ── NARRATIVE DISPLAY NAMES ───────────────────────────────────────
const NARRATIVE_DISPLAY_MAP = {
	"Body Wash":           "Body Washes",
	"Conditioner":         "Conditioners",
	"Deodorant":           "Deodorants",
	"Hand Sanitizer":      "Hand Sanitizers",
	"Hand Soap":           "Hand Soaps",
	"Lotion":              "Lotions",
	"Shampoo":             "Shampoos",
	"Soap (Bar)":          "Bars of Soap",
	"Toothbrush":          "Toothbrushes",
	"Toothpaste":          "Tubes of Toothpaste",
	"All-Purpose Cleaner": "All-Purpose Cleaners",
	"Bleach":              "Bottles of Bleach",
	"Broom":               "Brooms",
	"Dish Detergent":      "Dish Detergents",
	"Laundry Detergent":   "Laundry Detergents",
	"Mop":                 "Mops",
	"Paper Towels":        "Rolls of Paper Towels",
	"Sponge":              "Sponges",
	"Toilet Tissue":       "Rolls of Toilet Tissue",
	"Trash Bags":          "Boxes of Trash Bags",
};

function generateNarrative() {
	const monthYearVal = document.getElementById("f-monthYear").value;
	const peopleServed = parseInt(document.getElementById("f-peopleServed").value) || 0;
	const locations = document.getElementById("f-locationsServed").value.trim();
	const baskets = parseInt(document.getElementById("f-houseWarmingBaskets").value) || 0;
	const items = getDonatedItems();

	// Wait until at least one item has a quantity
	if (items.length === 0) {
		document.getElementById("f-narrative").value = "";
		setNarrativeHint("", "✦", "Add items and quantities above to auto-generate.");
		return;
	}

	// Month label
	let monthLabel = "this month";
	if (monthYearVal) {
		const [year, month] = monthYearVal.split("-");
		monthLabel = new Intl.DateTimeFormat("en-US", {
			month: "long",
			year: "numeric",
		}).format(new Date(year, month - 1));
	}

	// Totals
	const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

	// Top 3 items by quantity, using display names
	const top3 = [...items]
		.sort((a, b) => b.quantity - a.quantity)
		.slice(0, 3)
		.map((i) => `${i.quantity} ${(NARRATIVE_DISPLAY_MAP[i.itemName] || i.itemName).toLowerCase()}`)
		.join(", ");

	// Optional phrases
	const basketsPhrase = baskets > 0 ? ` and ${baskets} house-warming basket${baskets !== 1 ? "s" : ""}` : "";
	const peoplePhrase = peopleServed > 0 ? ` to serve ${peopleServed} people/homes` : "";
	const locationPhrase = locations ? ` across ${locations}` : "";

	const narrative =
		`In ${monthLabel}, R3SC donated ${totalItems} hygiene and household items` +
		`${basketsPhrase}${peoplePhrase}${locationPhrase}. ` +
		`This month's donations included ${top3}. ` +
		`Together, we continue restoring resources, respect, and community.`;

	document.getElementById("f-narrative").value = narrative;
	setNarrativeHint("", "✦", "Auto-generated — edit freely or click ↺ Regenerate to refresh.");
}

function setNarrativeHint(className, icon, text) {
	const hint = document.getElementById("narrativeHint");
	hint.className = "narrative-hint" + (className ? ` ${className}` : "");
	document.getElementById("narrativeHintIcon").textContent = icon;
	document.getElementById("narrativeHintText").textContent = text;
}

// ── FORM HELPERS ──────────────────────────────────────────────────
function val(id) {
	return document.getElementById(id).value.trim();
}
function numVal(id) {
	return parseFloat(document.getElementById(id).value) || 0;
}

function resetForm() {
	editingId = null;
	narrativeDirty = false;
	["f-monthYear", "f-peopleServed", "f-locationsServed", "f-houseWarmingBaskets", "f-monetaryDonations", "f-newPartnerships", "f-narrative"].forEach((id) => (document.getElementById(id).value = ""));
	document.getElementById("itemsList").innerHTML = "";
	document.getElementById("editBanner").classList.remove("visible");
	document.getElementById("regenBtn").classList.remove("visible");
	setNarrativeHint("", "✦", "Add items and quantities above to auto-generate.");
	hideResult("newReportResult");
	clearErrors();
}

function clearErrors() {
	document.querySelectorAll(".field-error.visible").forEach((el) => el.classList.remove("visible"));
	document.querySelectorAll(".form-input.error, .form-textarea.error").forEach((el) => el.classList.remove("error"));
}

function showFieldError(fieldId, errId) {
	document.getElementById(fieldId).classList.add("error");
	document.getElementById(errId).classList.add("visible");
}

function showResult(cardId, titleId, bodyId, type, title, body) {
	const card = document.getElementById(cardId);
	card.className = `result-card visible ${type}`;
	document.getElementById(titleId).textContent = title;
	document.getElementById(bodyId).innerHTML = body;
}

function hideResult(cardId) {
	document.getElementById(cardId).className = "result-card";
}

function setLoading(btnId, loading) {
	const btn = document.getElementById(btnId);
	btn.classList.toggle("loading", loading);
	btn.disabled = loading;
}

// ── LOAD EXISTING REPORTS ─────────────────────────────────────────
async function loadReports() {
	const list = document.getElementById("reportsList");
	list.innerHTML = '<div class="reports-loading">Loading reports…</div>';
	try {
		const res = await fetch("/.netlify/functions/get-monthly-reports");
		const data = await res.json();

		if (!data.reports || data.reports.length === 0) {
			cachedReports = [];
			list.innerHTML = '<div class="reports-empty">No reports yet. Create one above.</div>';
			return;
		}

		cachedReports = data.reports;
		const sorted = [...data.reports].sort((a, b) => new Date(b.monthYear) - new Date(a.monthYear));

		list.innerHTML = sorted
			.map((r) => {
				const totalItems = (r.donatedItems || []).reduce((sum, i) => sum + i.quantity, 0) || r.hygieneItems || 0;
				return `
          <div class="report-row">
            <div>
              <div class="report-row-month">${formatMonthYear(r.monthYear)}</div>
              <div class="report-row-meta">${r.peopleServed} people served · ${totalItems} items · ${r.houseWarmingBaskets} baskets</div>
            </div>
            <div class="report-row-actions">
              <button class="row-btn edit" onclick="startEdit(${JSON.stringify(r).replace(/"/g, "&quot;")})">Edit</button>
              <button class="row-btn del"  onclick="deleteReport('${r.id}', '${r.monthYear}')">Delete</button>
            </div>
          </div>
        `;
			})
			.join("");
	} catch (err) {
		list.innerHTML = `<div class="reports-empty" style="color:var(--red);">Failed to load: ${err.message}</div>`;
	}
}

function formatMonthYear(my) {
	const [year, month] = my.split("-");
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(year, month - 1));
}

// ── EDIT EXISTING REPORT ──────────────────────────────────────────
function startEdit(report) {
	editingId = report.id;
	narrativeDirty = false;

	document.getElementById("f-monthYear").value = report.monthYear;
	document.getElementById("f-peopleServed").value = report.peopleServed || "";
	document.getElementById("f-locationsServed").value = report.locationsServed || "";
	document.getElementById("f-houseWarmingBaskets").value = report.houseWarmingBaskets || "";
	document.getElementById("f-monetaryDonations").value = report.monetaryDonations || "";
	document.getElementById("f-newPartnerships").value = report.newPartnerships || "";
	document.getElementById("f-narrative").value = report.narrative || "";

	document.getElementById("itemsList").innerHTML = "";
	const collapsed = Object.values(
		(report.donatedItems || []).reduce((acc, item) => {
			if (!item.itemName) return acc;
			if (acc[item.itemName]) {
				acc[item.itemName].quantity += item.quantity;
			} else {
				acc[item.itemName] = { itemName: item.itemName, quantity: item.quantity };
			}
			return acc;
		}, {})
	);
	collapsed.forEach((item) => addItemRow(item.itemName, item.quantity));

	// Treat existing narrative as manually set — show Regenerate option
	if (report.narrative) {
		narrativeDirty = true;
		document.getElementById("regenBtn").classList.add("visible");
		setNarrativeHint("muted", "✎", "Loaded from saved report — click ↺ Regenerate to refresh from current data.");
	} else {
		generateNarrative();
	}

	document.getElementById("editBannerMonth").textContent = formatMonthYear(report.monthYear);
	document.getElementById("editBanner").classList.add("visible");
	hideResult("newReportResult");
	document.getElementById("card-new-report").classList.add("open");
	document.getElementById("card-new-report").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
	resetForm();
}

// ── SUBMIT (create or update) ─────────────────────────────────────
async function submitReport() {
	clearErrors();
	hideResult("newReportResult");

	if (!val("f-monthYear")) {
		showFieldError("f-monthYear", "err-monthYear");
		return;
	}

	setLoading("submitBtn", true);

	const donatedItems = getDonatedItems();
	const hygieneItems = donatedItems.reduce((sum, i) => sum + i.quantity, 0);

	const payload = {
		password: adminPassword,
		monthYear: val("f-monthYear"),
		peopleServed: numVal("f-peopleServed"),
		locationsServed: val("f-locationsServed"),
		hygieneItems,
		houseWarmingBaskets: numVal("f-houseWarmingBaskets"),
		monetaryDonations: numVal("f-monetaryDonations"),
		newPartnerships: numVal("f-newPartnerships"),
		narrative: val("f-narrative"),
		donatedItems,
	};

	const isEdit = !!editingId;
	const endpoint = isEdit ? "/.netlify/functions/update-monthly-report" : "/.netlify/functions/save-monthly-report";

	if (isEdit) payload.id = editingId;

	try {
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const data = await res.json();

		if (res.status === 401) {
			document.getElementById("lockError").classList.add("visible");
			logout();
			return;
		}
		if (res.status === 409) {
			showResult("newReportResult", "newReportResultTitle", "newReportResultBody", "error", "⚠ Duplicate Month", data.error || "A report for this month already exists.");
			return;
		}
		if (!res.ok || !data.success) {
			showResult("newReportResult", "newReportResultTitle", "newReportResultBody", "error", "⚠ Something went wrong", data.error || "Unknown error — check Netlify logs.");
			return;
		}

		showResult(
			"newReportResult",
			"newReportResultTitle",
			"newReportResultBody",
			"success",
			isEdit ? "✓ Report Updated" : "✓ Report Saved",
			`<strong>${formatMonthYear(payload.monthYear)}</strong> has been ${isEdit ? "updated" : "saved"} successfully.`
		);
		resetForm();
		loadReports();
	} catch (err) {
		showResult("newReportResult", "newReportResultTitle", "newReportResultBody", "error", "⚠ Network Error", err.message || "Could not reach the server.");
	} finally {
		setLoading("submitBtn", false);
	}
}

// ── DELETE REPORT ─────────────────────────────────────────────────
async function deleteReport(id, monthYear) {
	if (!confirm(`Delete the report for ${formatMonthYear(monthYear)}? This cannot be undone.`)) return;
	hideResult("deleteResult");
	try {
		const res = await fetch("/.netlify/functions/delete-monthly-report", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: adminPassword, id }),
		});
		const data = await res.json();

		if (res.status === 401) {
			document.getElementById("lockError").classList.add("visible");
			logout();
			return;
		}
		if (!res.ok || !data.success) {
			showResult("deleteResult", "deleteResultTitle", "deleteResultBody", "error", "⚠ Delete failed", data.error || "Unknown error.");
			return;
		}
		showResult("deleteResult", "deleteResultTitle", "deleteResultBody", "success", "✓ Report Deleted", `The report for <strong>${formatMonthYear(monthYear)}</strong> has been removed.`);
		loadReports();
	} catch (err) {
		showResult("deleteResult", "deleteResultTitle", "deleteResultBody", "error", "⚠ Network Error", err.message);
	}
}
