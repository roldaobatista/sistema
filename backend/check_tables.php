<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tables = ['work_orders','quotes','service_calls','schedules','expenses','commission_events','central_items','crm_deals','technician_cash_transactions'];
foreach ($tables as $t) {
    echo $t . ': ' . (Illuminate\Support\Facades\Schema::hasTable($t) ? 'OK' : 'MISSING') . PHP_EOL;
}
