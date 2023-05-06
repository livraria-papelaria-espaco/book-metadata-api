const sharp = require("sharp");
const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const { newBrowser } = require("./puppeteer");
const portoeditora = require("./portoeditora");
const wook = require("./wook");

let cookies = [];

fs.readFile("cookies.json", "utf-8")
  .then((content) => (cookies = JSON.parse(content)))
  .catch(() => console.log("Could not load cookies from cookies.json"));

const fetchFnacImage = async (url, i) => {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data, "binary");
    const trimmedBuffer = await sharp(buffer).trim().jpeg().toBuffer();
    return trimmedBuffer;
  } catch (e) {
    console.error(new Date(), "Failed to process image", e);
    return undefined;
  }
};

const fetchImagesFromFnac = async (isbn) => {
  let browser;
  try {
    browser = await newBrowser();
    const page = await browser.newPage();

    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);

    await page.setCookie(...cookies);

    await Promise.all([
      page.waitForNavigation(),
      page.goto(
        `https://www.fnac.pt/SearchResult/ResultList.aspx?SCat=0%211&Search=${isbn}&sft=1&sa=0`
      ),
    ]);

    const firstSearchResultLink = await page.$(".resultList a.Article-title");

    if (!firstSearchResultLink) {
      // We encountered the captcha or the book was not found
      return [];
    }

    await Promise.all([
      page.waitForNavigation(),
      firstSearchResultLink.click(),
      page.waitForNavigation(),
    ]);

    await page.waitForSelector("section.js-product-medias", { timeout: 5000 });

    const dataConfig = await page.$eval(
      "section.js-product-medias",
      (node) => node.dataset["medias"]
    );

    cookies = await page.cookies();

    await browser.close();
    browser = undefined;

    const data = JSON.parse(dataConfig);

    const images = await Promise.all(
      data.map((imgSet, i) => fetchFnacImage(imgSet.src || imgSet.thumbnailSrc))
    );
    return images.filter((i) => !!i);
  } catch (e) {
    console.error(new Date(), e);
  } finally {
    try {
      if (browser) await browser.close();
    } catch (e2) {
      console.error(new Date(), "Failed to close browser instance", e2);
    }
    await fs.writeFile("cookies.json", JSON.stringify(cookies), "utf-8");
  }
  return [];
};

const app = express();

app.get("/cover/:isbn", async (req, res) => {
  const { isbn } = req.params;

  if (!isbn.startsWith("978") || !/^\d+$/.test(isbn)) {
    res.sendStatus(400);
    return;
  }

  const images = await fetchImagesFromFnac(isbn);

  if (images.length === 0) {
    res.sendStatus(404);
  } else {
    res.contentType("image/jpeg");
    res.send(images[0]);
  }
});

portoeditora.setupEndpoints(app);
wook.setupEndpoints(app);

app.listen(process.env.PORT || 5000);

console.log(`Listening on port ${process.env.PORT || 5000}`);
