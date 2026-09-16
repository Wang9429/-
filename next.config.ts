import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  output: githubPages ? "export" : "standalone",
  poweredByHeader: false,
  compress: true,
  images: { unoptimized: true },
  trailingSlash: githubPages,
  basePath: githubPages ? "/-" : "",
  assetPrefix: githubPages ? "/-" : "",
};

export default nextConfig;
