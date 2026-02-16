<?php

namespace App\Jobs;

use App\Models\CrmSequenceEnrollment;
use App\Models\CrmSequenceStep;
use App\Models\CrmActivity;
use App\Models\CrmMessage;
use App\Services\MessagingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessCrmSequences implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $enrollments = CrmSequenceEnrollment::where('status', 'active')
            ->where('next_action_at', '<=', now())
            ->with(['sequence.steps', 'customer', 'deal'])
            ->limit(100)
            ->get();

        foreach ($enrollments as $enrollment) {
            try {
                $this->processEnrollment($enrollment);
            } catch (\Throwable $e) {
                Log::error('CRM Sequence processing failed', [
                    'enrollment_id' => $enrollment->id,
                    'error' => $e->getMessage(),
                ]);
                $enrollment->update(['status' => 'failed']);
            }
        }
    }

    private function processEnrollment(CrmSequenceEnrollment $enrollment): void
    {
        $sequence = $enrollment->sequence;
        if (!$sequence || $sequence->status !== 'active') {
            $enrollment->update(['status' => 'cancelled']);
            return;
        }

        $currentStepIndex = $enrollment->current_step;
        $steps = $sequence->steps->sortBy('step_order')->values();
        $step = $steps->get($currentStepIndex);

        if (!$step) {
            $enrollment->update(['status' => 'completed', 'completed_at' => now()]);
            return;
        }

        $this->executeStep($step, $enrollment);

        $nextStepIndex = $currentStepIndex + 1;
        $nextStep = $steps->get($nextStepIndex);

        if ($nextStep) {
            $enrollment->update([
                'current_step' => $nextStepIndex,
                'next_action_at' => now()->addDays($nextStep->delay_days),
            ]);
        } else {
            $enrollment->update([
                'current_step' => $nextStepIndex,
                'status' => 'completed',
                'completed_at' => now(),
            ]);
        }
    }

    private function executeStep(CrmSequenceStep $step, CrmSequenceEnrollment $enrollment): void
    {
        $customer = $enrollment->customer;
        if (!$customer) return;

        match ($step->action_type) {
            'send_message' => $this->sendMessage($step, $enrollment),
            'create_activity' => $this->createActivity($step, $enrollment),
            'create_task' => $this->createTask($step, $enrollment),
            default => null,
        };
    }

    private function sendMessage(CrmSequenceStep $step, CrmSequenceEnrollment $enrollment): void
    {
        $customer = $enrollment->customer;
        $channel = $step->channel ?? 'email';
        $body = $step->body ?? '';
        $subject = $step->subject ?? '';

        // Replace variables
        $body = str_replace(
            ['{{nome}}', '{{empresa}}', '{{email}}'],
            [$customer->name ?? '', $customer->company_name ?? '', $customer->email ?? ''],
            $body
        );

        CrmMessage::create([
            'tenant_id' => $enrollment->tenant_id,
            'customer_id' => $customer->id,
            'deal_id' => $enrollment->deal_id,
            'channel' => $channel,
            'direction' => 'outbound',
            'status' => 'pending',
            'subject' => $subject,
            'body' => $body,
            'metadata' => [
                'source' => 'sequence',
                'sequence_id' => $enrollment->sequence_id,
                'step_order' => $step->step_order,
            ],
        ]);
    }

    private function createActivity(CrmSequenceStep $step, CrmSequenceEnrollment $enrollment): void
    {
        CrmActivity::create([
            'tenant_id' => $enrollment->tenant_id,
            'customer_id' => $enrollment->customer_id,
            'deal_id' => $enrollment->deal_id,
            'type' => $step->channel ?? 'tarefa',
            'title' => $step->subject ?? 'Atividade automática da cadência',
            'description' => $step->body,
            'scheduled_at' => now(),
            'is_automated' => true,
            'metadata' => [
                'source' => 'sequence',
                'sequence_id' => $enrollment->sequence_id,
            ],
        ]);
    }

    private function createTask(CrmSequenceStep $step, CrmSequenceEnrollment $enrollment): void
    {
        CrmActivity::create([
            'tenant_id' => $enrollment->tenant_id,
            'customer_id' => $enrollment->customer_id,
            'deal_id' => $enrollment->deal_id,
            'type' => 'tarefa',
            'title' => $step->subject ?? 'Tarefa da cadência',
            'description' => $step->body,
            'scheduled_at' => now(),
            'user_id' => $enrollment->enrolled_by,
            'is_automated' => true,
            'metadata' => [
                'source' => 'sequence',
                'sequence_id' => $enrollment->sequence_id,
            ],
        ]);
    }
}
