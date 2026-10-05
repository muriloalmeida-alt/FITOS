"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui";
import { signOut } from "@/modules/identity/auth-client";

export function LogoutButton({ block = false }: { block?: boolean } = {}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    await signOut();
    router.push("/entrar");
    router.refresh();
  }

  return (
    <Button type="button" variant="outlined" block={block} onClick={handleLogout} disabled={isSubmitting}>
      {isSubmitting ? "Saindo…" : "Sair"}
    </Button>
  );
}
