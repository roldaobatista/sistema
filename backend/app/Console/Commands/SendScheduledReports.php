<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\PdfController;
use App\Models\ScheduledReport;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendScheduledReports extends Command
{
    protected $signature = 'reports:send-scheduled';
    protected $description = 'Gera e envia relatórios agendados cujo next_send_at já passou';

    public function handle(): int
    {
        $reports = ScheduledReport::where('is_active', true)
            ->where('next_send_at', '<=', now())
            ->get();

        if ($reports->isEmpty()) {
            $this->info('Nenhum relatório agendado para enviar.');
            return self::SUCCESS;
        }

        $sent = 0;
        $failed = 0;

        foreach ($reports as $report) {
            try {
                $csvContent = $this->generateCsv($report);

                if (!$csvContent) {
                    Log::warning('SendScheduledReports: relatório sem dados', ['id' => $report->id, 'type' => $report->report_type]);
                    $this->advanceSchedule($report);
                    continue;
                }

                $this->sendEmail($report, $csvContent);
                $report->update([
                    'last_sent_at' => now(),
                    'next_send_at' => $this->nextSendDate($report->frequency),
                ]);

                $sent++;
                $this->line("Enviado: {$report->report_type} (ID {$report->id})");
            } catch (\Throwable $e) {
                $failed++;
                Log::error('SendScheduledReports failed', [
                    'id' => $report->id,
                    'type' => $report->report_type,
                    'error' => $e->getMessage(),
                ]);
                $this->error("Falha: {$report->report_type} (ID {$report->id}) - {$e->getMessage()}");
                $this->advanceSchedule($report);
            }
        }

        $this->info("Concluído: {$sent} enviados, {$failed} com falha.");
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    private function generateCsv(ScheduledReport $report): ?string
    {
        $reportController = app(ReportController::class);
        $pdfController = app(PdfController::class);

        $methodMap = [
            'work-orders' => 'workOrders',
            'productivity' => 'productivity',
            'financial' => 'financial',
            'commissions' => 'commissions',
            'profitability' => 'profitability',
            'quotes' => 'quotes',
            'service-calls' => 'serviceCalls',
            'technician-cash' => 'technicianCash',
            'crm' => 'crm',
            'equipments' => 'equipments',
            'suppliers' => 'suppliers',
            'stock' => 'stock',
            'customers' => 'customers',
        ];

        $method = $methodMap[$report->report_type] ?? null;
        if (!$method) {
            return null;
        }

        $filters = $report->filters ?? [];
        $from = $filters['from'] ?? now()->startOfMonth()->toDateString();
        $to = $filters['to'] ?? now()->toDateString();

        $creator = $report->creator;
        if (!$creator) {
            return null;
        }

        $request = Request::create('/api/v1/reports/' . $report->report_type, 'GET', [
            'from' => $from,
            'to' => $to,
        ]);
        $request->setUserResolver(fn () => $creator);

        $response = $reportController->$method($request);
        $data = $response->getData(true);

        $exportResponse = $pdfController->reportExport($request, $report->report_type);
        return $exportResponse->getContent();
    }

    private function sendEmail(ScheduledReport $report, string $csvContent): void
    {
        $recipients = $report->recipients ?? [];
        if (empty($recipients)) {
            return;
        }

        $typeLabel = ucfirst(str_replace('-', ' ', $report->report_type));
        $date = now()->format('d/m/Y');
        $filename = "relatorio-{$report->report_type}-{$date}.csv";

        Mail::raw(
            "Segue em anexo o relatório agendado: {$typeLabel}\nGerado em: {$date}",
            function ($message) use ($recipients, $typeLabel, $date, $csvContent, $filename) {
                $message->to($recipients)
                    ->subject("Relatório Agendado: {$typeLabel} - {$date}")
                    ->attachData($csvContent, $filename, ['mime' => 'text/csv']);
            }
        );
    }

    private function nextSendDate(string $frequency): \Carbon\Carbon
    {
        return match ($frequency) {
            'daily' => now()->addDay()->startOfDay()->addHours(7),
            'weekly' => now()->addWeek()->startOfDay()->addHours(7),
            'monthly' => now()->addMonth()->startOfDay()->addHours(7),
            default => now()->addDay()->startOfDay()->addHours(7),
        };
    }

    private function advanceSchedule(ScheduledReport $report): void
    {
        $report->update([
            'next_send_at' => $this->nextSendDate($report->frequency),
        ]);
    }
}
