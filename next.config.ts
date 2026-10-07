import { existsSync } from "node:fs";

import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

if (existsSync("secrets.env")) {
  loadEnv({ path: "secrets.env" });
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "@prisma/client", "@react-pdf/renderer"],
};

export default nextConfig;
