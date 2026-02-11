<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Config;

echo "Config Default: " . Config::get('database.default') . "\n";
echo "Env DB_CONNECTION: " . env('DB_CONNECTION') . "\n";

try {
    $pdo = DB::connection()->getPdo();
    echo "Actual Driver: " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "\n";
    echo "Database Name: " . DB::connection()->getDatabaseName() . "\n";
} catch (\Exception $e) {
    echo "DB Connection Error: " . $e->getMessage() . "\n";
}
