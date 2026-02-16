// =============================================================================
// Central de Automação — Modelos Prontos para o Sistema Kalibrium
// 100 templates específicos para empresa de calibração de balanças
// =============================================================================

export type TemplateCategory =
    | 'os' | 'orçamentos' | 'chamados' | 'financeiro' | 'equipamentos'
    | 'técnicos' | 'estoque' | 'clientes' | 'contratos' | 'rh' | 'frota'

export interface AutomationTemplate {
    id: string
    name: string
    description: string
    category: TemplateCategory
    trigger_label: string
    action_label: string
    trigger_event: string
    action_type: string
    recommended?: boolean
}

export const CATEGORY_META: Record<TemplateCategory, { label: string; color: string; bg: string; border: string }> = {
    os: { label: 'Ordens de Serviço', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    orçamentos: { label: 'Orçamentos', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
    chamados: { label: 'Chamados', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    financeiro: { label: 'Financeiro', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    equipamentos: { label: 'Equipamentos', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    técnicos: { label: 'Técnicos', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    estoque: { label: 'Estoque', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    clientes: { label: 'Clientes / CRM', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
    contratos: { label: 'Contratos', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
    rh: { label: 'RH / Ponto', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
    frota: { label: 'Frota', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
}

export const TRIGGER_EVENT_LABELS: Record<string, string> = {
    'os.created': 'OS criada',
    'os.assigned': 'OS atribuída a técnico',
    'os.completed': 'OS concluída',
    'os.status_changed': 'Status da OS alterado',
    'os.cancelled': 'OS cancelada',
    'os.no_invoice': 'OS concluída sem fatura',
    'os.stalled': 'OS parada há vários dias',
    'os.sla_breach': 'SLA da OS ultrapassado',
    'os.travel_requested': 'Deslocamento solicitado',
    'os.no_checklist': 'OS sem checklist preenchido',
    'os.over_budget': 'Despesas acima do orçado na OS',
    'os.after_hours': 'OS concluída fora do horário',
    'os.scheduled': 'OS agendada',
    'os.followup_due': 'Follow-up de OS pendente',
    'os.no_signature': 'OS sem assinatura do cliente',
    'quote.created': 'Orçamento criado',
    'quote.approved': 'Orçamento aprovado pelo cliente',
    'quote.rejected': 'Orçamento rejeitado pelo cliente',
    'quote.expiring': 'Orçamento próximo do vencimento',
    'quote.expired': 'Orçamento vencido',
    'quote.internal_approved': 'Orçamento aprovado internamente',
    'quote.discount_requested': 'Desconto solicitado no orçamento',
    'quote.pending': 'Orçamento pendente de resposta',
    'chamado.created': 'Chamado aberto',
    'chamado.assigned': 'Chamado atribuído',
    'chamado.unassigned': 'Chamado sem atribuição',
    'chamado.resolved': 'Chamado resolvido',
    'chamado.reopened': 'Chamado reaberto',
    'chamado.stalled': 'Chamado pendente há muito tempo',
    'chamado.daily_summary': 'Resumo diário de chamados',
    'payment.due_soon': 'Pagamento próximo do vencimento',
    'payment.due_today': 'Pagamento vence hoje',
    'payment.overdue': 'Pagamento vencido',
    'payment.overdue_15': 'Inadimplência há 15+ dias',
    'payment.overdue_30': 'Inadimplência há 30+ dias',
    'payment.received': 'Pagamento recebido',
    'payable.due_soon': 'Conta a pagar vencendo',
    'expense.submitted': 'Despesa registrada pelo técnico',
    'expense.high_value': 'Despesa acima do valor limite',
    'commission.ready': 'Comissão pronta para fechamento',
    'commission.released': 'Comissão liberada',
    'cash.low_balance': 'Saldo do caixa do técnico baixo',
    'invoice.created': 'Nota fiscal emitida',
    'equipment.calibration_due': 'Calibração vencendo em 30 dias',
    'equipment.calibration_15d': 'Calibração vencendo em 15 dias',
    'equipment.calibration_overdue': 'Calibração vencida/atrasada',
    'equipment.created': 'Novo equipamento cadastrado',
    'equipment.no_service': 'Equipamento sem serviço há 1 ano',
    'equipment.no_certificate': 'OS sem certificado gerado',
    'equipment.certificate_ready': 'Certificado de calibração pronto',
    'equipment.service_scheduled': 'Calibração programada se aproximando',
    'weight.certificate_expiring': 'Certificado de peso padrão vencendo',
    'technician.no_timesheet': 'Técnico sem apontamento de horas',
    'technician.idle': 'Técnico sem OS atribuída',
    'technician.daily_schedule': 'Início do dia do técnico',
    'technician.high_km': 'Km rodado acima do esperado',
    'technician.expenses_pending': 'Despesas pendentes de prestação',
    'technician.checklist_done': 'Checklist preenchido em campo',
    'technician.no_signature': 'Assinatura não coletada na OS',
    'technician.photos_pending': 'Fotos pendentes de sincronização',
    'stock.low': 'Estoque mínimo atingido',
    'stock.out': 'Produto sem estoque',
    'stock.reorder': 'Ponto de reposição atingido',
    'stock.no_movement': 'Produto sem movimentação há 90 dias',
    'stock.transfer_requested': 'Transferência de almoxarifado solicitada',
    'stock.consumed_no_stock': 'Item consumido sem estoque na OS',
    'stock.weekly_report': 'Relatório semanal de estoque',
    'stock.lot_expiring': 'Lote próximo do vencimento',
    'customer.created': 'Cliente cadastrado',
    'customer.contact_due': 'Próximo contato agendado com lead',
    'customer.no_contact': 'Lead sem contato há 15+ dias',
    'customer.anniversary': 'Aniversário de parceria com cliente',
    'customer.inactive': 'Cliente sem serviço há 6+ meses',
    'customer.first_os': 'Primeira OS do cliente concluída',
    'customer.complaints': 'Reclamações recorrentes do cliente',
    'customer.pipeline_advanced': 'Oportunidade avançou no pipeline',
    'customer.pipeline_stalled': 'Lead parado no pipeline há 30+ dias',
    'customer.new_services': 'Novos serviços disponíveis',
    'contract.service_due': 'Serviço programado se aproximando',
    'contract.expiring': 'Contrato próximo do vencimento',
    'contract.expired': 'Contrato expirado sem renovação',
    'contract.visit_scheduled': 'Visita programada do contrato',
    'contract.renewal_due': 'Renovação de contrato pendente',
    'hr.no_clock': 'Colaborador sem registro de ponto',
    'hr.clock_adjustment': 'Ajuste de ponto solicitado',
    'hr.overtime': 'Banco de horas acima do limite',
    'hr.document_expiring': 'Documento de colaborador vencendo',
    'hr.vacation_upcoming': 'Férias programadas na próxima semana',
    'fleet.maintenance_due': 'Revisão do veículo programada',
    'fleet.license_expiring': 'IPVA/Licenciamento vencendo',
    'fleet.high_consumption': 'Consumo de combustível acima da média',
    'fleet.fine_received': 'Multa recebida em veículo',
    'fleet.insurance_expiring': 'Seguro do veículo vencendo',
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
    send_notification: 'Enviar notificação no sistema',
    send_email: 'Enviar e-mail',
    send_whatsapp: 'Enviar WhatsApp',
    create_alert: 'Criar alerta interno',
    create_task: 'Criar tarefa de acompanhamento',
    create_chamado: 'Criar chamado técnico',
    create_os: 'Criar ordem de serviço',
    update_status: 'Alterar status automaticamente',
    assign_user: 'Atribuir responsável',
    send_report: 'Gerar e enviar relatório',
    webhook: 'Disparar webhook',
}

export const TEMPLATES: AutomationTemplate[] = [
    // =========================================================================
    // ORDENS DE SERVIÇO (15 templates)
    // =========================================================================
    {
        id: 'os_001', name: 'Notificar técnico sobre nova OS',
        description: 'Envia notificação ao técnico quando uma nova OS é atribuída a ele, garantindo que ele saiba imediatamente.',
        category: 'os', trigger_event: 'os.assigned', action_type: 'send_notification',
        trigger_label: 'OS atribuída a um técnico', action_label: 'Enviar notificação ao técnico', recommended: true,
    },
    {
        id: 'os_002', name: 'Avisar admin quando OS for concluída',
        description: 'Notifica o administrador sempre que um técnico marcar uma OS como concluída no campo.',
        category: 'os', trigger_event: 'os.completed', action_type: 'send_notification',
        trigger_label: 'OS concluída pelo técnico', action_label: 'Notificar administrador', recommended: true,
    },
    {
        id: 'os_003', name: 'Alerta: OS concluída sem faturamento (24h)',
        description: 'Alerta crítico quando uma OS está concluída há mais de 24 horas sem que a fatura/recebível tenha sido gerada.',
        category: 'os', trigger_event: 'os.no_invoice', action_type: 'create_alert',
        trigger_label: 'OS concluída sem fatura há 24h', action_label: 'Criar alerta crítico', recommended: true,
    },
    {
        id: 'os_004', name: 'Alerta: OS concluída sem faturamento (48h)',
        description: 'Escalação: envia alerta por WhatsApp ao admin quando OS está sem faturamento há mais de 48 horas.',
        category: 'os', trigger_event: 'os.no_invoice', action_type: 'send_whatsapp',
        trigger_label: 'OS sem fatura há 48h', action_label: 'Enviar WhatsApp ao admin',
    },
    {
        id: 'os_005', name: 'WhatsApp ao cliente: técnico a caminho',
        description: 'Envia mensagem automática por WhatsApp ao cliente quando o técnico iniciar o deslocamento para o atendimento.',
        category: 'os', trigger_event: 'os.travel_requested', action_type: 'send_whatsapp',
        trigger_label: 'Técnico inicia deslocamento', action_label: 'Enviar WhatsApp ao cliente', recommended: true,
    },
    {
        id: 'os_006', name: 'Lembrete: OS agendada para amanhã',
        description: 'Envia lembrete ao técnico 1 dia antes da data agendada da OS para que ele se prepare.',
        category: 'os', trigger_event: 'os.scheduled', action_type: 'send_notification',
        trigger_label: '1 dia antes da OS agendada', action_label: 'Lembrar técnico',
    },
    {
        id: 'os_007', name: 'Notificar admin sobre cancelamento de OS',
        description: 'Avisa o administrador imediatamente quando qualquer OS for cancelada no sistema.',
        category: 'os', trigger_event: 'os.cancelled', action_type: 'send_notification',
        trigger_label: 'OS cancelada', action_label: 'Notificar administrador',
    },
    {
        id: 'os_008', name: 'Alerta: SLA da OS ultrapassado',
        description: 'Cria alerta quando o prazo de SLA definido para a OS for excedido, indicando atraso no atendimento.',
        category: 'os', trigger_event: 'os.sla_breach', action_type: 'create_alert',
        trigger_label: 'SLA ultrapassado', action_label: 'Criar alerta de SLA', recommended: true,
    },
    {
        id: 'os_009', name: 'Alerta: OS parada há 3+ dias',
        description: 'Identifica ordens de serviço que estão sem movimentação há mais de 3 dias e alerta o responsável.',
        category: 'os', trigger_event: 'os.stalled', action_type: 'create_alert',
        trigger_label: 'OS sem movimentação há 3 dias', action_label: 'Criar alerta interno',
    },
    {
        id: 'os_010', name: 'Alerta: OS concluída sem checklist',
        description: 'Avisa quando uma OS é marcada como concluída mas o checklist de calibração não foi preenchido.',
        category: 'os', trigger_event: 'os.no_checklist', action_type: 'create_alert',
        trigger_label: 'OS concluída sem checklist', action_label: 'Criar alerta',
    },
    {
        id: 'os_011', name: 'Confirmar agendamento ao cliente por e-mail',
        description: 'Envia e-mail automático de confirmação ao cliente quando uma OS é agendada.',
        category: 'os', trigger_event: 'os.scheduled', action_type: 'send_email',
        trigger_label: 'OS agendada', action_label: 'Enviar e-mail ao cliente',
    },
    {
        id: 'os_012', name: 'Notificar sobre pedido de autorização de deslocamento',
        description: 'Avisa o admin quando um técnico solicita autorização para iniciar o deslocamento até o cliente.',
        category: 'os', trigger_event: 'os.travel_requested', action_type: 'send_notification',
        trigger_label: 'Autorização de deslocamento solicitada', action_label: 'Notificar admin',
    },
    {
        id: 'os_013', name: 'Alerta: despesas da OS acima do orçado',
        description: 'Alerta quando as despesas lançadas numa OS ultrapassam o valor previsto no orçamento original.',
        category: 'os', trigger_event: 'os.over_budget', action_type: 'create_alert',
        trigger_label: 'Despesas acima do orçamento', action_label: 'Criar alerta',
    },
    {
        id: 'os_014', name: 'Follow-up 30 dias após OS concluída',
        description: 'Cria uma tarefa de acompanhamento 30 dias após a conclusão da OS para verificar satisfação do cliente.',
        category: 'os', trigger_event: 'os.followup_due', action_type: 'create_task',
        trigger_label: '30 dias após conclusão da OS', action_label: 'Criar tarefa de follow-up',
    },
    {
        id: 'os_015', name: 'Alerta: OS sem assinatura do cliente',
        description: 'Alerta quando OS foi concluída mas a assinatura digital do cliente não foi coletada.',
        category: 'os', trigger_event: 'os.no_signature', action_type: 'create_alert',
        trigger_label: 'OS concluída sem assinatura', action_label: 'Criar alerta',
    },

    // =========================================================================
    // ORÇAMENTOS (10 templates)
    // =========================================================================
    {
        id: 'orc_001', name: 'Orçamento criado: aguardando aprovação interna',
        description: 'Notifica o admin quando um novo orçamento é criado e precisa de aprovação interna antes de ser enviado ao cliente.',
        category: 'orçamentos', trigger_event: 'quote.created', action_type: 'send_notification',
        trigger_label: 'Orçamento criado', action_label: 'Notificar admin para aprovação', recommended: true,
    },
    {
        id: 'orc_002', name: 'Alerta: orçamento vencendo em 7 dias',
        description: 'Avisa a equipe quando um orçamento enviado ao cliente está a 7 dias do vencimento sem resposta.',
        category: 'orçamentos', trigger_event: 'quote.expiring', action_type: 'send_notification',
        trigger_label: 'Orçamento vence em 7 dias', action_label: 'Alertar equipe',
    },
    {
        id: 'orc_003', name: 'Alerta urgente: orçamento vencendo em 3 dias',
        description: 'Alerta urgente quando orçamento está a apenas 3 dias do vencimento. Hora de ligar para o cliente!',
        category: 'orçamentos', trigger_event: 'quote.expiring', action_type: 'create_alert',
        trigger_label: 'Orçamento vence em 3 dias', action_label: 'Criar alerta urgente',
    },
    {
        id: 'orc_004', name: 'Vendedor: orçamento aprovado internamente',
        description: 'Notifica o vendedor quando o orçamento é aprovado internamente pelo admin e pode ser enviado ao cliente.',
        category: 'orçamentos', trigger_event: 'quote.internal_approved', action_type: 'send_notification',
        trigger_label: 'Orçamento aprovado internamente', action_label: 'Notificar vendedor',
    },
    {
        id: 'orc_005', name: 'Cliente aprovou orçamento!',
        description: 'Notifica admin e equipe quando o cliente aprovar um orçamento, para iniciar o atendimento.',
        category: 'orçamentos', trigger_event: 'quote.approved', action_type: 'send_notification',
        trigger_label: 'Cliente aprovou orçamento', action_label: 'Notificar equipe', recommended: true,
    },
    {
        id: 'orc_006', name: 'Lembrete ao cliente sobre orçamento pendente',
        description: 'Envia e-mail ao cliente lembrando sobre o orçamento enviado que ainda não teve resposta.',
        category: 'orçamentos', trigger_event: 'quote.pending', action_type: 'send_email',
        trigger_label: 'Orçamento pendente de resposta', action_label: 'Enviar lembrete ao cliente',
    },
    {
        id: 'orc_007', name: 'Orçamento rejeitado pelo cliente',
        description: 'Notifica gerente e vendedor quando o cliente rejeitar um orçamento para análise e possível renegociação.',
        category: 'orçamentos', trigger_event: 'quote.rejected', action_type: 'send_notification',
        trigger_label: 'Orçamento rejeitado', action_label: 'Notificar gerente e vendedor',
    },
    {
        id: 'orc_008', name: 'Desconto solicitado: aprovação necessária',
        description: 'Alerta o admin quando um desconto é solicitado no orçamento e precisa de aprovação.',
        category: 'orçamentos', trigger_event: 'quote.discount_requested', action_type: 'send_notification',
        trigger_label: 'Desconto solicitado', action_label: 'Notificar admin para aprovar',
    },
    {
        id: 'orc_009', name: 'Orçamento venceu sem resposta',
        description: 'Registra e notifica quando um orçamento vence sem que o cliente tenha respondido.',
        category: 'orçamentos', trigger_event: 'quote.expired', action_type: 'create_alert',
        trigger_label: 'Orçamento expirou', action_label: 'Criar alerta',
    },
    {
        id: 'orc_010', name: 'Criar chamado quando orçamento aprovado for agendado',
        description: 'Cria automaticamente um chamado técnico quando o orçamento for aprovado e o atendimento for agendado.',
        category: 'orçamentos', trigger_event: 'quote.approved', action_type: 'create_chamado',
        trigger_label: 'Orçamento aprovado e agendado', action_label: 'Criar chamado técnico',
    },

    // =========================================================================
    // CHAMADOS (8 templates)
    // =========================================================================
    {
        id: 'ch_001', name: 'Técnico: chamado atribuído a você',
        description: 'Notifica o técnico imediatamente quando um novo chamado é atribuído a ele.',
        category: 'chamados', trigger_event: 'chamado.assigned', action_type: 'send_notification',
        trigger_label: 'Chamado atribuído ao técnico', action_label: 'Notificar técnico',
    },
    {
        id: 'ch_002', name: 'Alerta: chamado sem atribuição há 2 horas',
        description: 'Alerta o admin quando um chamado está aberto há mais de 2 horas sem ter sido atribuído a nenhum técnico.',
        category: 'chamados', trigger_event: 'chamado.unassigned', action_type: 'create_alert',
        trigger_label: 'Chamado sem técnico há 2h', action_label: 'Criar alerta',
    },
    {
        id: 'ch_003', name: 'Informar cliente sobre mudança de status',
        description: 'Envia e-mail ao cliente sempre que o status do chamado for alterado (em andamento, resolvido, etc).',
        category: 'chamados', trigger_event: 'chamado.resolved', action_type: 'send_email',
        trigger_label: 'Status do chamado alterado', action_label: 'Enviar e-mail ao cliente',
    },
    {
        id: 'ch_004', name: 'Escalar chamado não atendido em 24h',
        description: 'Escalação automática: se chamado não for resolvido em 24h, notifica o gerente para intervenção.',
        category: 'chamados', trigger_event: 'chamado.stalled', action_type: 'send_notification',
        trigger_label: 'Chamado aberto há 24h', action_label: 'Escalar para gerente', recommended: true,
    },
    {
        id: 'ch_005', name: 'Confirmação de abertura ao cliente',
        description: 'Envia e-mail de confirmação ao cliente assim que o chamado é aberto no sistema.',
        category: 'chamados', trigger_event: 'chamado.created', action_type: 'send_email',
        trigger_label: 'Chamado aberto', action_label: 'Enviar confirmação ao cliente',
    },
    {
        id: 'ch_006', name: 'Alerta: chamado pendente há 48+ horas',
        description: 'Cria alerta quando um chamado está pendente/sem resolução há mais de 48 horas.',
        category: 'chamados', trigger_event: 'chamado.stalled', action_type: 'create_alert',
        trigger_label: 'Chamado pendente há 48h', action_label: 'Criar alerta',
    },
    {
        id: 'ch_007', name: 'Chamado reaberto: notificar equipe',
        description: 'Avisa a equipe quando um chamado que já foi resolvido for reaberto pelo cliente.',
        category: 'chamados', trigger_event: 'chamado.reopened', action_type: 'send_notification',
        trigger_label: 'Chamado reaberto', action_label: 'Notificar equipe',
    },
    {
        id: 'ch_008', name: 'Resumo diário de chamados em aberto',
        description: 'Envia todo dia pela manhã um resumo por e-mail com todos os chamados ainda em aberto.',
        category: 'chamados', trigger_event: 'chamado.daily_summary', action_type: 'send_email',
        trigger_label: 'Todo dia às 8h', action_label: 'Enviar resumo por e-mail',
    },

    // =========================================================================
    // FINANCEIRO (13 templates)
    // =========================================================================
    {
        id: 'fin_001', name: 'Lembrete de pagamento: 3 dias antes',
        description: 'Envia lembrete ao cliente 3 dias antes do vencimento da parcela/boleto.',
        category: 'financeiro', trigger_event: 'payment.due_soon', action_type: 'send_email',
        trigger_label: '3 dias antes do vencimento', action_label: 'Enviar lembrete ao cliente', recommended: true,
    },
    {
        id: 'fin_002', name: 'Lembrete de pagamento: dia do vencimento',
        description: 'Envia lembrete por WhatsApp ao cliente no dia do vencimento do pagamento.',
        category: 'financeiro', trigger_event: 'payment.due_today', action_type: 'send_whatsapp',
        trigger_label: 'No dia do vencimento', action_label: 'Enviar WhatsApp ao cliente',
    },
    {
        id: 'fin_003', name: 'Alerta: pagamento vencido há 1 dia',
        description: 'Cria alerta interno quando um pagamento vence e não é recebido no prazo.',
        category: 'financeiro', trigger_event: 'payment.overdue', action_type: 'create_alert',
        trigger_label: 'Pagamento venceu', action_label: 'Criar alerta de cobrança', recommended: true,
    },
    {
        id: 'fin_004', name: 'Inadimplência: 15+ dias de atraso',
        description: 'Alerta especial para clientes com pagamento atrasado há mais de 15 dias.',
        category: 'financeiro', trigger_event: 'payment.overdue_15', action_type: 'send_notification',
        trigger_label: 'Atraso superior a 15 dias', action_label: 'Notificar financeiro',
    },
    {
        id: 'fin_005', name: 'Inadimplência crítica: 30+ dias de atraso',
        description: 'Alerta crítico para inadimplência acima de 30 dias. Pode gerar bloqueio de novos serviços.',
        category: 'financeiro', trigger_event: 'payment.overdue_30', action_type: 'create_alert',
        trigger_label: 'Atraso superior a 30 dias', action_label: 'Criar alerta crítico',
    },
    {
        id: 'fin_006', name: 'Pagamento recebido: notificar financeiro',
        description: 'Avisa o setor financeiro assim que um pagamento for registrado no sistema.',
        category: 'financeiro', trigger_event: 'payment.received', action_type: 'send_notification',
        trigger_label: 'Pagamento recebido', action_label: 'Notificar financeiro',
    },
    {
        id: 'fin_007', name: 'Despesa precisa de aprovação',
        description: 'Notifica o admin quando um técnico ou motorista registra uma despesa que precisa de aprovação.',
        category: 'financeiro', trigger_event: 'expense.submitted', action_type: 'send_notification',
        trigger_label: 'Despesa registrada', action_label: 'Notificar admin para aprovação', recommended: true,
    },
    {
        id: 'fin_008', name: 'Comissões prontas para fechamento mensal',
        description: 'Alerta o financeiro quando chegar a data de fechamento mensal de comissões.',
        category: 'financeiro', trigger_event: 'commission.ready', action_type: 'send_notification',
        trigger_label: 'Fechamento mensal de comissões', action_label: 'Notificar financeiro',
    },
    {
        id: 'fin_009', name: 'Técnico: sua comissão foi liberada',
        description: 'Notifica o técnico quando a comissão do mês for aprovada e liberada para pagamento.',
        category: 'financeiro', trigger_event: 'commission.released', action_type: 'send_notification',
        trigger_label: 'Comissão aprovada', action_label: 'Notificar técnico',
    },
    {
        id: 'fin_010', name: 'Caixa do técnico: saldo baixo (R$ 100)',
        description: 'Alerta quando o saldo do caixa do técnico ficar abaixo de R$ 100, indicando necessidade de recarga.',
        category: 'financeiro', trigger_event: 'cash.low_balance', action_type: 'create_alert',
        trigger_label: 'Saldo do caixa abaixo de R$ 100', action_label: 'Criar alerta',
    },
    {
        id: 'fin_011', name: 'Nota fiscal emitida: avisar cliente',
        description: 'Envia e-mail ao cliente com informações da nota fiscal assim que ela for emitida.',
        category: 'financeiro', trigger_event: 'invoice.created', action_type: 'send_email',
        trigger_label: 'Nota fiscal emitida', action_label: 'Enviar e-mail ao cliente',
    },
    {
        id: 'fin_012', name: 'Conta a pagar vencendo em 3 dias',
        description: 'Alerta o financeiro sobre contas a pagar que vencem nos próximos 3 dias.',
        category: 'financeiro', trigger_event: 'payable.due_soon', action_type: 'send_notification',
        trigger_label: 'Conta a pagar vencendo em 3 dias', action_label: 'Notificar financeiro',
    },
    {
        id: 'fin_013', name: 'Alerta: despesa do técnico acima de R$ 500',
        description: 'Alerta especial quando técnico registrar uma despesa individual acima de R$ 500.',
        category: 'financeiro', trigger_event: 'expense.high_value', action_type: 'send_notification',
        trigger_label: 'Despesa acima de R$ 500', action_label: 'Notificar admin',
    },

    // =========================================================================
    // EQUIPAMENTOS E CALIBRAÇÃO (10 templates)
    // =========================================================================
    {
        id: 'eq_001', name: 'Calibração vencendo em 30 dias',
        description: 'Alerta quando o certificado de calibração de um equipamento do cliente vai vencer em 30 dias.',
        category: 'equipamentos', trigger_event: 'equipment.calibration_due', action_type: 'send_notification',
        trigger_label: 'Calibração vence em 30 dias', action_label: 'Alertar equipe', recommended: true,
    },
    {
        id: 'eq_002', name: 'Calibração vencendo em 15 dias: urgente',
        description: 'Alerta urgente quando calibração vai vencer em 15 dias. Hora de agendar a recalibração!',
        category: 'equipamentos', trigger_event: 'equipment.calibration_15d', action_type: 'create_alert',
        trigger_label: 'Calibração vence em 15 dias', action_label: 'Criar alerta urgente',
    },
    {
        id: 'eq_003', name: 'Oferta de recalibração ao cliente',
        description: 'Envia e-mail ao cliente oferecendo serviço de recalibração quando o certificado estiver próximo do vencimento.',
        category: 'equipamentos', trigger_event: 'equipment.calibration_due', action_type: 'send_email',
        trigger_label: 'Calibração próxima do vencimento', action_label: 'Enviar oferta ao cliente', recommended: true,
    },
    {
        id: 'eq_004', name: 'Certificado de peso padrão vencendo',
        description: 'Alerta quando o certificado de um peso padrão (massa de referência) está próximo do vencimento.',
        category: 'equipamentos', trigger_event: 'weight.certificate_expiring', action_type: 'create_alert',
        trigger_label: 'Certificado de peso vencendo', action_label: 'Criar alerta', recommended: true,
    },
    {
        id: 'eq_005', name: 'Novo equipamento cadastrado para cliente',
        description: 'Notifica a equipe quando um novo equipamento é cadastrado vinculado a um cliente.',
        category: 'equipamentos', trigger_event: 'equipment.created', action_type: 'send_notification',
        trigger_label: 'Equipamento cadastrado', action_label: 'Notificar equipe',
    },
    {
        id: 'eq_006', name: 'Calibração atrasada: equipamento vencido',
        description: 'Alerta quando um equipamento já passou da data de calibração e está com certificado vencido.',
        category: 'equipamentos', trigger_event: 'equipment.calibration_overdue', action_type: 'create_alert',
        trigger_label: 'Calibração vencida', action_label: 'Criar alerta crítico',
    },
    {
        id: 'eq_007', name: 'Enviar certificado de calibração ao cliente',
        description: 'Envia por e-mail o certificado de calibração ao cliente assim que o documento for gerado.',
        category: 'equipamentos', trigger_event: 'equipment.certificate_ready', action_type: 'send_email',
        trigger_label: 'Certificado gerado', action_label: 'Enviar ao cliente por e-mail',
    },
    {
        id: 'eq_008', name: 'Alerta: OS concluída sem certificado gerado',
        description: 'Avisa quando uma OS de calibração foi concluída mas o certificado ainda não foi emitido.',
        category: 'equipamentos', trigger_event: 'equipment.no_certificate', action_type: 'create_alert',
        trigger_label: 'OS sem certificado', action_label: 'Criar alerta',
    },
    {
        id: 'eq_009', name: 'Equipamento sem serviço há 1 ano',
        description: 'Identifica equipamentos do cliente que não recebem serviço há mais de 1 ano para oferta proativa.',
        category: 'equipamentos', trigger_event: 'equipment.no_service', action_type: 'send_notification',
        trigger_label: 'Sem serviço há 12 meses', action_label: 'Notificar vendedor',
    },
    {
        id: 'eq_010', name: 'Criar chamado: calibração programada se aproximando',
        description: 'Cria automaticamente um chamado técnico quando a data de calibração programada está próxima.',
        category: 'equipamentos', trigger_event: 'equipment.service_scheduled', action_type: 'create_chamado',
        trigger_label: 'Calibração programada se aproximando', action_label: 'Criar chamado técnico',
    },

    // =========================================================================
    // TÉCNICOS E CAMPO (10 templates)
    // =========================================================================
    {
        id: 'tec_001', name: 'Despesa do técnico acima do limite',
        description: 'Alerta o admin quando um técnico registrar uma despesa individual acima do valor configurado.',
        category: 'técnicos', trigger_event: 'expense.high_value', action_type: 'send_notification',
        trigger_label: 'Despesa acima do limite', action_label: 'Notificar admin',
    },
    {
        id: 'tec_002', name: 'Técnico sem apontamento de horas há 2 dias',
        description: 'Alerta quando um técnico não registra apontamento de horas há mais de 2 dias úteis.',
        category: 'técnicos', trigger_event: 'technician.no_timesheet', action_type: 'create_alert',
        trigger_label: 'Sem apontamento há 2 dias', action_label: 'Criar alerta',
    },
    {
        id: 'tec_003', name: 'OS concluída fora do horário comercial',
        description: 'Notifica o admin quando um técnico conclui OS fora do horário comercial (antes das 7h ou após 18h).',
        category: 'técnicos', trigger_event: 'os.after_hours', action_type: 'send_notification',
        trigger_label: 'OS concluída fora do horário', action_label: 'Notificar admin',
    },
    {
        id: 'tec_004', name: 'Técnico sem OS para o dia',
        description: 'Alerta quando um técnico não tem nenhuma OS atribuída para o dia seguinte.',
        category: 'técnicos', trigger_event: 'technician.idle', action_type: 'send_notification',
        trigger_label: 'Técnico sem agenda para amanhã', action_label: 'Notificar gerente',
    },
    {
        id: 'tec_005', name: 'Resumo diário de OS para o técnico',
        description: 'Envia todo dia cedo um resumo com as OS do dia para cada técnico.',
        category: 'técnicos', trigger_event: 'technician.daily_schedule', action_type: 'send_notification',
        trigger_label: 'Todo dia às 7h', action_label: 'Enviar resumo ao técnico',
    },
    {
        id: 'tec_006', name: 'Km rodado acima do esperado',
        description: 'Alerta quando o km registrado pelo técnico numa viagem está acima da distância esperada pela rota.',
        category: 'técnicos', trigger_event: 'technician.high_km', action_type: 'create_alert',
        trigger_label: 'Km acima do esperado', action_label: 'Criar alerta',
    },
    {
        id: 'tec_007', name: 'Despesas pendentes de prestação de contas',
        description: 'Alerta quando há despesas do técnico pendentes de conferência/aprovação há mais de 3 dias.',
        category: 'técnicos', trigger_event: 'technician.expenses_pending', action_type: 'send_notification',
        trigger_label: 'Despesas pendentes há 3+ dias', action_label: 'Notificar admin',
    },
    {
        id: 'tec_008', name: 'Checklist preenchido em campo',
        description: 'Notifica o escritório quando um técnico conclui o preenchimento do checklist de calibração em campo.',
        category: 'técnicos', trigger_event: 'technician.checklist_done', action_type: 'send_notification',
        trigger_label: 'Checklist preenchido', action_label: 'Notificar escritório',
    },
    {
        id: 'tec_009', name: 'Assinatura do cliente não coletada',
        description: 'Alerta quando a OS é concluída mas a assinatura digital do cliente não foi registrada.',
        category: 'técnicos', trigger_event: 'technician.no_signature', action_type: 'create_alert',
        trigger_label: 'Sem assinatura do cliente', action_label: 'Criar alerta',
    },
    {
        id: 'tec_010', name: 'Fotos pendentes de sincronização',
        description: 'Alerta quando há fotos de OS que ainda não foram sincronizadas com o servidor.',
        category: 'técnicos', trigger_event: 'technician.photos_pending', action_type: 'create_alert',
        trigger_label: 'Fotos aguardando sync', action_label: 'Criar alerta',
    },

    // =========================================================================
    // ESTOQUE (8 templates)
    // =========================================================================
    {
        id: 'est_001', name: 'Estoque mínimo atingido',
        description: 'Alerta quando um produto atinge a quantidade mínima de estoque configurada.',
        category: 'estoque', trigger_event: 'stock.low', action_type: 'create_alert',
        trigger_label: 'Estoque no nível mínimo', action_label: 'Criar alerta', recommended: true,
    },
    {
        id: 'est_002', name: 'Produto sem estoque!',
        description: 'Alerta urgente quando um produto zera o estoque. Atenção para não faltar em campo.',
        category: 'estoque', trigger_event: 'stock.out', action_type: 'create_alert',
        trigger_label: 'Estoque zerado', action_label: 'Criar alerta urgente',
    },
    {
        id: 'est_003', name: 'Ponto de reposição: solicitar compra',
        description: 'Notifica o setor de compras quando um produto atinge o ponto de reposição para novo pedido.',
        category: 'estoque', trigger_event: 'stock.reorder', action_type: 'send_notification',
        trigger_label: 'Ponto de reposição atingido', action_label: 'Notificar compras',
    },
    {
        id: 'est_004', name: 'Produto sem movimentação há 90 dias',
        description: 'Identifica produtos parados no estoque há mais de 90 dias para avaliação de descarte ou promoção.',
        category: 'estoque', trigger_event: 'stock.no_movement', action_type: 'send_notification',
        trigger_label: 'Sem movimentação há 90 dias', action_label: 'Notificar responsável',
    },
    {
        id: 'est_005', name: 'Transferência de almoxarifado solicitada',
        description: 'Notifica o responsável quando uma transferência de produtos entre almoxarifados é solicitada.',
        category: 'estoque', trigger_event: 'stock.transfer_requested', action_type: 'send_notification',
        trigger_label: 'Transferência solicitada', action_label: 'Notificar responsável',
    },
    {
        id: 'est_006', name: 'Item consumido na OS sem estoque',
        description: 'Alerta quando um item é registrado como consumido numa OS mas não havia estoque disponível.',
        category: 'estoque', trigger_event: 'stock.consumed_no_stock', action_type: 'create_alert',
        trigger_label: 'Consumo sem estoque', action_label: 'Criar alerta',
    },
    {
        id: 'est_007', name: 'Relatório semanal de posição de estoque',
        description: 'Envia automaticamente toda segunda-feira um relatório com a posição atual do estoque.',
        category: 'estoque', trigger_event: 'stock.weekly_report', action_type: 'send_email',
        trigger_label: 'Toda segunda-feira', action_label: 'Enviar relatório por e-mail',
    },
    {
        id: 'est_008', name: 'Lote próximo do vencimento',
        description: 'Alerta quando um lote de produto está próximo da data de vencimento.',
        category: 'estoque', trigger_event: 'stock.lot_expiring', action_type: 'create_alert',
        trigger_label: 'Lote vencendo', action_label: 'Criar alerta',
    },

    // =========================================================================
    // CLIENTES / CRM (10 templates)
    // =========================================================================
    {
        id: 'cli_001', name: 'Boas-vindas ao novo cliente',
        description: 'Envia e-mail de boas-vindas automaticamente quando um novo cliente é cadastrado no sistema.',
        category: 'clientes', trigger_event: 'customer.created', action_type: 'send_email',
        trigger_label: 'Cliente cadastrado', action_label: 'Enviar e-mail de boas-vindas',
    },
    {
        id: 'cli_002', name: 'Lembrete: próximo contato com lead',
        description: 'Notifica o vendedor quando chega a data agendada para próximo contato com um lead.',
        category: 'clientes', trigger_event: 'customer.contact_due', action_type: 'send_notification',
        trigger_label: 'Data de contato chegou', action_label: 'Notificar vendedor', recommended: true,
    },
    {
        id: 'cli_003', name: 'Lead esquecido: sem contato há 15+ dias',
        description: 'Alerta quando um lead não é contatado há mais de 15 dias para evitar perda de oportunidade.',
        category: 'clientes', trigger_event: 'customer.no_contact', action_type: 'create_alert',
        trigger_label: 'Lead sem contato há 15 dias', action_label: 'Criar alerta',
    },
    {
        id: 'cli_004', name: 'Aniversário de parceria: 1 ano de cliente',
        description: 'Notifica a equipe para enviar uma mensagem especial ao cliente no aniversário de 1 ano de parceria.',
        category: 'clientes', trigger_event: 'customer.anniversary', action_type: 'send_notification',
        trigger_label: '1 ano de parceria', action_label: 'Notificar equipe',
    },
    {
        id: 'cli_005', name: 'Cliente inativo há 6+ meses',
        description: 'Alerta sobre clientes que não solicitam serviços há mais de 6 meses para reativação.',
        category: 'clientes', trigger_event: 'customer.inactive', action_type: 'send_notification',
        trigger_label: 'Cliente inativo há 6 meses', action_label: 'Notificar vendedor',
    },
    {
        id: 'cli_006', name: 'Follow-up após primeira OS do cliente',
        description: 'Cria tarefa de acompanhamento após a conclusão da primeira OS de um cliente novo.',
        category: 'clientes', trigger_event: 'customer.first_os', action_type: 'create_task',
        trigger_label: 'Primeira OS concluída', action_label: 'Criar tarefa de follow-up',
    },
    {
        id: 'cli_007', name: 'Alerta: reclamações recorrentes do cliente',
        description: 'Alerta quando um cliente registra múltiplas reclamações, indicando possível insatisfação.',
        category: 'clientes', trigger_event: 'customer.complaints', action_type: 'create_alert',
        trigger_label: 'Reclamações recorrentes', action_label: 'Criar alerta',
    },
    {
        id: 'cli_008', name: 'Oportunidade avançou no pipeline',
        description: 'Notifica o vendedor quando uma oportunidade muda de etapa no pipeline de vendas.',
        category: 'clientes', trigger_event: 'customer.pipeline_advanced', action_type: 'send_notification',
        trigger_label: 'Oportunidade avançou', action_label: 'Notificar vendedor',
    },
    {
        id: 'cli_009', name: 'Lead parado no pipeline há 30+ dias',
        description: 'Alerta sobre leads que estão estagnados na mesma etapa do pipeline há mais de 30 dias.',
        category: 'clientes', trigger_event: 'customer.pipeline_stalled', action_type: 'create_alert',
        trigger_label: 'Lead parado há 30 dias', action_label: 'Criar alerta',
    },
    {
        id: 'cli_010', name: 'Comunicar novos serviços para clientes ativos',
        description: 'Envia e-mail de divulgação sobre novos serviços disponíveis para todos os clientes ativos.',
        category: 'clientes', trigger_event: 'customer.new_services', action_type: 'send_email',
        trigger_label: 'Novos serviços cadastrados', action_label: 'Enviar e-mail de divulgação',
    },

    // =========================================================================
    // CONTRATOS RECORRENTES (6 templates)
    // =========================================================================
    {
        id: 'ct_001', name: 'Serviço programado: 1 semana antes',
        description: 'Alerta a equipe 1 semana antes da data programada de um serviço de contrato recorrente.',
        category: 'contratos', trigger_event: 'contract.service_due', action_type: 'send_notification',
        trigger_label: '1 semana antes do serviço', action_label: 'Notificar equipe', recommended: true,
    },
    {
        id: 'ct_002', name: 'Contrato vencendo em 1 mês',
        description: 'Alerta sobre contratos que vencem no próximo mês para iniciar negociação de renovação.',
        category: 'contratos', trigger_event: 'contract.expiring', action_type: 'send_notification',
        trigger_label: 'Contrato vence em 30 dias', action_label: 'Notificar comercial',
    },
    {
        id: 'ct_003', name: 'Criar chamado na data programada do contrato',
        description: 'Cria automaticamente um chamado técnico quando chega a data programada de serviço do contrato.',
        category: 'contratos', trigger_event: 'contract.service_due', action_type: 'create_chamado',
        trigger_label: 'Data programada chegou', action_label: 'Criar chamado técnico',
    },
    {
        id: 'ct_004', name: 'Notificar cliente sobre próxima visita',
        description: 'Envia WhatsApp ao cliente avisando sobre a visita técnica programada.',
        category: 'contratos', trigger_event: 'contract.visit_scheduled', action_type: 'send_whatsapp',
        trigger_label: 'Visita programada se aproximando', action_label: 'Enviar WhatsApp ao cliente',
    },
    {
        id: 'ct_005', name: 'Contrato expirado sem renovação',
        description: 'Alerta sobre contratos que já expiraram e não foram renovados para ação comercial.',
        category: 'contratos', trigger_event: 'contract.expired', action_type: 'create_alert',
        trigger_label: 'Contrato expirou', action_label: 'Criar alerta',
    },
    {
        id: 'ct_006', name: 'Proposta de renovação: 60 dias antes',
        description: 'Envia e-mail com proposta de renovação de contrato 60 dias antes do vencimento.',
        category: 'contratos', trigger_event: 'contract.renewal_due', action_type: 'send_email',
        trigger_label: '60 dias antes do vencimento', action_label: 'Enviar proposta de renovação',
    },

    // =========================================================================
    // RH / PONTO (5 templates)
    // =========================================================================
    {
        id: 'rh_001', name: 'Colaborador sem registro de ponto',
        description: 'Alerta quando um colaborador não registra ponto no dia, indicando possível falta ou esquecimento.',
        category: 'rh', trigger_event: 'hr.no_clock', action_type: 'create_alert',
        trigger_label: 'Sem registro de ponto no dia', action_label: 'Criar alerta',
    },
    {
        id: 'rh_002', name: 'Ajuste de ponto solicitado',
        description: 'Notifica o gestor quando um colaborador solicita ajuste no registro de ponto.',
        category: 'rh', trigger_event: 'hr.clock_adjustment', action_type: 'send_notification',
        trigger_label: 'Ajuste de ponto solicitado', action_label: 'Notificar gestor',
    },
    {
        id: 'rh_003', name: 'Banco de horas acima do limite',
        description: 'Alerta quando o banco de horas de um colaborador ultrapassa o limite configurado.',
        category: 'rh', trigger_event: 'hr.overtime', action_type: 'create_alert',
        trigger_label: 'Banco de horas excedido', action_label: 'Criar alerta',
    },
    {
        id: 'rh_004', name: 'Documento de colaborador vencendo',
        description: 'Alerta quando documentos obrigatórios de um colaborador estão próximos do vencimento (CNH, ASO, etc).',
        category: 'rh', trigger_event: 'hr.document_expiring', action_type: 'send_notification',
        trigger_label: 'Documento vencendo', action_label: 'Notificar RH',
    },
    {
        id: 'rh_005', name: 'Férias programadas na próxima semana',
        description: 'Notifica a equipe sobre colaboradores que entram de férias na semana seguinte.',
        category: 'rh', trigger_event: 'hr.vacation_upcoming', action_type: 'send_notification',
        trigger_label: 'Férias na próxima semana', action_label: 'Notificar equipe',
    },

    // =========================================================================
    // FROTA (5 templates)
    // =========================================================================
    {
        id: 'fr_001', name: 'Revisão do veículo programada',
        description: 'Alerta quando um veículo da frota está com revisão/manutenção programada se aproximando.',
        category: 'frota', trigger_event: 'fleet.maintenance_due', action_type: 'create_alert',
        trigger_label: 'Revisão programada', action_label: 'Criar alerta',
    },
    {
        id: 'fr_002', name: 'IPVA / Licenciamento vencendo',
        description: 'Alerta sobre vencimento de IPVA ou licenciamento de veículos da frota.',
        category: 'frota', trigger_event: 'fleet.license_expiring', action_type: 'create_alert',
        trigger_label: 'IPVA/Licenciamento vencendo', action_label: 'Criar alerta',
    },
    {
        id: 'fr_003', name: 'Consumo de combustível acima da média',
        description: 'Alerta quando o consumo de combustível de um veículo está acima da média histórica.',
        category: 'frota', trigger_event: 'fleet.high_consumption', action_type: 'create_alert',
        trigger_label: 'Consumo acima da média', action_label: 'Criar alerta',
    },
    {
        id: 'fr_004', name: 'Multa recebida em veículo da frota',
        description: 'Notifica o admin quando uma multa de trânsito é registrada para um veículo da empresa.',
        category: 'frota', trigger_event: 'fleet.fine_received', action_type: 'send_notification',
        trigger_label: 'Multa registrada', action_label: 'Notificar admin',
    },
    {
        id: 'fr_005', name: 'Seguro do veículo vencendo em 30 dias',
        description: 'Alerta sobre apólices de seguro de veículos que vencem nos próximos 30 dias.',
        category: 'frota', trigger_event: 'fleet.insurance_expiring', action_type: 'create_alert',
        trigger_label: 'Seguro vencendo em 30 dias', action_label: 'Criar alerta',
    },
]
