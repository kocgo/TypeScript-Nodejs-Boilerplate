import puppeteer from "puppeteer";
import Binance from "node-binance-api";
require("dotenv").config();

const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET,
});

const followedUser = "BoJack";
const channelName = "GF";
const quantity = 1;
let stepSize;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--window-size=1920,1080",
      '--user-agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"',
    ],
    defaultViewport: undefined,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
  );

  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  await page.goto("https://discord.com/login");

  // Clicks on an element at position x,y
  async function clickOnElement(elem: string, x = null, y = null) {
    const element = await page.$(elem);

    await page.waitForTimeout(2000);

    const rect = await page.evaluate((el) => {
      const { top, left, width, height } = el.getBoundingClientRect();
      return { top, left, width, height };
    }, element);

    // Use given position or default to center
    const _x = x !== null ? x : rect.width / 2;
    const _y = y !== null ? y : rect.height / 2;

    await page.mouse.click(rect.left + _x, rect.top + _y);
  }

  async function clickByText(text: string) {
    const els = await page.$x(`//div[contains(text(), '${text}')]`);

    if (els.length > 0) {
      await els[0].click();
    } else {
      throw new Error("Link not found");
    }
  }

  await page.focus('input[name="email"]');
  await page.keyboard.type("gokhan_koc@windowslive.com");

  await page.focus('input[name="password"]');
  await page.keyboard.type(process.env.PASSWORD as string);

  await clickOnElement('button[type="submit"]');

  await page.waitForSelector(`div[aria-label="Home"]`);
  await page.waitForTimeout(3000);
  await clickByText(channelName);

  await page.focus(`div[aria-label="Message #genel"]`);

  let state = {
    lastMessage: {
      author: "",
      text: "",
    },
  };

  // Last Message
  const getLastMessage = async () =>
    await page.$$eval(`div[role="document"]`, (elements) => {
      const last = elements[elements.length - 1];
      return {
        author: last.children[0].children[1].children[0].innerHTML,
        text: last.children[1].innerHTML,
      };
    });

  async function loop() {
    const res = await getLastMessage();
    if (res.author !== followedUser || res.text === state.lastMessage.text)
      return;

    state.lastMessage = res;

    const reg = RegExp(/[#][A-Za-z]{3,4}/);
    const coinName = reg.exec(res.text)?.[0].split("#")[1];

    if (!coinName) return;

    let price;

    await new Promise((resolve, reject) =>
      binance.exchangeInfo(function (error, data) {
        let minimums = {};
        for (let obj of data.symbols) {
          let filters = { status: obj.status };
          if (obj.symbol === "WINUSDT") {
            console.log(obj);
            for (let filter of obj.filters) {
              if (filter.filterType == "LOT_SIZE") {
                stepSize = filter.stepSize;
                resolve("ok");
              }
            }
          }
        }
      })
    );

    binance.prices(`${coinName.toUpperCase()}USDT`, async (error, ticker) => {
      try {
        let price = ticker[`${coinName.toUpperCase()}USDT`];

        await page.keyboard.type(
          `${followedUser} gave a coin name: ${coinName}, which is priced: ${price}`
        );

        await page.keyboard.press("Enter");

        binance.marketBuy(
          `${coinName.toUpperCase()}USDT`,
          6200,
          (error, response) => {
            if (error) {
              console.log(error.body, error.statusCode);
            } else if (response) {
              binance.balance((error, balances) => {
                if (error) return console.error(error);
                console.info("balances()", balances);

                const amount = binance.roundStep(
                  parseFloat(balances["WIN"].available),
                  stepSize
                );

                setTimeout(() => {
                  binance.marketSell(
                    `${coinName.toUpperCase()}USDT`,
                    amount,
                    (error, response) => {
                      if (error) {
                        console.log(error.body, error.statusCode);
                      }
                    }
                  );
                }, 15000);
              });
            }
            console.log(Object.keys(response));
          }
        );
      } catch (e) {
        console.log(e);
      }
    });
  }

  setInterval(loop, 100);
})();
