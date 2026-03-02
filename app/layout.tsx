import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบทะเบียนคุมบันทึกการปรับปรุงรายการบัญชี",
  description: "แอปบันทึกรายการบัญชี พร้อมกรองข้อมูล และนำเข้า/ส่งออก Excel"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
