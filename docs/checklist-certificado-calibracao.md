# Checklist — Fluxo do Certificado de Calibração

Use este checklist para validar o fluxo de certificado (RBC, cache PDF, pré-preenchimento e app do técnico).

## Backend

- [ ] **Blade (RBC)**  
  - Tabela "Padrões de Medição Utilizados" tem texto explicando que os padrões possuem certificados RBC e que a rastreabilidade é feita pelos certificados dos pesos.  
  - Bloco "Declaração de Rastreabilidade" reforça RBC e **não** cita ABNT NBR ISO/IEC 17025 (apenas "procedimentos internos e boas práticas").

- [ ] **Cache PDF**  
  - Primeira geração: GET `equipments/{id}/calibrations/{calId}/pdf` gera e salva o PDF, retorna 200 e PDF.  
  - Segunda chamada: retorna o PDF em cache (mesmo conteúdo, sem regerar).

- [ ] **Preenchimento automático**  
  - Calibração sem `approved_by`: ao gerar certificado, preenche com o executante (`performed_by`).  
  - Calibração sem `laboratory`: preenche com nome do tenant ou "Laboratório de Calibração".

- [ ] **next_due_date padrão**  
  - Equipamento **sem** `calibration_interval_months`: ao adicionar calibração, `next_due_date` = data da calibração + 12 meses.

## App do técnico (frontend)

- [ ] **Leituras de calibração**  
  - Após "Salvar leituras" com sucesso, aparece o botão "Gerar certificado".  
  - Ao clicar: gera o certificado, abre o PDF em nova aba.

- [ ] **Tela Certificado**  
  - OS com **um único** equipamento: equipamento e calibração pré-selecionados.  
  - Calibração exibida é a da OS (quando existir) ou a mais recente.  
  - "Gerar Certificado" e "Gerar e imprimir" funcionam; "Gerar e imprimir" abre o PDF e exibe orientação para usar Ctrl+P na nova aba.

## Testes automatizados

- [ ] `php artisan test --filter test_add_calibration_sets_next_due_date_default_when_no_interval` passa.
