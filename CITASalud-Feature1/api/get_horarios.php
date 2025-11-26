<?php
/**
 * Endpoint: api/get_horarios.php
 * Descripción: Delegación del manejo de la lógica al controlador correspondiente.
 */

// Ruta del controlador de forma segura y mantenible
$controllerPath = dirname(__DIR__) . '/controllers/horarios_controller.php';

// Verificación básica (opcional, pero buena práctica)
if (!file_exists($controllerPath)) {
    http_response_code(500);
    echo json_encode([
        "error" => "No se pudo cargar el controlador de horarios."
    ]);
    exit;
}

require_once $controllerPath;
