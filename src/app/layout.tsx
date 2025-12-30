import type { Metadata } from "next";
import "./globals.css";
import '@/lib/init'; // 导入初始化模块
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Hodo",
  description: "Like microsoft todo but better",
  icons: [
    {
      rel: 'icon',
      url: '/hodo-modern.ico',
      type: 'image/x-icon',
    },
    {
      rel: 'icon',
      url: '/hodo-modern.svg',
      type: 'image/svg+xml',
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
