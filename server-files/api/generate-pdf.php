<?php
// ================================================
// CONFIGURACIÓN DE ERRORES Y LOGS
// ================================================

ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_error.log');
error_reporting(E_ALL);
ini_set('display_errors', 0);

function logtxt($msg) {
    file_put_contents(__DIR__ . '/log.txt', date('Y-m-d H:i:s') . " | " . $msg . "\n", FILE_APPEND);
}

logtxt("=== NUEVA PETICIÓN ===");

// ================================================
// CORS
// ================================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    logtxt("Preflight OPTIONS");
    http_response_code(200);
    exit();
}

// ================================================
// GET → API TEST
// ================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    logtxt("GET OK: API Running");
    echo json_encode([
        'status' => 'API Running',
        'message' => 'Use POST method to generate PDF',
        'php_version' => PHP_VERSION,
        'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    ]);
    exit();
}

// ================================================
// SOLO POST
// ================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// ================================================
// LEER JSON
// ================================================

$raw = file_get_contents('php://input');
$inputData = json_decode($raw, true);

if ($inputData === null && trim($raw) !== "") {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit();
}
if (!is_array($inputData)) {
    http_response_code(400);
    echo json_encode(['error' => 'No JSON data received']);
    exit();
}

// ================================================
// RUTAS
// ================================================
$baseDir = dirname(__DIR__);
$templatesDir = $baseDir . '/templates/';
$attachmentsDir = $baseDir . '/attachments/';

if (!is_dir($attachmentsDir)) mkdir($attachmentsDir, 0755, true);

$templateName = $inputData['template_name'] ?? 'dcc_plantilla_general.docx';
$templatePath = $templatesDir . $templateName;

if (!file_exists($templatePath)) {
    logtxt("❌ Error: No existe la plantilla $templatePath");
    http_response_code(404);
    echo json_encode(['error' => 'Template not found', 'path' => $templatePath]);
    exit();
}

// ================================================
// PHPWORD
// ================================================
$autoload = $baseDir . '/vendor/autoload.php';
if (!file_exists($autoload)) {
    logtxt("❌ PhpWord not installed");
    http_response_code(500);
    echo json_encode(['error' => 'PhpWord not installed']);
    exit();
}
require_once $autoload;

// ================================================
// PROCESAR PLANTILLA
// ================================================
try {

    // Crear TemplateProcessor al inicio
    $tp = new \PhpOffice\PhpWord\TemplateProcessor($templatePath);
    // logtxt("Plantilla cargada: $templatePath");

    // ========== PT ========== //
    $tp->setValue('pt', $inputData['pt'] ?? '');
    logtxt('Set pt = ' . ($inputData['pt'] ?? ''));

    // ========== INFLUENCE CONDITIONS ========== //
    $temperature = '';
    $humidity = '';
    $pressure = '';

    if (!empty($inputData['influenceConditions']) && is_array($inputData['influenceConditions'])) {
    foreach ($inputData['influenceConditions'] as $cond) {
        if (($cond['refType'] ?? '') === 'basic_temperature') {
            $temperature = $cond['value'] ?? '';
        }
        if (($cond['refType'] ?? '') === 'basic_humidityRelative') {
            $humidity = $cond['value'] ?? '';
        }
        if (($cond['refType'] ?? '') === 'basic_pressure') {
            $pressure = $cond['value'] ?? '';
        }
    }
}
    $tp->setValue('temperature', $temperature);
    $tp->setValue('humidity', $humidity);
    $tp->setValue('pressure', $pressure);

    logtxt("Set temperature = $temperature");
    logtxt("Set humidity = $humidity");
    logtxt("Set pressure = $pressure");

    

    // ========== MEASURING EQUIPMENTS ========== //
    $equipos = [];
    if (!empty($inputData['measuringEquipments']) && is_array($inputData['measuringEquipments'])) {
        foreach ($inputData['measuringEquipments'] as $eq) {

            // Tomar directamente los valores enviados desde Angular
            $equipos[] = [
                'id_patron' => $eq['id_patron'] ?? '',
                'name_patron' => $eq['name_patron'] ?? '',
                'manufacturer_patron' => $eq['manufacturer_patron'] ?? '',
                'model_patron' => $eq['model_patron'] ?? '',
                'sn_patron' => $eq['sn_patron'] ?? '',
                'interval_patron' => $eq['interval_patron'] ?? '',
            ];
        }
    }

    // logtxt('MEASURING EQUIPMENTS PARA PLANTILLA: ' . print_r($equipos, true));


    if (count($equipos) > 0) {
        $tp->cloneRow('id_patron', count($equipos));
        foreach ($equipos as $idx => $eq) {
            $n = $idx + 1;
            $tp->setValue("id_patron#{$n}", $eq['id_patron']);
            $tp->setValue("name_patron#{$n}", $eq['name_patron']);
            $tp->setValue("manufacturer_patron#{$n}", $eq['manufacturer_patron']);
            $tp->setValue("model_patron#{$n}", $eq['model_patron']);
            $tp->setValue("sn_patron#{$n}", $eq['sn_patron']);
            $tp->setValue("interval_patron#{$n}", $eq['interval_patron']);
            logtxt("Set id_patron#{$n} = {$eq['id_patron']}, name_patron#{$n} = {$eq['name_patron']}, manufacturer_patron#{$n} = {$eq['manufacturer_patron']}, model_patron#{$n} = {$eq['model_patron']}, sn_patron#{$n} = {$eq['sn_patron']}, interval_patron#{$n} = {$eq['interval_patron']}");
        }
    } else {
        $tp->setValue('id_patron', '');
        $tp->setValue('name_patron', '');
        $tp->setValue('manufacturer_patron', '');
        $tp->setValue('model_patron', '');
        $tp->setValue('sn_patron', '');
        $tp->setValue('interval_patron', '');
    }


    // ========== ITEMS Y SUBITEMS ========== //
    // Loguear el valor simple recibido
    // logtxt('Valor recibido de item_manufacturer: ' . ($inputData['item_manufacturer'] ?? '[NO RECIBIDO]'));

    $items = [];
    // Item principal
    if (!empty($inputData['item_name'])) {
        $items[] = [
            'name' => $inputData['item_name'] ?? '',
            'manufacturer' => $inputData['item_manufacturer'] ?? '',
            'model' => $inputData['item_model'] ?? '',
            'sn' => $inputData['item_serial_number'] ?? '',
            'id' => $inputData['item_customer_asset_id'] ?? '',
        ];
    }
    // Subitems (esperados en inputData['subitems'] como array de objetos)
    if (!empty($inputData['subitems']) && is_array($inputData['subitems'])) {
        foreach ($inputData['subitems'] as $sub) {
            $items[] = [
                'name' => $sub['name'] ?? '',
                'manufacturer' => $sub['manufacturer'] ?? '',
                'model' => $sub['model'] ?? '',
                'sn' => $sub['serialNumber'] ?? '',
                'id' => $sub['customerAssetId'] ?? '',
            ];
        }
    }
    // Loguear el array completo de items para depuración
    // logtxt('ITEMS PARA PLANTILLA: ' . print_r($items, true));

    // Clonar filas en la plantilla para cada item
    if (count($items) > 0) {
        $tp->cloneRow('item', count($items));
        foreach ($items as $idx => $item) {
            $n = $idx + 1;
            $tp->setValue("item#{$n}", $n);
            $tp->setValue("name_item#{$n}", $item['name']);
            $tp->setValue("manufacturer_item#{$n}", $item['manufacturer']);
            $tp->setValue("model_item#{$n}", $item['model']);
            $tp->setValue("sn_item#{$n}", $item['sn']);
            $tp->setValue("id_item#{$n}", $item['id']);
            // logtxt("Set item#{$n} = $n, name_item#{$n} = {$item['name']}, manufacturer_item#{$n} = {$item['manufacturer']}, model_item#{$n} = {$item['model']}, sn_item#{$n} = {$item['sn']}, id_item#{$n} = {$item['id']}");
        }
    } else {
        // Si no hay items, limpiar marcadores simples
        $tp->setValue('item', '');
        $tp->setValue('name_item', '');
        $tp->setValue('manufacturer_item', '');
        $tp->setValue('model_item', '');
        $tp->setValue('sn_item', '');
        $tp->setValue('id_item', '');
    }

    // ========== LABORATORIO: nombre y dirección ========== //
    $performanceLocation_name = $inputData['laboratory_name'] ?? '';
    $performanceLocation_direction = $inputData['laboratory_direction'] ?? '';

    $tp->setValue('performanceLocation_name', $performanceLocation_name);
    $tp->setValue('performanceLocation_direction', $performanceLocation_direction);

    // logtxt("Set performanceLocation_name = $performanceLocation_name");
    // logtxt("Set performanceLocation_direction = $performanceLocation_direction");

    // ========== PERFORMANCE DATE ========== //
    $isRange = $inputData['is_range_date'] ?? false;
    $begin = $inputData['beginPerformanceDate'] ?? '';
    $end = $inputData['endPerformanceDate'] ?? '';
    if ($isRange && $begin && $end) {
        $performanceDate = "$begin - $end";
    } else {
        $performanceDate = $begin;
    }
    $tp->setValue('PerformanceDate', $performanceDate);
    // logtxt("Set PerformanceDate = $performanceDate");

    // ========== RESPONSIBLES ========== //
    $calibrated = [];
    $calibrated_roles = [];
    $approved = '';
    $approved_role = '';
    // logtxt('responsiblePersons: ' . print_r($inputData['responsiblePersons'] ?? null, true));
    if (isset($inputData['responsiblePersons']) && is_array($inputData['responsiblePersons'])) {
        foreach ($inputData['responsiblePersons'] as $p) {
            $name = trim($p['full_name'] ?? $p['name'] ?? '');
            $role = trim($p['role'] ?? '');
            $main = !empty($p['mainSigner']) || (!empty($p['main_sign']) && $p['main_sign']);
            if ($main) {
                $approved = $name;
                $approved_role = $role;
            } else {
                if ($name !== '') $calibrated[] = $name;
                if ($role !== '') $calibrated_roles[] = $role;
            }
        }
    }
    // logtxt('calibrated: ' . print_r($calibrated, true));
    // logtxt('calibrated_roles: ' . print_r($calibrated_roles, true));
    // logtxt('approved: ' . $approved);
    // logtxt('approved_role: ' . $approved_role);

    if (count($calibrated) > 0) {
        $n = count($calibrated);
        $tp->cloneRow('calibrated_by', $n);
        for ($i = 1; $i <= $n; $i++) {
            $tp->setValue("calibrated_by#{$i}", $calibrated[$i-1]);
            $roleVal = $calibrated_roles[$i-1] ?? '';
            $tp->setValue("calibrated_by_role#{$i}", $roleVal);
            logtxt("Set calibrated_by#{$i} = " . ($calibrated[$i-1] ?? ''));
            logtxt("Set calibrated_by_role#{$i} = " . ($roleVal));
        }
    } else {
        $tp->setValue('calibrated_by', '');
        $tp->setValue('calibrated_by_role', '');
    }
    $tp->setValue('approved_by', $approved);
    $tp->setValue('approved_by_role', $approved_role);
    logtxt("Set approved_by = $approved");
    logtxt("Set approved_by_role = $approved_role");

    // ========== OTRAS VARIABLES SIMPLES ========== //

    $variables = [
        'certificate_number','issue_date','customer_name','customer_direction','customer_email',
        'customer_phone','laboratory_name','laboratory_direction','laboratory_phone',
        'item_name','item_manufacturer','item_model','item_serial_number','date_receipt'
    ];
    foreach ($variables as $var) {
        $val = $inputData[$var] ?? '';
        $tp->setValue($var, $val);
        // logtxt("Set $var = " . substr($val, 0, 200));
    }

    // ========== RESULTADOS: TABLA Y INDIVIDUALES ========== //
    $results = $inputData['results'] ?? [];
    // logtxt('RESULTS recibidos: ' . print_r($results, true));

    // Procesar tabla de resultados (primer objeto)
    if (isset($results[0])) {
        $table = $results[0];
        $rangeArr = explode(' ', $table['range'] ?? '');
        $voltajeMArr = explode(' ', $table['voltaje_m'] ?? '');
        $refVArr = explode(' ', $table['ref_v'] ?? '');
        $voltajeEArr = explode(' ', $table['voltaje_e'] ?? '');
        $sfObArr = explode(' ', $table['sf_ob'] ?? '');
        $expandedUArr = explode(' ', $table['expanded_u'] ?? '');

        $nRows = count($rangeArr);
        if ($nRows > 0) {
            $tp->cloneRow('range', $nRows);
            for ($i = 1; $i <= $nRows; $i++) {
                $tp->setValue("range#{$i}", $rangeArr[$i-1] ?? '');
                $tp->setValue("voltaje_m#{$i}", $voltajeMArr[$i-1] ?? '');
                $tp->setValue("ref_v#{$i}", $refVArr[$i-1] ?? '');
                $tp->setValue("voltaje_e#{$i}", $voltajeEArr[$i-1] ?? '');
                $tp->setValue("sf_ob#{$i}", $sfObArr[$i-1] ?? '');
                $tp->setValue("expanded_u#{$i}", $expandedUArr[$i-1] ?? '');
                // logtxt("Set fila tabla resultado #{$i}: range={$rangeArr[$i-1]}, voltaje_m={$voltajeMArr[$i-1]}, ref_v={$refVArr[$i-1]}, voltaje_e={$voltajeEArr[$i-1]}, sf_ob={$sfObArr[$i-1]}, expanded_u={$expandedUArr[$i-1]}");
            }
        }
    }

    // Procesar resultados individuales
    $meanValue = $results[1]['mean_sf_obtained'] ?? '';
    $linearityValue = $results[2]['linearity_sf_obtained'] ?? '';
    $tp->setValue('result_mean_value', $meanValue);
    $tp->setValue('result_vd', $linearityValue);
    // logtxt("Set result_mean_value = $meanValue");
    // logtxt("Set result_vd = $linearityValue");

    // ==================================================
    // GUARDAR DOCX
    // ==================================================
    $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $inputData['certificate_number'] ?? 'DCC');
    $outputFile = $safeName . '_' . date('Ymd_His');
    $docx = $attachmentsDir . $outputFile . '.docx';
    $tp->saveAs($docx);
    logtxt("PDF generado correctamente para certificado: " . ($inputData['certificate_number'] ?? ''));

    // ==================================================
    // CONVERTIR A PDF (LibreOffice)
    // ==================================================
    $pdf = $attachmentsDir . $outputFile . '.pdf';
    $conversion = 'none';
    $sofficePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        '/usr/bin/soffice',
        '/usr/bin/libreoffice',
        'soffice',
    ];

    foreach ($sofficePaths as $s) {
        // sólo intentar si existe (excepto 'soffice' nombre simple)
        if ($s !== 'soffice' && !file_exists($s)) continue;
        $cmd = "\"$s\" --headless --convert-to pdf --outdir \"$attachmentsDir\" \"$docx\"";
        logtxt("Intentando conversión con: $cmd");
        exec($cmd . " 2>&1", $out, $ret);
        logtxt("Convert output: " . implode("\n", $out));
        logtxt("Convert return: $ret");
        if ($ret === 0 && file_exists($pdf)) {
            $conversion = 'libreoffice';
            break;
        }
    }

    // ==================================================
    // ARMAR URLs
    // ==================================================
    $proto = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost');
    $basePath = rtrim(dirname(dirname($_SERVER['REQUEST_URI'])), '/\\');
    $baseUrl = $proto . '://' . $host . $basePath;
    $docxUrl = $baseUrl . '/attachments/' . $outputFile . '.docx';
    $pdfUrl  = file_exists($pdf) ? $baseUrl . '/attachments/' . $outputFile . '.pdf' : null;

    logtxt("DOCX URL: $docxUrl");
    logtxt("PDF URL: $pdfUrl");

    echo json_encode([
        'success' => true,
        'conversion_method' => $conversion,
        'docx_url' => $docxUrl,
        'pdf_url' => $pdfUrl,
    ]);
    exit();

} catch (Exception $e) {
    logtxt("❌ ERROR: " . $e->getMessage());
    logtxt($e->getTraceAsString());
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'details' => $e->getMessage()]);
}
?>
