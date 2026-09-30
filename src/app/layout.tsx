import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "huaychan | สั่งอาหารชุมชนรอบ มรภ. ชัยภูมิ",
  description: "เว็บแอพสั่งอาหาร huaychan สำหรับชุมชนห้วยชัน นาฝาย และนักศึกษา มรภ. ชัยภูมิ ร้านค้าในชุมชนจัดส่งเอง",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "huaychan",
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=8', sizes: 'any' },
      { url: '/icon-192.png?v=8', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png?v=8', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png?v=8', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=8" />
        <link rel="shortcut icon" href="/favicon.ico?v=8" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=8" />
      </head>
      <body className="bg-slate-50 text-gray-800 antialiased font-sans">
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
