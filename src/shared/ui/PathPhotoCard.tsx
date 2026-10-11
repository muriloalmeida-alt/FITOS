import type { ReactNode } from "react";
import Image from "next/image";
import styles from "./PathPhotoCard.module.css";

interface PathPhotoCardImage {
  src: string;
  objectPosition?: string;
}

interface PathPhotoCardProps {
  step: string;
  category: string;
  title: string;
  description: string;
  image: PathPhotoCardImage;
  children: ReactNode;
}

/**
 * Cartão fotográfico de caminho de entrada (pacote visual 2026, FIT-131) —
 * `/comecar`, três caminhos reais (Personal/Aluno com convite/Livre).
 * Fotografia editorial de fundo (nunca avatar de pessoa real) com
 * gradiente inferior (nunca faixa chapada) para o rótulo/título/descrição
 * ficarem legíveis; `children` recebe o controle real de cada caminho
 * (botão de navegação ou formulário), sempre sobre os tokens de
 * chrome localmente redefinidos (mesmo padrão já usado em
 * `AppShell.module.css` `.trailing`) para continuar legível/acessível
 * sobre a foto escura.
 */
export function PathPhotoCard({ step, category, title, description, image, children }: PathPhotoCardProps) {
  return (
    <section className={styles.card}>
      <Image
        src={image.src}
        alt=""
        fill
        sizes="(min-width: 900px) 33vw, 100vw"
        style={image.objectPosition ? { objectPosition: image.objectPosition } : undefined}
        className={styles.image}
      />
      <div className={styles.overlay} />
      <div className={styles.header}>
        <p className={styles.meta}>
          {step} / {category}
        </p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.content}>{children}</div>
      <span className={styles.arrow} aria-hidden="true">
        ↗
      </span>
    </section>
  );
}
