-- Aeróbicos (EPIC-28): intensidade do item por tempo, catálogo de
-- aeróbicos e marca da biblioteca inicial por espaço. Ver ADR-016.

CREATE TYPE "CardioIntensity" AS ENUM ('LEVE', 'MODERADO', 'FORTE', 'INTERVALADO');

ALTER TABLE "workout_exercises" ADD COLUMN "intensity" "CardioIntensity";

ALTER TABLE "tenants" ADD COLUMN "starterLibraryAt" TIMESTAMP(3);

INSERT INTO "exercises" ("id", "tenantId", "name", "origin", "status", "externalId", "type", "muscle", "equipments", "difficulty", "instructions", "safetyInfo", "createdAt", "updatedAt")
VALUES
  ('aerobico_esteira_caminhada', NULL, 'Caminhada na esteira', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-esteira-caminhada', 'Aeróbico', 'Aeróbico', 'esteira', 'iniciante', 'Caminhe em ritmo constante, postura ereta, sem se apoiar nas barras.', 'Comece devagar e aumente a velocidade aos poucos.', NOW(), NOW()),
  ('aerobico_esteira_inclinada', NULL, 'Esteira inclinada', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-esteira-inclinada', 'Aeróbico', 'Aeróbico', 'esteira', 'iniciante', 'Caminhe com a esteira inclinada entre 6% e 12%, passos firmes, sem segurar no painel.', 'Reduza a inclinação se sentir dor na lombar ou na panturrilha.', NOW(), NOW()),
  ('aerobico_esteira_corrida', NULL, 'Corrida na esteira', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-esteira-corrida', 'Aeróbico', 'Aeróbico', 'esteira', 'intermediario', 'Corra em ritmo que permita falar frases curtas. Pise com o meio do pé.', 'Use a trava de segurança da esteira.', NOW(), NOW()),
  ('aerobico_bike', NULL, 'Bike ergométrica', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-bike', 'Aeróbico', 'Aeróbico', 'bicicleta ergométrica', 'iniciante', 'Ajuste o banco na altura do quadril e pedale com cadência constante.', 'Joelho levemente flexionado no ponto mais baixo do pedal.', NOW(), NOW()),
  ('aerobico_spinning', NULL, 'Bike de spinning', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-spinning', 'Aeróbico', 'Aeróbico', 'bike de spinning', 'intermediario', 'Alterne cadência e carga conforme a etapa: sentado, em pé e tiros.', 'Mantenha a carga mínima ao pedalar em pé.', NOW(), NOW()),
  ('aerobico_eliptico', NULL, 'Elíptico', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-eliptico', 'Aeróbico', 'Aeróbico', 'elíptico', 'iniciante', 'Movimente braços e pernas juntos, sem tirar os pés das plataformas.', 'Baixo impacto: boa opção para quem sente os joelhos.', NOW(), NOW()),
  ('aerobico_escada', NULL, 'Simulador de escada', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-escada', 'Aeróbico', 'Aeróbico', 'simulador de escada', 'intermediario', 'Suba com o pé inteiro no degrau, tronco levemente inclinado à frente.', 'Evite apoiar o peso do corpo nas barras laterais.', NOW(), NOW()),
  ('aerobico_remo', NULL, 'Remo ergômetro', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-remo', 'Aeróbico', 'Aeróbico', 'remo ergômetro', 'intermediario', 'Empurre com as pernas, depois puxe com os braços; volte na ordem inversa.', 'Coluna neutra durante toda a remada.', NOW(), NOW()),
  ('aerobico_corda', NULL, 'Pular corda', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-corda', 'Aeróbico', 'Aeróbico', 'corda', 'intermediario', 'Saltos baixos na ponta dos pés, giro da corda pelos punhos.', 'Use tênis com amortecimento e superfície que não escorregue.', NOW(), NOW()),
  ('aerobico_corrida_rua', NULL, 'Corrida ao ar livre', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-corrida-rua', 'Aeróbico', 'Aeróbico', 'nenhum', 'intermediario', 'Corra em ritmo confortável, aumente o tempo antes de aumentar a velocidade.', 'Hidrate-se e evite os horários mais quentes.', NOW(), NOW()),
  ('aerobico_caminhada_rua', NULL, 'Caminhada ao ar livre', 'FITOS_CURATED', 'ATIVO', 'fitos:aerobico-caminhada-rua', 'Aeróbico', 'Aeróbico', 'nenhum', 'iniciante', 'Caminhe em ritmo acelerado, braços acompanhando o passo.', 'Prefira trajetos planos no começo.', NOW(), NOW())
ON CONFLICT ("origin", "externalId") DO NOTHING;
