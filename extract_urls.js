const mysql = require('mysql2/promise');
const async = require('async');

const dbConfig = {
    host: 'localhost',
    user: '',
    password: '',
    database: 'bravedataset'
};

async function extractAndInsertUrls() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        const [rows] = await connection.execute('SELECT sources FROM answerai');

        let urls = [];

        rows.forEach(row => {
            const sources = JSON.parse(row.sources);
            urls = urls.concat(sources);
        });

        urls = [...new Set(urls)];

        await async.eachSeries(urls, async (url) => {
            try {
                await connection.execute('INSERT IGNORE INTO urls (url) VALUES (?)', [url]);
            } catch (err) {
                console.error('Error inserting URL:', url, err);
            }
        });

        console.log('URLs have been extracted and inserted successfully.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

extractAndInsertUrls();