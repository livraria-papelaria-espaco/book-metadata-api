const sharp = require("sharp");
const express = require("express");
const axios = require("axios");
const puppeteer = require("puppeteer");

const FNAC_SEARCH_REGEX =
  /<a href="(.+?)" class=".*?Article-title js-minifa-title js-Search-hashLink.*?">.+?<\/a>/;
const FNAC_REGEX =
  /<script type="application\/json" class="js-configuration">[^]*?({.+})[^]*?<\/script>/;
const FNAC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.0 Safari/537.36";

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
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
    const page = await browser.newPage();

    await page.setUserAgent(USER_AGENT);
    await page.setJavaScriptEnabled(true);
    await page.setDefaultNavigationTimeout(0);

    await Promise.all([
      page.waitForNavigation(),
      page.goto("https://www.fnac.pt"),
    ]);

    /*await page.type("#Fnac_Search", isbn);

    await Promise.all([
      page.waitForNavigation(),
      page.click("#QuickSearchForm button"),
    ]);*/

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

    await page.waitForSelector("script.js-configuration");

    const dataConfig = await page.$eval(
      "script.js-configuration",
      (node) => node.innerText
    );

    await browser.close();

    const data = JSON.parse(dataConfig);

    const images = await Promise.all(
      data.productData.images.map((imgSet, i) =>
        fetchFnacImage(imgSet.zoom || imgSet.image || imgSet.thumb)
      )
    );
    return images.filter((i) => !!i);
  } catch (e) {
    console.error(new Date(), e);
    try {
      if (browser) await browser.close();
    } catch (e2) {
      console.error(new Date(), "Failed to close browser instance", e2);
    }
    return [];
  }
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

app.listen(process.env.PORT || 5000);

console.log(`Listening on port ${process.env.PORT || 5000}`);
