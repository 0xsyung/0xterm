import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages serves /app from app/index.html, not app.html — emit
  // directory index files so subroutes resolve on static hosting.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
