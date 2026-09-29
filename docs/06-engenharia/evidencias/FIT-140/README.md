# Evidências — FIT-140 (login na primeira dobra)

Capturas com Playwright (Chromium) contra `next dev` local, nas alturas **visíveis** reais do navegador (barras do Safari/Chrome já descontadas). Proposta aprovada por Murilo em 29/09/2026 antes da implementação.

`01-primeira-dobra-antes-depois.jpg`: tela antes (main após FIT-139) × depois, em iPhone 15/Safari (393 × 659, padrão e erro), iPhone SE/Safari (375 × 553) e Android/Chrome (412 × 783).

| Viewport visível | Botão "Entrar" (antes → depois) | "Criar conta" (antes → depois) |
| --- | --- | --- |
| 375 × 553 (iPhone SE, Safari) | 496 → 468 px | **580 (fora da dobra)** → 530 px |
| 393 × 659 (iPhone 15, Safari) | 551 → 468 px | 635 → 530 px |
| 430 × 739 (iPhone Pro Max, Safari) | 623 → 504 px | 715 → 566 px |
| 412 × 783 (Android, Chrome) | 667 → 507 px | 759 → 569 px |
| 360 × 640 (Android pequeno) | 532 → 468 px | 616 → 552 px |

Com o erro de credenciais, o botão desce 18 px (468 → 486 px) e continua na primeira dobra.
