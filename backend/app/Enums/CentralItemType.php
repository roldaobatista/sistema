<?php

namespace App\Enums;

enum CentralItemType: string
{
    case CHAMADO = 'CHAMADO';
    case OS = 'OS';
    case FINANCEIRO = 'FINANCEIRO';
    case ORCAMENTO = 'ORCAMENTO';
    case TAREFA = 'TAREFA';
    case LEMBRETE = 'LEMBRETE';
    case CALIBRACAO = 'CALIBRACAO';
    case CONTRATO = 'CONTRATO';
    case OUTRO = 'OUTRO';

    public function label(): string
    {
        return match($this) {
            self::CHAMADO => 'Chamado Técnico',
            self::OS => 'Ordem de Serviço',
            self::FINANCEIRO => 'Financeiro',
            self::ORCAMENTO => 'Orçamento',
            self::TAREFA => 'Tarefa',
            self::LEMBRETE => 'Lembrete',
            self::CALIBRACAO => 'Calibração',
            self::CONTRATO => 'Contrato',
            self::OUTRO => 'Outro',
        };
    }
}
