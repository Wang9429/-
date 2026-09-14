import type { Metadata } from "next";
import "./globals.css";
import { DemoStoreProvider } from "@/lib/store";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "海油工程｜穿透式监管平台（演示）",
  description:
    "海油工程穿透式监管平台可交互 Demo：组织及指标穿透、业务链对象联动、场景规则追溯与核查整改。全部主体、金额与业务记录为模拟数据。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <DemoStoreProvider>
          <AppShell>{children}</AppShell>
        </DemoStoreProvider>
      </body>
    </html>
  );
}
