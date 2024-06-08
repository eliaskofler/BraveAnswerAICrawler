const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const fs = require('fs');
const http = require('http');
const path = require('path');
const delay = (time) => new Promise(resolve => setTimeout(resolve, time));
const queriesFilePath = path.join(__dirname, 'data/queries.txt');
const usedQueriesFilePath = path.join(__dirname, 'data/processed_queries.txt');

(async () => {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: '',
            password: '',
            database: 'bravedataset'
        });

        const browser1 = await puppeteer.launch({ headless: false });

        await Promise.all([
            createPages(browser1)
        ]);

        async function createPages(browser) {
            const p1 = await browser.newPage();
            const p2 = await browser.newPage();

            await Promise.all([
                initializeCrawler(p1, connection), 
                initializeCrawler(p2, connection),
            ])
        }

    } catch(error) {
        console.log("")
    }
})();

async function initializeCrawler(page, connection) {
    console.log("[+] Initializing crawler");
    setHeaders(page);    
    crawlData(page, connection);
}

async function crawlData(page, connection) {
    try {
        console.log("[+] crawling another.");
        const query = newQuery();
        if(query === null) {
            return;
        }
        const randomURL = 'https://search.brave.com/search?q=' + encodeURIComponent(query) + '&source=llmSuggest&summary=1';
        await page.goto(randomURL);

        const captchaDetected = await page.evaluate(() => {
            return !!document.getElementById('pow-captcha-content');
        });
    
        if (captchaDetected) {
            console.log('CAPTCHA detected, sending HTTP GET request to 127.0.0.1:4321');
            
            http.get('http://127.0.0.1:4321', (res) => {
                console.log(`Got response: ${res.statusCode}`);
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
            });
    
            console.log('Waiting for 1 minute due to CAPTCHA.');
            await delay(30000);
            crawlData(page, connection);
            return;
        }

        try {
            await page.waitForFunction(() => {
                const submitButton = document.getElementById('submit-llm-button');
                const header = document.querySelector('.desktop-heading-h4');
                return (submitButton && submitButton.hasAttribute('disabled')) || (header && header.textContent.includes('Context'));
            }, { timeout: 60000 });
        
            console.log("[+] AnswerAI finished loading.");
        } catch (error) {
            console.error('Timeout occurred while waiting for the function, but proceeding');
        } finally {
            await delay(1000);
        
            const data = await page.evaluate(() => {
                const queryIntentSnippetContent = document.getElementById('query-intent-snippet')?.textContent || 'Element not found';
                const llmOutputHtml = document.querySelector('.llm-output')?.innerHTML || 'Element not found';
                const resultCardsHref = Array.from(document.querySelectorAll('.results .result-card')).map(card => card.getAttribute('href'));
                return { queryIntentSnippetContent, llmOutputHtml, resultCardsHref };
            });
        
            try {
                const { queryIntentSnippetContent, llmOutputHtml, resultCardsHref } = data;
                const title = queryIntentSnippetContent;
                const summary = llmOutputHtml;
                const sources = JSON.stringify(resultCardsHref);

                if (title === "Element not found") {
                    console.log("nope, not there.");
                    crawlData(page, connection);
                    return;
                }
        
                const [result] = await connection.execute(
                    'INSERT INTO answerai (query, title, summary, sources) VALUES (?, ?, ?, ?)',
                    [query, title, summary, sources]
                );
        
                console.log('Data inserted with ID:', result.insertId, "and query:", title);
            } catch (error) {
                console.error('Error inserting data:', error);
            }
        }
    } catch (error) {
        console.error('Error operating2:', error);
    }

    crawlData(page, connection);
}

function newQuery() {
    let queries;
    try {
        queries = fs.readFileSync(queriesFilePath, 'utf8').split('\n').filter(Boolean);
    } catch (error) {
        console.error(`Error reading queries file: ${error}`);
        return null;
    }

    let usedQueries;
    try {
        usedQueries = fs.readFileSync(usedQueriesFilePath, 'utf8').split('\n').filter(Boolean);
    } catch (error) {
        usedQueries = [];
    }

    const availableQueries = queries.filter(query => !usedQueries.includes(query));
    if (availableQueries.length === 0) {
        console.log('No more queries available.');
        return null;
    }

    const nextQuery = availableQueries.shift();
    try {
        fs.writeFileSync(queriesFilePath, availableQueries.join('\n'), 'utf8');
    } catch (error) {
        console.error(`Error writing to queries file: ${error}`);
        return null;
    }
    try {
        fs.appendFileSync(usedQueriesFilePath, nextQuery + '\n', 'utf8');
    } catch (error) {
        console.error(`Error writing to used queries file: ${error}`);
        return null;
    }

    return nextQuery;
}

async function setHeaders(page){
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en'
    });

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "language", {
            get: function() {
                return "en-US";
            }
        });
        Object.defineProperty(navigator, "languages", {
            get: function() {
                return ["en-US", "en"];
            }
        });
    });
}