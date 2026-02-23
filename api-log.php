<?php
header('Content-Type: application/json');
$headers = getallheaders();
$log = date('Y-m-d H:i:s') . "\n";
$log .= "URI: " . $_SERVER['REQUEST_URI'] . "\n";
$log .= "Method: " . $_SERVER['REQUEST_METHOD'] . "\n";
$log .= "Headers:\n";
foreach ($headers as $name => $value) {
    $log .= "  $name: $value\n";
}
$log .= "\n---END---\n";

$logFile = '/var/www/html/ai-web/api-debug-log.txt';
$result = file_put_contents($logFile, $log, FILE_APPEND);
if ($result === false) {
    $log .= "ERROR: Could not write to $logFile\n";
    $log .= "Error: " . error_get_last()['message'] . "\n";
}

echo json_encode([
    'received' => true,
    'headers' => $headers,
    'uri' => $_SERVER['REQUEST_URI'],
    'write_result' => $result
], JSON_PRETTY_PRINT);
