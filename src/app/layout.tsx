import type { Metadata, Viewport } from "next";
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
  title: appName,
  description: "Gestão de alunos, treinos e evolução para personal trainers e para quem treina sozinho.",
};

/// `viewport-fit=cover` (AjustesPainel/AjustesTelas, 29/09/2026): sem ele,
/// `env(safe-area-inset-*)` vale sempre 0 no iOS e o respiro superior/
/// inferior do cabeçalho e da barra inferior não reserva relógio, ilha e
/// indicador de gesto.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#07090d",
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
