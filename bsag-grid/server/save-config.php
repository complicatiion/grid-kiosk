<?php
// server/save-config.php
// data/config.json (optional).

header('Content-Type: application/json; charset=utf-8');

$raw = file_get_contents('php://input');
if (!$raw) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'No Body.']);
  exit;
}

$dataDir = realpath(__DIR__ . '/../data');
if ($dataDir === false) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'directory not found.']);
  exit;
}

$path = $dataDir . DIRECTORY_SEPARATOR . 'config.json';
if (file_put_contents($path, $raw) === false) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'couldnt write config.json (wite permission?).']);
  exit;
}

echo json_encode(['ok'=>true, 'path'=>'data/config.json']);
