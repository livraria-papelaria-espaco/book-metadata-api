const { newBrowser } = require("./puppeteer");

const ALLOWED_ORIGINS = [
  "www.portoeditora.pt",
  "www.arealeditores.pt",
  "www.raizeditora.pt",
];

const fetchCodeFromPe = async (origin, bookId) => {
  let browser;
  try {
    browser = await newBrowser();
    const page = await browser.newPage();

    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);

    await Promise.all([
      page.waitForNavigation(),
      page.goto(`https://${origin}/produtos/ficha/${bookId}`),
    ]);

    const bookCode = await page.$eval(
      ".product-head-details .text-label::-p-text(Código:)",
      (element) => {
        return element?.parentElement
          ?.querySelector(".text-value")
          ?.innerText?.trim();
      }
    );

    return bookCode;
  } catch (e) {
    console.error(new Date(), origin, bookId, e);
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
    app.get(
      "/portoeditora/bookid-to-pe-code/:origin/:bookId",
      async (req, res) => {
        const { origin, bookId } = req.params;

        if (!ALLOWED_ORIGINS.includes(origin)) {
          res.sendStatus(400);
          return;
        }

        if (!/^\d+$/.test(bookId)) {
          res.sendStatus(400);
          return;
        }

        const code = await fetchCodeFromPe(origin, bookId);

        res.json({ code: code || "" });
      }
    );
  },
};
