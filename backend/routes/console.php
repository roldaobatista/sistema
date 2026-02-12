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

// ─── INMETRO Weekly Sync (semanal - segunda às 06:00) ───
Schedule::command('inmetro:sync')
    ->weeklyOn(1, '06:00')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/inmetro-sync.log'));

// ─── INMETRO Lead Generation (diário às 07:45) ───
Schedule::command('inmetro:generate-leads')
    ->dailyAt('07:45')
    ->withoutOverlapping()
    ->appendOutputTo(storage_path('logs/inmetro-leads.log'));

