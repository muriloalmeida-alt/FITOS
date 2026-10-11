import { SkeletonScreen } from "@/shared/ui/Skeleton";

/// Carregamento das telas do painel (FIT-171, S1 "Carregando"): esqueleto
/// no formato da tela, nunca um spinner solto.
export default function PainelLoading() {
  return <SkeletonScreen />;
}
