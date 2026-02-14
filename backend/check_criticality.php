<?php

$dir = __DIR__ . '/database/migrations';
$files = glob($dir . '/*.php');

foreach ($files as $file) {
    $content = file_get_contents($file);
    
    // Simple regex to find assignments like 'criticality' => 'VALUE'
    // Matches single or double quotes
    if (preg_match_all("/['\"]criticality['\"]\s*=>\s*['\"]([^'\"]+)['\"]/i", $content, $matches)) {
        foreach ($matches[1] as $value) {
            $upper = strtoupper($value);
            if (!in_array($upper, ['LOW', 'MED', 'HIGH'])) {
                echo "Invalid criticality found in functionality " . basename($file) . ": '$value'\n";
            }
        }
    }
    
    // Also check for explicit DB updates/inserts with array structure if regex misses them
    // But regex should catch most 'key' => 'value' pairs.
}

echo "Scan complete.\n";
