import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@next/font'],
  },
  distDir: '.next',
  // 移除 optimizeFonts 配置，因为在新版本的 Next.js 中这个选项已经被移除
};

export default nextConfig;
