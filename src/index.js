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

const fetchFnacImage = async (url, i) => {
  console.log("fnacIMG", url);
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(response.data, "binary");
    const trimmedBuffer = await sharp(buffer).trim().jpeg().toBuffer();
    return trimmedBuffer;
  } catch (e) {
    return undefined;
  }
};

const fetchImagesFromFnac = async (isbn) => {
  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    console.log("page created");

    await Promise.all([
      page.waitForNavigation(),
      page.goto("https://www.fnac.pt"),
    ]);

    console.log(await page.content());

    await page.type("#Fnac_Search", isbn);

    await Promise.all([
      page.waitForNavigation(),
      page.click("#QuickSearchForm button"),
    ]);

    console.log("moved to page");

    const firstSearchResultLink = await page.$("a.Article-title");

    console.log("first search result link", firstSearchResultLink);

    if (!firstSearchResultLink) {
      // We encountered the captcha or the book was not found
      return [];
    }

    await firstSearchResultLink.click();

    const dataConfig = await page.$eval(
      "script.js-configuration",
      (node) => node.innerText
    );
    console.log("data config", dataConfig);

    await browser.close();

    const data = JSON.parse(dataConfig);

    const images = await Promise.all(
      data.productData.images.map((imgSet, i) =>
        fetchFnacImage(imgSet.zoom || imgSet.image || imgSet.thumb)
      )
    );
    return images.filter((i) => !!i);
  } catch (e) {
    console.log(e);
    return [];
  }
};

const app = express();

app.get("/cover/:isbn", async (req, res) => {
  const { isbn } = req.params;

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
