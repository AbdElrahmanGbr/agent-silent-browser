/**
 * Visual Regression & Pixel Diffing Engine
 * Uses pixelmatch + pngjs to detect UI changes down to the exact pixel.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const rawPixelmatch = require('pixelmatch');
const pixelmatch = rawPixelmatch.default || rawPixelmatch;

/**
 * Compare two PNG files and write diff image if mismatch is found.
 * @param {string} baselinePath - Path to baseline image (Before)
 * @param {string} currentPath - Path to newly captured image (After)
 * @param {string} diffOutputPath - Path to write the diff image
 * @param {object} options - Options: { threshold: 0.1, maxDiffPercentage: 0.05 }
 * @returns {object} { isMatch, diffPixels, totalPixels, mismatchPercentage, diffPath }
 */
function compareImages(baselinePath, currentPath, diffOutputPath, options = {}) {
  if (!fs.existsSync(baselinePath)) {
    return {
      isMatch: true,
      isNew: true,
      message: 'Baseline image not found. Creating baseline.',
      diffPixels: 0,
      mismatchPercentage: 0
    };
  }

  const baselineData = fs.readFileSync(baselinePath);
  const currentData = fs.readFileSync(currentPath);

  const img1 = PNG.sync.read(baselineData);
  const img2 = PNG.sync.read(currentData);

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // Resize images if dimensions differ
  let resizedImg1 = img1;
  let resizedImg2 = img2;

  if (img1.width !== width || img1.height !== height) {
    resizedImg1 = new PNG({ width, height });
    PNG.bitblt(img1, resizedImg1, 0, 0, img1.width, img1.height, 0, 0);
  }

  if (img2.width !== width || img2.height !== height) {
    resizedImg2 = new PNG({ width, height });
    PNG.bitblt(img2, resizedImg2, 0, 0, img2.width, img2.height, 0, 0);
  }

  const diff = new PNG({ width, height });
  const threshold = options.threshold !== undefined ? options.threshold : 0.1;

  const diffPixels = pixelmatch(
    resizedImg1.data,
    resizedImg2.data,
    diff.data,
    width,
    height,
    {
      threshold,
      diffColor: [255, 0, 128], // Magenta highlighting for diffs
      diffColorAlt: [0, 255, 255],
      alpha: 0.8
    }
  );

  const totalPixels = width * height;
  const mismatchPercentage = parseFloat(((diffPixels / totalPixels) * 100).toFixed(3));
  const maxAllowedPercentage = options.maxDiffPercentage !== undefined ? options.maxDiffPercentage : 0.05;
  const isMatch = mismatchPercentage <= maxAllowedPercentage;

  if (!isMatch && diffOutputPath) {
    const dir = path.dirname(diffOutputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));
  }

  return {
    isMatch,
    isNew: false,
    diffPixels,
    totalPixels,
    mismatchPercentage,
    diffPath: !isMatch ? diffOutputPath : null
  };
}

module.exports = {
  compareImages
};
