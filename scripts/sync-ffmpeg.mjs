import { copyFile, mkdir } from "node:fs/promises";

// Serve the package worker as native ESM so its runtime core import is preserved.
// Copy from the installed versions to keep the worker and WASM assets in sync.
const destination = new URL("../public/ffmpeg/", import.meta.url);
const worker = import.meta.resolve("@ffmpeg/ffmpeg/worker");
const core = import.meta.resolve("@ffmpeg/core");

await mkdir(destination, { recursive: true });
await Promise.all([
  ...["worker.js", "const.js", "errors.js"].map((name) =>
    copyFile(new URL(name, worker), new URL(name, destination)),
  ),
  copyFile(new URL(core), new URL("ffmpeg-core.js", destination)),
  copyFile(new URL(import.meta.resolve("@ffmpeg/core/wasm")), new URL("ffmpeg-core.wasm", destination)),
]);
