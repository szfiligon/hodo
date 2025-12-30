import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@next/font'],
  },
  // 确保输出是独立的
  output: 'standalone',
  // 确保在 Electron 环境中正确工作
  distDir: '.next',
  // 移除 optimizeFonts 配置，因为在新版本的 Next.js 中这个选项已经被移除
};

export default nextConfig;
