const Airtable = require('airtable');

const base = new Airtable.Base(process.env.AIRTABLE_API_KEY).base(process.env.AIRTABLE_BASE_ID);
const TABLE_NAME = 'MonthlyReports';

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);

        if (!data.id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'id is required' })
            };
        }

        // Update the record
        const updated = await base(TABLE_NAME).update(data.id, {
            monthYear: data.monthYear,
            hygieneItems: data.hygieneItems || 0,
            monetaryDonations: data.monetaryDonations || 0,
            newPartnerships: data.newPartnerships || 0,
            houseWarmingBaskets: data.houseWarmingBaskets || 0,
            peopleServed: data.peopleServed || 0,
            locationsServed: data.locationsServed || '',
            narrative: data.narrative || '',
            itemsData: JSON.stringify(data.itemsData || {})
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                record: {
                    id: updated.id,
                    ...updated.fields
                }
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
