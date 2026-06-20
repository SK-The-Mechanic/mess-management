import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.105', '192.168.0.0/24'],
};

export default nextConfig;