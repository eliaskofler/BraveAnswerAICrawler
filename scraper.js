const mysql = require('mysql2/promise');
const axios = require('axios');
const https = require('https');

// Database connection configuration
const pool = mysql.createPool({
  host: '127.0.0.1',
  user: '',
  password: '',
  database: 'bravedataset',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const fetchUrls = async () => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT id, url FROM urls WHERE html IS NULL LIMIT 10');
    return rows;
  } finally {
    connection.release();
  }
};

const updateHtmlContent = async (id, html) => {
  const connection = await pool.getConnection();
  try {
    await connection.query('UPDATE urls SET html = ? WHERE id = ?', [html, id]);
    console.log("Updated at: " + id);
  } finally {
    connection.release();
  }
};

const visitUrls = async (urls) => {
    const promises = urls.map(async (urlObj) => {
      try {
        const response = await axios.get(urlObj.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          })
        });
  
        const html = response.data;
        await updateHtmlContent(urlObj.id, html);
      } catch (error) {
        if (error.response) {
          // Handle 403 Forbidden error
          console.error(`Error fetching URL ${urlObj.url}: ${error.message}`);
          // Update the HTML column with "HTML not found"
          await updateHtmlContent(urlObj.id, "HTML not found");
        } else {
          // Handle other errors
          await updateHtmlContent(urlObj.id, "HTML not found");
        }
      }
    });
  
    await Promise.all(promises);
};

const main = async () => {
  while (true) {
    const urls = await fetchUrls();
    if (urls.length === 0) {
      console.log('No more URLs with null HTML found.');
      break;
    }
    await visitUrls(urls);
    console.log('Processed a batch of URLs. Fetching next batch...');
  }
  console.log('Finished processing all URLs.');
};

// Run the script
main().catch(err => {
  console.error('Error in main function: ', err.message);
});