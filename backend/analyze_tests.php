<?php
$xml = simplexml_load_file('test-results.xml');
$missing_cols = [];
$not_null = [];
$status_mismatches = [];
$route_errors = [];
$other_patterns = [];

function walkSuites3($node, &$missing_cols, &$not_null, &$status_mismatches, &$route_errors, &$other_patterns) {
    if (isset($node->testcase)) {
        foreach ($node->testcase as $tc) {
            $msg = '';
            if (isset($tc->error)) $msg = (string) $tc->error;
            if (isset($tc->failure)) $msg = (string) $tc->failure;
            if (!$msg) continue;

            if (preg_match('/table (\w+) has no column named (\w+)/', $msg, $m)) {
                $missing_cols["{$m[1]}.{$m[2]}"] = ($missing_cols["{$m[1]}.{$m[2]}"] ?? 0) + 1;
            } elseif (preg_match('/NOT NULL constraint failed: (\w+\.\w+)/', $msg, $m)) {
                $not_null[$m[1]] = ($not_null[$m[1]] ?? 0) + 1;
            } elseif (preg_match('/Expected response status code \[(\d+)\] but received (\d+)/', $msg, $m)) {
                $status_mismatches["expected {$m[1]} got {$m[2]}"] = ($status_mismatches["expected {$m[1]} got {$m[2]}"] ?? 0) + 1;
            } elseif (preg_match('/Route \[([^\]]+)\] not defined/', $msg, $m)) {
                $route_errors[$m[1]] = ($route_errors[$m[1]] ?? 0) + 1;
            } else {
                $lines = explode("\n", $msg);
                $firstLine = trim($lines[0]);
                if (strlen($firstLine) < 10 && isset($lines[1])) $firstLine = trim($lines[1]);
                $firstLine = substr($firstLine, 0, 100);
                $firstLine = preg_replace('/\d+/', 'N', $firstLine);
                $other_patterns[$firstLine] = ($other_patterns[$firstLine] ?? 0) + 1;
            }
        }
    }
    if (isset($node->testsuite)) {
        foreach ($node->testsuite as $sub) {
            walkSuites3($sub, $missing_cols, $not_null, $status_mismatches, $route_errors, $other_patterns);
        }
    }
}

walkSuites3($xml, $missing_cols, $not_null, $status_mismatches, $route_errors, $other_patterns);

echo "=== MISSING COLUMNS ===" . PHP_EOL;
arsort($missing_cols);
foreach ($missing_cols as $col => $count) echo "  {$count}x {$col}" . PHP_EOL;

echo PHP_EOL . "=== NOT NULL CONSTRAINT FAILURES ===" . PHP_EOL;
arsort($not_null);
foreach ($not_null as $col => $count) echo "  {$count}x {$col}" . PHP_EOL;

echo PHP_EOL . "=== STATUS CODE MISMATCHES ===" . PHP_EOL;
arsort($status_mismatches);
foreach ($status_mismatches as $key => $count) echo "  {$count}x {$key}" . PHP_EOL;

echo PHP_EOL . "=== ROUTE NOT DEFINED ===" . PHP_EOL;
arsort($route_errors);
foreach ($route_errors as $route => $count) echo "  {$count}x {$route}" . PHP_EOL;

echo PHP_EOL . "=== TOP OTHER ERRORS ===" . PHP_EOL;
arsort($other_patterns);
$i = 0;
foreach ($other_patterns as $err => $count) {
    echo "  {$count}x {$err}" . PHP_EOL;
    if (++$i >= 30) break;
}
