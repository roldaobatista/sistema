<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$c = \Illuminate\Support\Facades\DB::connection();
echo 'connection: ' . $c->getName();
echo "\ndatabase: " . $c->getDatabaseName();
echo "\nroles count: " . \Illuminate\Support\Facades\DB::table('roles')->count();
echo "\n";
