const Airtable = require('airtable');

const base = new Airtable.Base(process.env.AIRTABLE_API_KEY).base(process.env.AIRTABLE_BASE_ID);
const TABLE_NAME = 'MonthlyReports';

exports.handler = async (event, context) => {
    try {
        const records = await base(TABLE_NAME).select().all();

        const totals = {};
        let grandTotal = 0;

        // Aggregate itemsData from all records
        records.forEach(record => {
            const itemsData = record.fields.itemsData;
            if (itemsData) {
                try {
                    const items = typeof itemsData === 'string' ? JSON.parse(itemsData) : itemsData;
                    Object.keys(items).forEach(itemName => {
                        const qty = items[itemName];
                        totals[itemName] = (totals[itemName] || 0) + qty;
                        grandTotal += qty;
                    });
                } catch (e) {
                    console.warn('Could not parse itemsData:', e);
                }
            }
        });

        // Sort by quantity descending
        const sorted = Object.entries(totals)
            .map(([item, qty]) => ({ item, quantity: qty }))
            .sort((a, b) => b.quantity - a.quantity);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totals: sorted,
                grandTotal
            })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
