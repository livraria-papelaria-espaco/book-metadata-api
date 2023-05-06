const { newBrowser } = require("./puppeteer");

const fetchDataFromWook = async (isbn) => {
  let browser;
  try {
    browser = await newBrowser();
    const page = await browser.newPage();

    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);
    await page.setDefaultTimeout(10000);

    await Promise.all([
      page.goto(`https://www.wook.pt/pesquisa?keyword=${isbn}`),
      page.waitForSelector(".results-container"),
    ]);

    const searchResults = await page.$$(".results-container .results .product");

    if (searchResults.length !== 1) {
      throw new Error(
        `Expected to have 1 search result, but got ${searchResults.length} instead`
      );
    }

    const productLink = await searchResults[0].$("a.cover");

    if (!productLink) {
      throw new Error("Can't find link of product to click on");
    }

    await Promise.all([
      productLink.click(),
      page.waitForSelector("script[type='application/ld+json']"),
    ]);

    const metadata = await page.$eval(
      "script[type='application/ld+json']",
      (element) => element.innerText.trim()
    );

    const metadataJson = JSON.parse(metadata);

    return metadataJson;
  } catch (e) {
    console.error(new Date(), isbn, e);
  } finally {
    try {
      if (browser) await browser.close();
    } catch (e2) {
      console.error(new Date(), "Failed to close browser instance", e2);
    }
  }
  return;
};

module.exports = {
  setupEndpoints: (app) => {
    app.get("/wook/info-by-isbn/:isbn", async (req, res) => {
      const { isbn } = req.params;

      if (!isbn.startsWith("978") || !/^\d+$/.test(isbn)) {
        res.sendStatus(400);
        return;
      }

      try {
        const data = await fetchDataFromWook(isbn);

        res.json(data);
      } catch (e) {
        res.sendStatus(404);
      }
    });
  },
};
