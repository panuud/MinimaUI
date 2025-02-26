import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["oaidalleapiprodscus.blob.core.windows.net"],
  },
  serverExternalPackages: ['faiss-node'],
};

export default nextConfig;
