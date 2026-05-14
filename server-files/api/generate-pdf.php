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

function sanitizeForDocx($value) {
    if (is_array($value)) {
        foreach ($value as $k => $v) {
            $value[$k] = sanitizeForDocx($v);
        }
        return $value;
    }

    if (is_string($value)) {
        // Normalizae line endings first
        $text = str_replace(["\r\n", "\r"], "\n", $value);
        
        // Remove control characters (but keep \n for line breaks)
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text);

        // Ensure valid UTF-8
        $utf8 = @iconv('UTF-8', 'UTF-8//IGNORE', $text);
        if ($utf8 !== false) {
            $text = $utf8;
        }

        // CRITICAL: Escape XML entities to prevent parsing errors in Word
        // & must be escaped FIRST before other entities
        $text = str_replace('&', '&amp;', $text);    // & -> &amp;
        $text = str_replace('<', '&lt;', $text);     // < -> &lt;
        $text = str_replace('>', '&gt;', $text);     // > -> &gt;
        $text = str_replace('"', '&quot;', $text);   // " -> &quot;
        $text = str_replace("'", '&apos;', $text);   // ' -> &apos;

        return $text;
    }

    return $value;
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

// Sanitizar payload para evitar corrupción de DOCX por caracteres inválidos XML/UTF-8
$inputData = sanitizeForDocx($inputData);

// ================================================
// RUTAS
// ================================================
$baseDir = dirname(__DIR__);
$templatesDir = $baseDir . '/templates/';
$attachmentsDir = $baseDir . '/attachments/';

if (!is_dir($attachmentsDir)) mkdir($attachmentsDir, 0755, true);

// Seleccionar plantilla: technical_verification tiene prioridad
$requestedTemplateName = $inputData['template_name'] ?? '';
$isIeDocument = preg_match('/\bIE\b/i', $inputData['certificate_number'] ?? '') === 1;
$isAccredited = $inputData['accredited'] ?? false;
$rawTechnicalVerification = $inputData['technical_verification'] ?? false;
$isTechnicalVerification = (
    $rawTechnicalVerification === true ||
    $rawTechnicalVerification === 1 ||
    $rawTechnicalVerification === '1' ||
    strtolower((string)$rawTechnicalVerification) === 'true'
);

if ($isIeDocument) {
    $allowedIeTemplates = [
        'ie_gis_02.docx',
        'ie_gis_04.docx',
        'ie_gis_05.docx',
        'ie_gis_08.docx',
        'ie_05.docx',
        'ie_12.docx',
        'ie_14.docx',
        'ie_plantilla_general.docx',
    ];

    $templateName = in_array($requestedTemplateName, $allowedIeTemplates, true)
        ? $requestedTemplateName
        : 'ie_plantilla_general.docx';

    $templatePath = $templatesDir . $templateName;
} elseif ($isTechnicalVerification) {
    $templateName = 'dcc_technical_verification.docx';
    $templatePath = $templatesDir . $templateName;

    // Fallback por si la plantilla técnica no está desplegada
    if (!file_exists($templatePath)) {
        logtxt("⚠️ Plantilla técnica no encontrada ($templatePath), aplicando fallback a plantilla general");
        $templateName = $isAccredited ? 'dcc_plantilla_general.docx' : 'dcc_plantilla_general_na.docx';
        $templatePath = $templatesDir . $templateName;
    }
} else {
    $templateName = $isAccredited ? 'dcc_plantilla_general.docx' : 'dcc_plantilla_general_na.docx';
    $templatePath = $templatesDir . $templateName;
}

logtxt("Plantilla seleccionada: $templateName (requested: $requestedTemplateName, is_ie: " . ($isIeDocument ? 'true' : 'false') . ", accredited: " . ($isAccredited ? 'true' : 'false') . ", technical_verification: " . ($isTechnicalVerification ? 'true' : 'false') . ")");

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
    try {
        $tp->setValue('pt', $inputData['pt'] ?? '');
        logtxt('Set pt = ' . ($inputData['pt'] ?? ''));
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer 'pt': " . $e->getMessage());
    }

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
    try {
        $tp->setValue('temperature', $temperature);
        $tp->setValue('humidity', $humidity);
        $tp->setValue('pressure', $pressure);

        logtxt("Set temperature = $temperature");
        logtxt("Set humidity = $humidity");
        logtxt("Set pressure = $pressure");
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer influence conditions: " . $e->getMessage());
        try { $tp->setValue('temperature', $temperature); } catch (Exception $e1) {}
        try { $tp->setValue('humidity', $humidity); } catch (Exception $e1) {}
        try { $tp->setValue('pressure', $pressure); } catch (Exception $e1) {}
    }

    

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
        if (count($equipos) === 1) {
            $eq = $equipos[0];
            try {
                $tp->setValue('id_patron', $eq['id_patron']);
                $tp->setValue('name_patron', $eq['name_patron']);
                $tp->setValue('manufacturer_patron', $eq['manufacturer_patron']);
                $tp->setValue('model_patron', $eq['model_patron']);
                $tp->setValue('sn_patron', $eq['sn_patron']);
                $tp->setValue('interval_patron', $eq['interval_patron']);
                logtxt("Set id_patron = {$eq['id_patron']}, name_patron = {$eq['name_patron']}, manufacturer_patron = {$eq['manufacturer_patron']}, model_patron = {$eq['model_patron']}, sn_patron = {$eq['sn_patron']}, interval_patron = {$eq['interval_patron']}");
            } catch (Exception $e) {
                logtxt("⚠️ WARNING: No se pudo establecer valores de measuring equipment (single): " . $e->getMessage());
                try { $tp->setValue('id_patron', $eq['id_patron']); } catch (Exception $e1) {}
                try { $tp->setValue('name_patron', $eq['name_patron']); } catch (Exception $e1) {}
                try { $tp->setValue('manufacturer_patron', $eq['manufacturer_patron']); } catch (Exception $e1) {}
                try { $tp->setValue('model_patron', $eq['model_patron']); } catch (Exception $e1) {}
                try { $tp->setValue('sn_patron', $eq['sn_patron']); } catch (Exception $e1) {}
                try { $tp->setValue('interval_patron', $eq['interval_patron']); } catch (Exception $e1) {}
            }
        } else {
            try {
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
            } catch (Exception $e) {
                logtxt("⚠️ WARNING: No se pudo clonar filas de measuring equipment (multiple): " . $e->getMessage());
                // Fallback: establecer el primer equipo
                try {
                    $eq = $equipos[0];
                    $tp->setValue('id_patron', $eq['id_patron']);
                    $tp->setValue('name_patron', $eq['name_patron']);
                    $tp->setValue('manufacturer_patron', $eq['manufacturer_patron']);
                    $tp->setValue('model_patron', $eq['model_patron']);
                    $tp->setValue('sn_patron', $eq['sn_patron']);
                    $tp->setValue('interval_patron', $eq['interval_patron']);
                } catch (Exception $e2) {
                    logtxt("⚠️ WARNING: No se pudo establecer fallback de measuring equipment: " . $e2->getMessage());
                }
            }
        }
    } else {
        try {
            $tp->setValue('id_patron', '');
            $tp->setValue('name_patron', '');
            $tp->setValue('manufacturer_patron', '');
            $tp->setValue('model_patron', '');
            $tp->setValue('sn_patron', '');
            $tp->setValue('interval_patron', '');
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo limpiar marcadores de measuring equipment: " . $e->getMessage());
        }
    }


    // ========== METROLOGICAL TRACEABILITY (Solo para DCC con patrones) ========== //
    $isDcc = !preg_match('/\bIE\b/i', $inputData['certificate_number'] ?? '');
    $metroTraceability = [];
    
    // Usar directamente los datos enviados desde Angular
    if ($isDcc && !empty($inputData['metrologicalTraceability']) && is_array($inputData['metrologicalTraceability'])) {
        $metroTraceability = $inputData['metrologicalTraceability'];
    }
    
    // Procesar filas para Metrological Traceability si existen
    if (count($metroTraceability) > 0) {
        try {
            if (count($metroTraceability) === 1) {
                $tz = $metroTraceability[0];
                $tp->setValue('tz_id', $tz['id_patron'] ?? '');
                $tp->setValue('tz_name', $tz['tz_name'] ?? '');
                $tp->setValue('tz_by', $tz['tz_by'] ?? '');
                $tp->setValue('tz_date', $tz['tz_date'] ?? '');
                $tp->setValue('tz_quantity', $tz['tz_quantity'] ?? '');
                $tp->setValue('tz_comm', $tz['tz_comm'] ?? '');
                logtxt("Set metrological traceability: id={$tz['id_patron']}, by={$tz['tz_by']}, date={$tz['tz_date']}");
            } else {
                $tp->cloneRow('tz_id', count($metroTraceability));
                foreach ($metroTraceability as $idx => $tz) {
                    $n = $idx + 1;
                    $tp->setValue("tz_id#{$n}", $tz['id_patron'] ?? '');
                    $tp->setValue("tz_name#{$n}", $tz['tz_name'] ?? '');
                    $tp->setValue("tz_by#{$n}", $tz['tz_by'] ?? '');
                    $tp->setValue("tz_date#{$n}", $tz['tz_date'] ?? '');
                    $tp->setValue("tz_quantity#{$n}", $tz['tz_quantity'] ?? '');
                    $tp->setValue("tz_comm#{$n}", $tz['tz_comm'] ?? '');
                    logtxt("Set metrological traceability#{$n}: id={$tz['id_patron']}, by={$tz['tz_by']}, date={$tz['tz_date']}");
                }
            }
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo procesar metrological traceability: " . $e->getMessage());
        }
    } else {
        // Limpiar marcadores si no hay traceability (solo si existen en la plantilla)
        try {
            $tp->setValue('tz_id', '');
            $tp->setValue('tz_name', '');
            $tp->setValue('tz_by', '');
            $tp->setValue('tz_date', '');
            $tp->setValue('tz_quantity', '');
            $tp->setValue('tz_comm', '');
        } catch (Exception $e) {
            // Ignorar si no existen estos placeholders
        }
    }


    // ========== ITEMS Y SUBITEMS ========== //
    // Loguear el valor simple recibido
    // logtxt('Valor recibido de item_manufacturer: ' . ($inputData['item_manufacturer'] ?? '[NO RECIBIDO]'));

    $items = [];
    
    // Nuevo sistema: usar itemsList si existe (array de items del nuevo dcc_items)
    if (!empty($inputData['itemsList']) && is_array($inputData['itemsList'])) {
        logtxt('📦 Usando itemsList (nuevo sistema): ' . count($inputData['itemsList']) . ' items');
        foreach ($inputData['itemsList'] as $item) {
            $items[] = [
                'name' => $item['object'] ?? '',
                'manufacturer' => $item['manufacturer'] ?? '',
                'model' => $item['model'] ?? '',
                'sn' => $item['serial_number'] ?? '',
                'id' => $item['costumer_asset'] ?? '',
                'comment' => $item['comment'] ?? '',
                'description' => $item['description'] ?? '',
            ];
        }
    } else {
        // Sistema antiguo: item principal + subitems
        logtxt('📦 Usando sistema antiguo (item_name + subitems)');
        // Item principal
        if (!empty($inputData['item_name'])) {
            $items[] = [
                'name' => $inputData['item_name'] ?? '',
                'manufacturer' => $inputData['item_manufacturer'] ?? '',
                'model' => $inputData['item_model'] ?? '',
                'sn' => $inputData['item_serial_number'] ?? '',
                'id' => $inputData['item_customer_asset_id'] ?? '',
                'comment' => $inputData['item_comment'] ?? '',
                'description' => '',
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
                    'comment' => $sub['comment'] ?? '',
                    'description' => '',
                ];
            }
        }
    }
    
    // Loguear el array completo de items para depuración
    logtxt('📋 Items para plantilla: ' . count($items) . ' items procesados');
    // logtxt('ITEMS PARA PLANTILLA: ' . print_r($items, true));

    // Obtener la descripción (es la misma para todos los items del DCC)
    $itemDescription = '';
    if (count($items) > 0 && !empty($items[0]['description'])) {
        $itemDescription = $items[0]['description'];
    }
    
    // Establecer la descripción una sola vez (aplica a todos los items)
    try {
        $tp->setValue('item_description', $itemDescription);
        logtxt('📝 Descripción de items establecida: ' . ($itemDescription ? 'OK' : 'vacía'));
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer item_description: " . $e->getMessage());
    }

    // Variable explícita para plantilla IE
    $objetoTest = $inputData['objeto_test'] ?? $itemDescription;
    try {
        $tp->setValue('objeto_test', $objetoTest);
        logtxt('Set objeto_test = ' . $objetoTest);
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer objeto_test: " . $e->getMessage());
    }

    // Variable explícita para plantilla IE/DCC: descripción de equipamiento
    $equipamiento = trim((string)($inputData['equipamiento'] ?? ''));
    if ($equipamiento === '' && count($items) > 0) {
        $equipamientoParts = [];
        foreach ($items as $itemRow) {
            $rowParts = [];
            $nameVal = trim((string)($itemRow['name'] ?? ''));
            $idVal = trim((string)($itemRow['id'] ?? ''));
            $manufacturerVal = trim((string)($itemRow['manufacturer'] ?? ''));
            $modelVal = trim((string)($itemRow['model'] ?? ''));
            $snVal = trim((string)($itemRow['sn'] ?? ''));
            $commentVal = trim((string)($itemRow['comment'] ?? ''));

            if ($nameVal !== '') {
                $rowParts[] = $nameVal . '.';
            }
            if ($idVal !== '') {
                $rowParts[] = 'No. de inventario / Identificacion: ' . $idVal . '.';
            }
            if ($manufacturerVal !== '') {
                $rowParts[] = 'Marca: ' . $manufacturerVal . '.';
            }
            if ($modelVal !== '') {
                $rowParts[] = 'Modelo: ' . $modelVal . '.';
            }
            if ($snVal !== '') {
                $rowParts[] = 'No. de serie: ' . $snVal . '.';
            }
            if ($commentVal !== '') {
                if (!preg_match('/[.!?]$/u', $commentVal)) {
                    $commentVal .= '.';
                }
                $rowParts[] = $commentVal;
            }

            $rowText = trim(implode(' ', $rowParts));
            if ($rowText !== '') {
                $equipamientoParts[] = $rowText;
            }
        }
        $equipamiento = implode(' ', $equipamientoParts);
    }

    // Unificar valor para que también entre por el bloque de variables simples
    $inputData['equipamiento'] = $equipamiento;
    try {
        $tp->setValue('equipamiento', $equipamiento);
        logtxt('Set equipamiento = ' . $equipamiento);
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer equipamiento: " . $e->getMessage());
    }

    // Clonar filas en la plantilla para cada item
    if (count($items) > 0) {
        logtxt('🔄 Clonando ' . count($items) . ' filas de items');
        try {
            $tp->cloneRow('item', count($items));
            foreach ($items as $idx => $item) {
                $n = $idx + 1;
                $tp->setValue("item#{$n}", $n);
                $tp->setValue("name_item#{$n}", $item['name']);
                $tp->setValue("manufacturer_item#{$n}", $item['manufacturer']);
                $tp->setValue("model_item#{$n}", $item['model']);
                $tp->setValue("sn_item#{$n}", $item['sn']);
                $tp->setValue("id_item#{$n}", $item['id']);
                $tp->setValue("id_comm#{$n}", $item['comment']);
                logtxt("✅ Set item#{$n}: name={$item['name']}, manufacturer={$item['manufacturer']}, model={$item['model']}, sn={$item['sn']}, id={$item['id']}, comment={$item['comment']}");
            }
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo clonar filas de items (plantilla no tiene marcador 'item'): " . $e->getMessage());
            // Para IE y otras plantillas sin estructura de items, establecer valores simples
            try {
                $item = $items[0];
                $tp->setValue('item', '');
                $tp->setValue('name_item', $item['name']);
                $tp->setValue('manufacturer_item', $item['manufacturer']);
                $tp->setValue('model_item', $item['model']);
                $tp->setValue('sn_item', $item['sn']);
                $tp->setValue('id_item', $item['id']);
                $tp->setValue('id_comm', $item['comment']);
            } catch (Exception $e2) {
                logtxt("⚠️ WARNING: No se pudo establecer valores simples de items: " . $e2->getMessage());
            }
        }
    } else {
        // Si no hay items, limpiar marcadores simples
        logtxt('⚠️ No hay items, limpiando marcadores');
        try {
            $tp->setValue('item', '');
            $tp->setValue('name_item', '');
            $tp->setValue('manufacturer_item', '');
            $tp->setValue('model_item', '');
            $tp->setValue('sn_item', '');
            $tp->setValue('id_item', '');
            $tp->setValue('id_comm', '');
            $tp->setValue('item_description', '');
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo limpiar marcadores de items: " . $e->getMessage());
        }
    }

    // ========== PERFORMANCE LOCATION: nombre y dirección según tipo ========== //
    $performanceLocationType = $inputData['performance_location_type'] ?? 'Laboratory';
    $performanceLocation_name = '';
    $performanceLocation_direction = '';

    if ($performanceLocationType === 'Laboratory') {
        // Laboratory: usar datos del laboratorio
        $performanceLocation_name = $inputData['laboratory_name'] ?? '';
        $performanceLocation_direction = $inputData['laboratory_direction'] ?? '';
    } elseif ($performanceLocationType === 'Customer') {
        // Customer: usar datos del cliente
        $performanceLocation_name = $inputData['customer_name'] ?? '';
        $performanceLocation_direction = $inputData['customer_direction'] ?? '';
    } elseif ($performanceLocationType === 'Other') {
        // Other: nombre del cliente y dirección del proyecto
        $performanceLocation_name = $inputData['customer_name'] ?? '';
        $performanceLocation_direction = $inputData['project_location'] ?? '';
    }

    $tp->setValue('performanceLocation_name', $performanceLocation_name);
    $tp->setValue('performanceLocation_direction', $performanceLocation_direction);

    logtxt("Set performanceLocation_name = $performanceLocation_name (type: $performanceLocationType)");
    logtxt("Set performanceLocation_direction = $performanceLocation_direction");

    // ========== PERFORMANCE DATE ========== //
    $isRange = $inputData['is_range_date'] ?? false;
    $begin = $inputData['beginPerformanceDate'] ?? '';
    $end = $inputData['endPerformanceDate'] ?? '';
    if ($isRange && $begin && $end) {
        $performanceDate = "$begin - $end";
    } else {
        $performanceDate = $begin;
    }
    try {
        $tp->setValue('PerformanceDate', $performanceDate);
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer PerformanceDate: " . $e->getMessage());
    }
    // logtxt("Set PerformanceDate = $performanceDate");

    // ========== RESPONSIBLES ========== //
    $calibrated = [];
    $calibrated_roles = [];
    $approved = '';
    $approved_role = '';
    $approved_email = '';
    $calibrated_email = '';

    if ($isIeDocument) {
        $approved = $inputData['approved_by'] ?? '';
        $approved_role = $inputData['approved_by_role'] ?? '';
        $approved_email = $inputData['approved_by_email'] ?? '';
        $calibratedSingle = $inputData['calibrated_by'] ?? '';
        $calibratedSingleRole = $inputData['calibrated_by_role'] ?? '';
        $calibrated_email = $inputData['calibrated_by_email'] ?? '';

        try {
            $tp->setValue('calibrated_by', $calibratedSingle);
            $tp->setValue('calibrated_by_role', $calibratedSingleRole);
            $tp->setValue('calibrated_by_email', $calibrated_email);
            $tp->setValue('approved_by', $approved);
            $tp->setValue('approved_by_role', $approved_role);
            $tp->setValue('approved_by_email', $approved_email);
    
            logtxt("Set calibrated_by = $calibratedSingle");
            logtxt("Set calibrated_by_role = $calibratedSingleRole");
            logtxt("Set calibrated_by_email = $calibrated_email");
            logtxt("Set approved_by = $approved");
            logtxt("Set approved_by_role = $approved_role");
            logtxt("Set approved_by_email = $approved_email");
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo establecer algunos valores de responsables IE: " . $e->getMessage());
            // Intentar establecer solo los que existan
            try { $tp->setValue('approved_by', $approved); } catch (Exception $e1) {}
            try { $tp->setValue('approved_by_role', $approved_role); } catch (Exception $e1) {}
            try { $tp->setValue('approved_by_email', $approved_email); } catch (Exception $e1) {}
            try { $tp->setValue('calibrated_by', $calibratedSingle); } catch (Exception $e1) {}
            try { $tp->setValue('calibrated_by_role', $calibratedSingleRole); } catch (Exception $e1) {}
            try { $tp->setValue('calibrated_by_email', $calibrated_email); } catch (Exception $e1) {}
        }
    } else {
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

        if (count($calibrated) > 0) {
            $n = count($calibrated);
            try {
                $tp->cloneRow('calibrated_by', $n);
                for ($i = 1; $i <= $n; $i++) {
                    $tp->setValue("calibrated_by#{$i}", $calibrated[$i-1]);
                    $roleVal = $calibrated_roles[$i-1] ?? '';
                    $tp->setValue("calibrated_by_role#{$i}", $roleVal);
                    logtxt("Set calibrated_by#{$i} = " . ($calibrated[$i-1] ?? ''));
                    logtxt("Set calibrated_by_role#{$i} = " . ($roleVal));
                }
            } catch (Exception $e) {
                logtxt("⚠️ WARNING: No se pudo clonar filas de calibrated_by: " . $e->getMessage());
                // Fallback: establecer el primer calibrado en el valor simple
                $tp->setValue('calibrated_by', $calibrated[0] ?? '');
                $tp->setValue('calibrated_by_role', $calibrated_roles[0] ?? '');
            }
        } else {
            $tp->setValue('calibrated_by', '');
            $tp->setValue('calibrated_by_role', '');
        }
        try {
            $tp->setValue('approved_by', $approved);
            $tp->setValue('approved_by_role', $approved_role);
            logtxt("Set approved_by = $approved");
            logtxt("Set approved_by_role = $approved_role");
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo establecer approved_by DCC: " . $e->getMessage());
            try { $tp->setValue('approved_by', $approved); } catch (Exception $e1) {}
            try { $tp->setValue('approved_by_role', $approved_role); } catch (Exception $e1) {}
        }
    }

    // ========== OTRAS VARIABLES SIMPLES ========== //

    $variables = [
        'certificate_number','issue_date','customer_name','customer_direction','customer_email',
        'customer_phone','customer_rep','customer_rep_tel','laboratory_name','laboratory_direction','laboratory_phone',
        'item_name','item_manufacturer','item_model','item_serial_number','item_comment','date_receipt',
        'next_calibration','pt_description','pt_method','test_number','circuito','norma',
        'faseA','faseB','faseC',
        'descripcion_servicio','objeto_test','equipamiento',
        'material_description',
        'cable_fabricante','cable_modelo','cable_metrajeA','cable_metrajeB','cable_metrajeC',
        'terminal1_fabricante','terminal1_modelo','terminal1_snA','terminal1_snB','terminal1_snC',
        'terminal2_fabricante','terminal2_modelo','terminal2_snA','terminal2_snB','terminal2_snC',
        'empalmes_fabricante','empalmes_modelo','empalmes_metrajeA','empalmes_metrajeB','empalmes_metrajeC'
    ];
    foreach ($variables as $var) {
        $val = $inputData[$var] ?? '';
        
        // Si date_receipt es N/A, agregar texto adicional
        if ($var === 'date_receipt' && trim(strtoupper($val)) === 'N/A') {
            $val = 'N/A, on site calibration';
        }
        
        try {
            $tp->setValue($var, $val);
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo establecer variable simple '$var' (plantilla no tiene este marcador): " . $e->getMessage());
        }
        // logtxt("Set $var = " . substr($val, 0, 200));
    }

    // Fallback: descripción_servicio desde nombre de método hv_method
    if (empty($inputData['descripcion_servicio'])) {
        $descripcionServicioFallback = trim((string)($inputData['pt_method'] ?? ''));
        if ($descripcionServicioFallback !== '') {
            // Quitar prefijo PT-XX cuando venga en pt_method (ej: "PT-05 NOMBRE")
            $descripcionServicioFallback = preg_replace('/^PT-\d+\s+/i', '', $descripcionServicioFallback);
        }

        try {
            $tp->setValue('descripcion_servicio', $descripcionServicioFallback);
            // Intentar variante con acento si la plantilla la usa así
            try { $tp->setValue('descripción_servicio', $descripcionServicioFallback); } catch (Exception $e1) {}
            logtxt('Set descripcion_servicio (fallback) = ' . $descripcionServicioFallback);
        } catch (Exception $e) {
            logtxt("⚠️ WARNING: No se pudo establecer descripcion_servicio (fallback): " . $e->getMessage());
        }
    } else {
        // Intentar variante con acento si la plantilla la usa así
        try { $tp->setValue('descripción_servicio', $inputData['descripcion_servicio']); } catch (Exception $e1) {}
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
            try {
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
            } catch (Exception $e) {
                logtxt("⚠️ WARNING: No se pudo clonar filas de resultados tabla (plantilla no tiene marcador 'range'): " . $e->getMessage());
                // Para plantillas sin tabla de resultados, establecer valores simples si es posible
                try {
                    $tp->setValue('range', $rangeArr[0] ?? '');
                    $tp->setValue('voltaje_m', $voltajeMArr[0] ?? '');
                    $tp->setValue('ref_v', $refVArr[0] ?? '');
                    $tp->setValue('voltaje_e', $voltajeEArr[0] ?? '');
                    $tp->setValue('sf_ob', $sfObArr[0] ?? '');
                    $tp->setValue('expanded_u', $expandedUArr[0] ?? '');
                } catch (Exception $e2) {
                    logtxt("⚠️ WARNING: No se pudo establecer valores simples de resultados tabla: " . $e2->getMessage());
                }
            }
        }
    }

    // Procesar resultados individuales
    $meanValue = $results[1]['mean_sf_obtained'] ?? '';
    $linearityValue = $results[2]['linearity_sf_obtained'] ?? '';
    try {
        $tp->setValue('result_mean_value', $meanValue);
        $tp->setValue('result_vd', $linearityValue);
    } catch (Exception $e) {
        logtxt("⚠️ WARNING: No se pudo establecer resultados individuales: " . $e->getMessage());
    }
    // logtxt("Set result_mean_value = $meanValue");
    // logtxt("Set result_vd = $linearityValue");

    // ==================================================
    // GUARDAR DOCX
    // ==================================================
    // Reemplazar "DCC" por "DRAFT" en el nombre del certificado
    $certificateName = $inputData['certificate_number'] ?? 'DCC';
    $draftName = preg_replace('/\bDCC\b/i', 'DRAFT', $certificateName);
    // No agregar timestamp ni convertir espacios, mantener nombre original
    $outputFile = $draftName;
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
