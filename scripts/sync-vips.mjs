import { copyFile, mkdir, readdir } from "node:fs/promises";

// Keep the publicly served runtime and WASM files aligned with package-lock.json.
const source = new URL(".", import.meta.resolve("wasm-vips"));
const destination = new URL("../public/vips/", import.meta.url);
await mkdir(destination, { recursive: true });
const files = (await readdir(source)).filter((name) => /\.(?:js|mjs|wasm|d\.ts)$/.test(name));
await Promise.all(files.map((name) => copyFile(new URL(name, source), new URL(name, destination))));
