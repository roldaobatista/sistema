<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── CRM Automations (diário às 7h) ────────
Schedule::command('crm:process-automations')
    ->dailyAt('07:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/crm-automations.log'));

// ─── Calibration Alerts (diário às 7:30h) ───
Schedule::command('calibration:alerts')
    ->dailyAt('07:30')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/calibration-alerts.log'));

// ─── Mark Overdue Receivables (diário às 6:00h) ───
Schedule::command('app:mark-overdue-receivables')
    ->dailyAt('06:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/overdue-receivables.log'));

// ─── Mark Overdue Payables (diário às 6:05h) ───
Schedule::command('app:mark-overdue-payables')
    ->dailyAt('06:05')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/overdue-payables.log'));

// ─── Recurring Work Orders (#24) (diário às 6:30h) ───
Schedule::command('app:generate-recurring-work-orders')
    ->dailyAt('06:30')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/recurring-work-orders.log'));

// ─── Expired Quotes (diário às 06:15) ───
Schedule::command('quotes:check-expired')
    ->dailyAt('06:15')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/expired-quotes.log'));

// ─── Quote Expiration Alerts (diário às 06:20) ───
Schedule::job(new \App\Jobs\QuoteExpirationAlertJob)
    ->dailyAt('06:20')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/quote-expiration-alerts.log'));

// ─── Quote Follow-up (diário às 08:20) ───
Schedule::job(new \App\Jobs\QuoteFollowUpJob)
    ->dailyAt('08:20')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/quote-followup.log'));

// ─── Low Stock Alerts (diário às 07:15) ───
Schedule::command('stock:check-low')
    ->dailyAt('07:15')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/stock-low-alerts.log'));

// ─── Upcoming Payments (diário às 08:00) ───
Schedule::command('notify:upcoming-payments')
    ->dailyAt('08:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/upcoming-payments.log'));

// ─── Auto Billing Recurring Contracts (mensal dia 1 às 06:00) ───
Schedule::command('contracts:bill-recurring')
    ->monthlyOn(1, '06:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/recurring-billing.log'));

// ─── SLA Breach Detection (a cada 15 min) ───
Schedule::command('sla:check-breaches')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/sla-breaches.log'));

// ─── Central: Varredura de Financeiros Vencidos (diário às 06:30) ───
Schedule::command('central:scan-financials')
    ->dailyAt('06:30')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/central-scan-financials.log'));

// ─── Central: Lembretes (remind_at) a cada 5 min ───
Schedule::command('central:send-reminders')
    ->everyFiveMinutes()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/central-reminders.log'));

// ─── INMETRO Weekly Sync (semanal - segunda às 06:00) ───
Schedule::command('inmetro:sync')
    ->weeklyOn(1, '06:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/inmetro-sync.log'));

// ─── Inventário PWA: lembrete semanal (técnico e motorista) ───
Schedule::command('inventory:weekly-reminder')
    ->weeklyOn(1, '08:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/inventory-weekly-reminder.log'));

// ─── Inventário central: lembrete mensal (estoquista) ───
Schedule::command('inventory:monthly-central-reminder')
    ->monthlyOn(1, '08:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/inventory-monthly-central.log'));

// ─── INMETRO Lead Generation (diário às 07:45) ───
Schedule::command('inmetro:generate-leads')
    ->dailyAt('07:45')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/inmetro-leads.log'));

// ─── GAP-12: Overdue Follow-ups (diário às 08:15) ───
Schedule::command('customers:check-overdue-follow-ups')
    ->dailyAt('08:15')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/overdue-follow-ups.log'));

// ─── Contratos Recorrentes Vencendo (diário às 07:00) ───
Schedule::command('contracts:check-expiring')
    ->dailyAt('07:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/expiring-contracts.log'));

// ─── 🔴 CRÍTICO: OS Concluída Sem Faturamento (diário às 08:30) ───
Schedule::command('work-orders:check-unbilled')
    ->dailyAt('08:30')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/unbilled-work-orders.log'));

// ─── Alert Engine (diário às 07:40) ───
Schedule::command('alerts:run-engine')
    ->dailyAt('07:40')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/alert-engine.log'));

// ─── Collection Automation (diário às 09:00) ───
Schedule::command('finance:run-collection')
    ->dailyAt('09:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/collection-automation.log'));

// ─── Satisfaction Survey Post-OS (diário às 10:00) ───
Schedule::command('surveys:send-post-os')
    ->dailyAt('10:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/post-os-surveys.log'));

// ─── Email IMAP Sync (a cada 2 min) ───
Schedule::call(function () {
    \App\Models\EmailAccount::where('is_active', true)->each(function ($account) {
        \App\Jobs\SyncEmailAccountJob::dispatch($account);
    });
})
    ->everyTwoMinutes()
    ->name('email-imap-sync')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/email-sync.log'));

// ─── Email AI Classification (a cada 5 min) ───
Schedule::call(function () {
    \App\Models\Email::whereNull('ai_classified_at')
        ->where('created_at', '>=', now()->subDay())
        ->each(function ($email) {
            \App\Jobs\ClassifyEmailJob::dispatch($email);
        });
})
    ->everyFiveMinutes()
    ->name('email-ai-classify')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/email-classify.log'));

// ─── Send Scheduled Emails (a cada minuto) ───
Schedule::job(new \App\Jobs\SendScheduledEmails)
    ->everyMinute()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/email-scheduled-send.log'));

// ─── CRM: Processar Cadências de Prospecção (a cada hora) ───
Schedule::job(new \App\Jobs\ProcessCrmSequences)
    ->hourly()
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/crm-sequences.log'));

// ─── Relatórios Agendados (diário às 07:10) ───
Schedule::command('reports:send-scheduled')
    ->dailyAt('07:10')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/scheduled-reports.log'));

// ─── CRM: Gerar Alertas Inteligentes (diário às 07:20) ───
Schedule::job(new \App\Jobs\GenerateCrmSmartAlerts)
    ->dailyAt('07:20')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/crm-smart-alerts.log'));
