const puppeteer = require("puppeteer-extra");
const { executablePath } = require("puppeteer");

// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

module.exports = {
  newBrowser: () =>
    puppeteer.launch({
      headless: "new",
      executablePath: executablePath(),
    }),
};
