-- EPIC-34: avisos de vencimento da assinatura já enviados.
CREATE TABLE "subscription_due_reminders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dueOn" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_due_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_due_reminders_tenantId_dueOn_kind_key" ON "subscription_due_reminders"("tenantId", "dueOn", "kind");

ALTER TABLE "subscription_due_reminders" ADD CONSTRAINT "subscription_due_reminders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_due_reminders" ADD CONSTRAINT "subscription_due_reminders_kind_check" CHECK ("kind" IN ('5_DIAS', 'NO_DIA'));
