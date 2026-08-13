import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // wasm-vips / ffmpeg.wasm のマルチスレッド版は SharedArrayBuffer を使うため
  // COOP / COEP が必須。Vercel でもこの設定がそのまま効きます。
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // Emscripten 系グルー(wasm-vips / ffmpeg)が参照する Node 専用モジュールを無効化
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
