<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

echo json_encode([
    'status' => 'OK',
    'message' => 'PHP is working',
    'php_version' => PHP_VERSION
]);
?>
