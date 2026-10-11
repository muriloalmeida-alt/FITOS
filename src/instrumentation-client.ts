import { sentryOptions } from "@/shared/lib/sentryOptions";

/// Monitoramento de erros no navegador (EPIC-49): liga o Sentry só quando
/// `NEXT_PUBLIC_SENTRY_DSN` está definido; carregado à parte, sem pesar no
/// app quando desligado.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init(sentryOptions(dsn, process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT));
      (window as unknown as { __fitosSentry?: typeof Sentry }).__fitosSentry = Sentry;
    })
    .catch(() => undefined);
}
