const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const axios = require("axios");

puppeteer.use(StealthPlugin());

const downloadImages = async (url, counter) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const navigateWithRetries = async (url, retries = 5) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Navigating to ${url}, attempt ${attempt}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        return;
      } catch (error) {
        console.error(`Attempt ${attempt} to navigate to ${url} failed: ${error.message}`);
        if (attempt === retries) throw error;
        console.log(`Retrying navigation to ${url} (attempt ${attempt + 1})...`);
      }
    }
  };

  try {
    await navigateWithRetries(url);

    // Wait for the images to load
    await page.waitForSelector(
      ".next-slick-list .next-slick-track .next-slick-slide .item-gallery__image-wrapper img",
      { timeout: 10000 }
    );

    // Get the image URLs
    const imageUrls = await page.evaluate(() => {
      const imageElements = document.querySelectorAll(
        ".next-slick-list .next-slick-track .next-slick-slide .item-gallery__image-wrapper img"
      );
      return Array.from(imageElements).map(img => img.getAttribute("src"));
    });

    console.log(`Found ${imageUrls.length} images to download.`);

    // Create a directory to save images if it doesn't exist
    const dir = "./darazimages";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    // Download and save each image
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const firstUnderscoreIndex = imageUrl.indexOf("_");
      const convertedUrl =
        firstUnderscoreIndex !== -1
          ? imageUrl.substring(0, firstUnderscoreIndex)
          : imageUrl;
      for (let attempt = 1; attempt <= 3; attempt++) { // Retry logic
        try {
          const response = await axios.get(convertedUrl, {
            responseType: "arraybuffer",
          });
          const buffer = Buffer.from(response.data, "binary");
          const imageName = `${counter}${String.fromCharCode(97 + i)}`; // 'a' for first image, 'b' for second, and so on
          fs.writeFileSync(`./darazimages/${imageName}.webp`, buffer);
          console.log(`Downloaded image ${convertedUrl} successfully.`);
          break; // Exit retry loop if download is successful
        } catch (err) {
          console.error(`Attempt ${attempt} to download image ${convertedUrl} failed: ${err.message}`);
          if (attempt === 3) {
            console.error(`Failed to download image ${convertedUrl} after 3 attempts.`);
          } else {
            console.log(`Retrying download for image ${convertedUrl} (attempt ${attempt + 1})...`);
          }
        }
      }
    }

    console.log(`Downloaded images from ${url} successfully with counter ${counter}`);

    await browser.close();
  } catch (error) {
    console.error(`Error downloading images from ${url}:`, error);
    await browser.close();
  }
};

const urls = [
  "https://www.daraz.com.np/products/vga-to-vga-cable-15m-i111651-s717292.html?search=1",
  "https://www.daraz.com.np/products/printer-cable-15-meter-i111837-s717737.html?search=1",
  "https://www.daraz.com.np/products/printer-cable-15-meter-i112029117-s1030300566.html?search=1",
  "https://www.daraz.com.np/products/desktop-power-cable-15m-i111718-s717452.html?search=1",
  "https://www.daraz.com.np/products/laptop-power-cable-i111717-s717449.html?search=1",
];// Add more URLs as needed

console.log(`Processing ${urls.length} URLs.`);

const processInBatches = async (urlList, batchSize, startingCounter) => {
  let counter = startingCounter;
  for (let i = 0; i < urlList.length; i += batchSize) {
    const batch = urlList.slice(i, i + batchSize);
    await Promise.all(
      batch.map((url, index) => downloadImages(url, counter + index))
    );
    counter += batchSize;
  }
};

// Process URLs in batches of 10 starting from counter 1
processInBatches(urls, 10, 1);
