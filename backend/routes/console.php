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
