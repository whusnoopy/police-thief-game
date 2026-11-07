// Optional deterministic export; ordinary builds use the checked-in WebP files.
// Install sharp separately or pass its module directory as the first argument.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || "sharp");
const source = new URL("../experiments/storybook/assets/", import.meta.url);
const destination = new URL("../src/assets/isometric/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ["police", "thief", "pig", "cow"]) {
  await sharp(fileURLToPath(new URL(`${name}.png`, source)))
    .resize({
      width: 384,
      height: 384,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(fileURLToPath(new URL(`${name}.webp`, destination)));
}
