const Airtable = require('airtable');

const base = new Airtable.Base(process.env.AIRTABLE_API_KEY).base(process.env.AIRTABLE_BASE_ID);
const TABLE_NAME = 'MonthlyReports';

exports.handler = async (event, context) => {
    try {
        const records = await base(TABLE_NAME).select({
            sort: [{ field: 'monthYear', direction: 'desc' }]
        }).all();

        const reports = records.map(record => {
            const fields = record.fields;
            // Ensure hygieneItems is a number (calculated total from itemsData)
            return {
                id: record.id,
                monthYear: fields.monthYear,
                hygieneItems: fields.hygieneItems || 0,
                monetaryDonations: fields.monetaryDonations || 0,
                newPartnerships: fields.newPartnerships || 0,
                houseWarmingBaskets: fields.houseWarmingBaskets || 0,
                peopleServed: fields.peopleServed || 0,
                locationsServed: fields.locationsServed || '',
                narrative: fields.narrative || '',
                itemsData: fields.itemsData ? JSON.parse(fields.itemsData) : {}
            };
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reports })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
