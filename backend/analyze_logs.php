<?php
$handle = fopen("test_pass2.log", "r");
$patterns = [];
$currentError = '';
$capture = false;

if ($handle) {
    while (($line = fgets($handle)) !== false) {
        // Strip ANSI codes
        $line = preg_replace('/\e\[[\d;]*m/', '', trim($line));
        
        if (str_starts_with($line, '• ')) {
            $capture = true;
            $currentError = '';
            continue;
        }
        if ($capture) {
            // End of error message block detection
            if ($line === '' || str_starts_with($line, 'at ') || str_starts_with($line, 'FAIL') || str_starts_with($line, 'PASS')) {
                $capture = false;
                if ($currentError) {
                    $normalized = preg_replace('/\d+/', 'N', substr($currentError, 0, 100));
                    $patterns[$normalized] = ($patterns[$normalized] ?? 0) + 1;
                }
                continue;
            }
            if (!$currentError) $currentError = $line;
        }
    }
    fclose($handle);
}

arsort($patterns);
echo "=== TOP LOG PATTERNS ===" . PHP_EOL;
$i = 0;
foreach ($patterns as $err => $count) {
    echo str_pad($count, 5) . "| {$err}" . PHP_EOL;
    if (++$i >= 50) break;
}
