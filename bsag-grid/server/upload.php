<?php
// server/upload.php
// Upload-API in /uploads.
// chmod 755/775/777 Setup

header('Content-Type: application/json; charset=utf-8');

$targetBase = realpath(__DIR__ . '/../uploads');
if ($targetBase === false) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'Uploads-Verzeichnis nicht gefunden.']);
  exit;
}

if (!isset($_FILES['file']) || !isset($_POST['type'])) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'file oder type fehlt.']);
  exit;
}

$type = $_POST['type'];
$f = $_FILES['file'];

if ($f['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Upload-Fehler: '.$f['error']]);
  exit;
}

// Valid Typ
$allowedExt = [];
$destName = '';
switch ($type) {
  case 'logo':
    $allowedExt = ['png','webp','jpg','jpeg'];
    $destName = 'logo-'.time();
    break;
  case 'favicon':
    $allowedExt = ['png']; // Favicon: PNG
    $destName = 'favicon-'.time();
    break;
  case 'font':
    $allowedExt = ['woff2','woff','ttf','otf'];
    $destName = 'font-'.time();
    break;
  default:
    http_response_code(400);
    echo json_encode(['ok'=>false, 'error'=>'Unbekannter Typ.']);
    exit;
}
$ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt)) {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'Dateityp nicht erlaubt.']);
  exit;
}

$destPath = $targetBase . DIRECTORY_SEPARATOR . $destName . '.' . $ext;
if (!move_uploaded_file($f['tmp_name'], $destPath)) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'Konnte Datei nicht speichern.']);
  exit;
}

// Web-Path Script
$webPath = dirname($_SERVER['SCRIPT_NAME']) . '/../uploads/' . basename($destPath);
$webPath = preg_replace('#/+#','/',$webPath);

echo json_encode(['ok'=>true, 'path'=>$webPath]);
