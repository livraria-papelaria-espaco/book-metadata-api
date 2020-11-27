const sharp = require("sharp");
const express = require("express");
const axios = require("axios");

const FNAC_SEARCH_REGEX = /<a href="(.+?)" class=".*?Article-title js-minifa-title js-Search-hashLink.*?">.+?<\/a>/;
const FNAC_REGEX = /<script type="application\/json" class="js-configuration">[^]*?({.+})[^]*?<\/script>/;
const FNAC_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const fetchFnacImage = async (url, i) => {
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
    const searchResponse = await axios.get(
      `https://www.fnac.pt/SearchResult/ResultList.aspx?Search=${isbn}`,
      {
        headers: FNAC_HEADERS,
      }
    );
    const productUrl = (FNAC_SEARCH_REGEX.exec(searchResponse.data) || [])[1];
    const response = await axios.get(productUrl, {
      headers: FNAC_HEADERS,
    });
    const dataString = (FNAC_REGEX.exec(response.data) || [])[1];
    const data = JSON.parse(dataString);

    const images = await Promise.all(
      data.productData.images.map((imgSet, i) =>
        fetchFnacImage(imgSet.zoom || imgSet.image || imgSet.thumb)
      )
    );
    return images.filter((i) => !!i);
  } catch (e) {
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
