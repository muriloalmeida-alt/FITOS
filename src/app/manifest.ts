import type { MetadataRoute } from "next";

/// Web App Manifest (PWA) — FIT-124/EPIC-16. Ícones a partir dos vetores
/// oficiais da marca (`public/marca/`, docs/03-design/MARCA-FITOS-OFICIAL.md).
/// Não existia manifesto nem ícone de PWA antes desta História.
/// `background_color` escuro (FIT-141): é a cor da abertura nativa do PWA,
/// que emenda sem clarão na tela de abertura do app (`SplashScreen`).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitOS",
    short_name: "FitOS",
    description: "Gestão de alunos, treinos e evolução para personal trainers e para quem treina sozinho.",
    start_url: "/",
    display: "standalone",
    background_color: "#07090D",
    theme_color: "#101C2C",
    icons: [
      { src: "/marca/fitos-icone.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/marca/fitos-icone-192px.png", type: "image/png", sizes: "192x192" },
      { src: "/marca/fitos-icone-512px.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
