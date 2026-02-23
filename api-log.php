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

file_put_contents('/tmp/api-log.txt', $log, FILE_APPEND);

echo json_encode([
    'received' => true,
    'headers' => $headers,
    'uri' => $_SERVER['REQUEST_URI']
], JSON_PRETTY_PRINT);
