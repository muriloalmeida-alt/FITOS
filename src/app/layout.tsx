import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { appName } from "@/shared/config/env";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  variable: "--fitos-font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${appName} — Fundação técnica`,
  description:
    "Fundação executável do FitOS: aplicação Next.js com o Design System M3 aplicado, sem funcionalidades de negócio implementadas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
