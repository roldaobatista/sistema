<?php

namespace App\Services\Email;

use App\Models\Email;
use Illuminate\Support\Facades\Log;
use OpenAI\Laravel\Facades\OpenAI;

class EmailClassifierService
{
    private const SYSTEM_PROMPT = <<<'PROMPT'
Você é um assistente de classificação de emails para uma empresa de calibração de balanças e instrumentos de medição (ISO 17025).
A empresa trabalha com calibração, manutenção, certificação de equipamentos, e atende clientes B2B.

Analise o email a seguir e retorne APENAS um JSON válido com os seguintes campos:
{
  "category": "orcamento|suporte|cobranca|agendamento|comercial|interno|spam|outro",
  "summary": "resumo em 1 linha do email",
  "sentiment": "positivo|neutro|negativo",
  "priority": "alta|media|baixa",
  "suggested_action": "responder|criar_os|agendar_chamado|vincular_orcamento|encaminhar|ignorar",
  "confidence": 0.0-1.0
}

Definições das categorias:
- orcamento: pedido de preço, proposta, cotação de serviço
- suporte: dúvida técnica, reclamação, problema com equipamento/certificado
- cobranca: assunto financeiro, boleto, pagamento, nota fiscal
- agendamento: marcar visita, calibração, data de atendimento
- comercial: prospecção, parcerias, propostas de fornecedores
- interno: comunicação entre colaboradores da empresa
- spam: propaganda, email irrelevante, newsletters não solicitadas
- outro: não se enquadra em nenhuma categoria

Definições das ações sugeridas:
- responder: requer uma resposta direta
- criar_os: deve gerar uma ordem de serviço
- agendar_chamado: deve agendar um chamado/visita
- vincular_orcamento: relacionado a um orçamento existente
- encaminhar: encaminhar para outro setor/pessoa
- ignorar: não requer ação

Retorne SOMENTE o JSON, sem explicações adicionais.
PROMPT;

    public function classify(Email $email): Email
    {
        try {
            $emailContent = $this->buildEmailContent($email);

            $response = OpenAI::chat()->create([
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => self::SYSTEM_PROMPT],
                    ['role' => 'user', 'content' => $emailContent],
                ],
                'temperature' => 0.1,
                'max_tokens' => 300,
                'response_format' => ['type' => 'json_object'],
            ]);

            $content = $response->choices[0]->message->content ?? '';
            $result = json_decode($content, true);

            if (!$result || !isset($result['category'])) {
                throw new \RuntimeException('Invalid AI response format');
            }

            $email->update([
                'ai_category' => $result['category'],
                'ai_summary' => $result['summary'] ?? null,
                'ai_sentiment' => $result['sentiment'] ?? null,
                'ai_priority' => $result['priority'] ?? null,
                'ai_suggested_action' => $result['suggested_action'] ?? null,
                'ai_confidence' => min(1.0, max(0.0, (float) ($result['confidence'] ?? 0.5))),
                'ai_classified_at' => now(),
            ]);

            Log::info('Email classified', [
                'email_id' => $email->id,
                'category' => $result['category'],
                'confidence' => $result['confidence'] ?? 'unknown',
            ]);
        } catch (\Exception $e) {
            Log::error('Email classification failed', [
                'email_id' => $email->id,
                'error' => $e->getMessage(),
            ]);

            // Fallback: basic keyword classification
            $this->fallbackClassify($email);
        }

        return $email->refresh();
    }

    private function buildEmailContent(Email $email): string
    {
        $parts = [
            "De: {$email->from_name} <{$email->from_address}>",
            "Assunto: {$email->subject}",
            "Data: {$email->date->format('d/m/Y H:i')}",
        ];

        if ($email->customer) {
            $parts[] = "Cliente cadastrado: {$email->customer->name} (CNPJ: {$email->customer->cnpj})";
        }

        $body = $email->body_text ?: strip_tags($email->body_html ?? '');
        $body = mb_substr($body, 0, 2000); // Limit tokens

        $parts[] = "\nCorpo do email:\n{$body}";

        return implode("\n", $parts);
    }

    private function fallbackClassify(Email $email): void
    {
        $subject = strtolower($email->subject ?? '');
        $body = strtolower($email->body_text ?? '');
        $text = $subject . ' ' . $body;

        $category = 'outro';
        $priority = 'media';
        $action = 'responder';

        if (preg_match('/or[cç]amento|cota[cç][aã]o|pre[cç]o|proposta/u', $text)) {
            $category = 'orcamento';
            $priority = 'alta';
        } elseif (preg_match('/boleto|pagamento|nota fiscal|cobran[cç]a|fatura/u', $text)) {
            $category = 'cobranca';
            $priority = 'alta';
            $action = 'encaminhar';
        } elseif (preg_match('/calibra[cç][aã]o|agendar|visita|data.*atendimento/u', $text)) {
            $category = 'agendamento';
            $action = 'agendar_chamado';
        } elseif (preg_match('/problema|erro|defeito|reclama[cç]/u', $text)) {
            $category = 'suporte';
            $priority = 'alta';
            $action = 'criar_os';
        } elseif (preg_match('/unsubscribe|newsletter|promo[cç][aã]o|desconto.*especial/u', $text)) {
            $category = 'spam';
            $priority = 'baixa';
            $action = 'ignorar';
        }

        $email->update([
            'ai_category' => $category,
            'ai_summary' => 'Classificado por keywords (fallback)',
            'ai_sentiment' => 'neutro',
            'ai_priority' => $priority,
            'ai_suggested_action' => $action,
            'ai_confidence' => 0.40,
            'ai_classified_at' => now(),
        ]);
    }
}
