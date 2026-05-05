const Airtable = require('airtable');
const { v4: uuidv4 } = require('uuid');

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

        if (!data.monthYear) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'monthYear is required' })
            };
        }

        // Check if report for this month already exists
        const existing = await base(TABLE_NAME)
            .select({
                filterByFormula: `{monthYear} = '${data.monthYear}'`
            })
            .all();

        if (existing.length > 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: 'Report for this month already exists' })
            };
        }

        // Create new record
        const record = await base(TABLE_NAME).create({
            id: uuidv4(),
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
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                record: {
                    id: record.id,
                    ...record.fields
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
