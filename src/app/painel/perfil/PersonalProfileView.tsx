"use client";

import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { formatBrazilianPhone } from "@/shared/lib/brazilianPhone";
import { STUDENT_RANGE_OPTIONS, studentRangeLabel } from "@/modules/personal-onboarding/studentRangeLabel";
import { LogoutButton } from "../LogoutButton";
import { BiometricSwitch } from "./BiometricSwitch";
import { MyDataRow, ProfileGroup, ProfileHeader, ProfileRow, TermsRow, sendJson } from "./ProfileParts";
import styles from "./ProfileParts.module.css";

interface PersonalProfileViewProps {
  name: string;
  /// Foto de perfil (EPIC-35).
  image: string | null;
  email: string;
  businessName: string;
  phone: string | null;
  cref: string | null;
  studentRange: PersonalStudentRangeEstimate;
  /// "Seu negócio": resumos já formatados no servidor.
  financeSummary: string;
  subscriptionSummary: string;
  exercisesSummary: string;
}

/// Perfil do Personal (proposta 10, com as opções do personal): "Seu
/// negócio" (Financeiro, Exercícios, Configurações) e "Conta" (Meus dados,
/// Minha assinatura, biometria, Termos e privacidade), com Sair ao final.
/// Os avisos deste aparelho ficam em Configurações.
export function PersonalProfileView(props: PersonalProfileViewProps) {
  const tenant = (body: Record<string, string>) => sendJson("/api/tenancy/meu-tenant", "PATCH", body);
  const professional = `${props.phone ? formatBrazilianPhone(props.phone) : "sem celular"} · ${props.cref ? `CREF ${props.cref}` : "sem CREF"} · ${studentRangeLabel(props.studentRange)}`;

  return (
    <div className={styles.profile}>
      <ProfileHeader name={props.name} image={props.image} email={props.email} badge={`Personal · ${props.businessName}`} />

      <ProfileGroup title="Seu negócio">
        <ProfileRow icon="financeiro" title="Financeiro" summary={props.financeSummary} href="/painel/financeiro" />
        <ProfileRow icon="exercicios" title="Exercícios" summary={props.exercisesSummary} href="/painel/exercicios" />
        <ProfileRow icon="config" title="Configurações" summary="Padrões de treino, novo aluno, avisos e segurança" href="/painel/configuracoes" />
      </ProfileGroup>

      <ProfileGroup title="Conta">
        <MyDataRow
          summary="Nome, e-mail, espaço e perfil profissional"
          fields={[
            { key: "name", title: "Nome", value: props.name, inputs: [{ name: "name", label: "Seu nome", autoComplete: "name", maxLength: 120 }], initial: { name: props.name }, save: (values) => tenant({ name: values.name! }), message: "Nome salvo" },
            {
              key: "email",
              title: "E-mail de acesso",
              value: props.email,
              inputs: [
                { name: "email", label: "Novo e-mail", type: "email", autoComplete: "email" },
                { name: "password", label: "Senha atual", type: "password", autoComplete: "current-password" },
              ],
              initial: { email: props.email, password: "" },
              save: (values) => sendJson("/api/minha-conta/email", "POST", { email: values.email, password: values.password }),
              message: "E-mail atualizado",
            },
            { key: "business", title: "Nome do espaço", value: props.businessName, hint: "Aparece para os seus alunos.", inputs: [{ name: "businessName", label: "Nome do espaço", maxLength: 80 }], initial: { businessName: props.businessName }, save: (values) => tenant({ businessName: values.businessName! }), message: "Nome do espaço salvo" },
            {
              key: "professional",
              title: "Perfil profissional",
              value: professional,
              inputs: [
                { name: "phone", label: "Celular", type: "tel", format: formatBrazilianPhone, optional: true },
                { name: "cref", label: "CREF (opcional)", maxLength: 20, optional: true },
                { name: "studentRangeEstimate", label: "Quantos alunos você atende", options: STUDENT_RANGE_OPTIONS },
              ],
              initial: { phone: formatBrazilianPhone(props.phone ?? ""), cref: props.cref ?? "", studentRangeEstimate: props.studentRange },
              save: (values) => tenant({ phone: values.phone!, cref: values.cref!, studentRangeEstimate: values.studentRangeEstimate! }),
              message: "Perfil profissional salvo",
            },
          ]}
        />
        <ProfileRow icon="assinatura" title="Minha assinatura" summary={props.subscriptionSummary} href="/painel/assinatura" />
        <BiometricSwitch />
        <TermsRow />
      </ProfileGroup>

      <div className={styles.logout}>
        <LogoutButton block label="Sair da conta" />
      </div>
    </div>
  );
}
