import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // wasm-vips / ffmpeg.wasm などで SharedArrayBuffer が必要になる可能性があるため、
  // COOP / COEP は残します。
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },

  // Next.js 16 では Turbopack が標準なので、webpack 設定は書かない。
  // 必要になった場合だけ turbopack.resolveAlias などを追加します。
};

export default nextConfig;