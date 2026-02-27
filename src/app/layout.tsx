import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/common/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zotero Reader",
  description: "移动端 Zotero 文献阅读与翻译",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zotero Reader",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
