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

        // Delete the record
        await base(TABLE_NAME).destroy(data.id);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
