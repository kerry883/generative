import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol:"https",
        hostname:"videos.foldex.space",
      }
    ],
  },
};

export default nextConfig;
