<?php

use Illuminate\Support\Facades\Schema;

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$hasColumn = Schema::hasColumn('roles', 'tenant_id');
echo "Has tenant_id column: " . ($hasColumn ? 'YES' : 'NO') . "\n";

$indexes = Schema::getConnection()->getDoctrineSchemaManager()->listTableIndexes('roles');
foreach ($indexes as $index) {
    echo "Index: " . $index->getName() . " Columns: " . implode(', ', $index->getColumns()) . "\n";
}
