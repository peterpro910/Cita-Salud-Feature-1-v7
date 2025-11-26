<?php
// models/Paciente.php

class Paciente {
    private $conn;

    private $table_pacientes = "pacientes";
    private $table_usuarios = "usuarios";
    private $table_profesionales = "profesionales";

    // Propiedades del paciente / profesional
    public $id_usuario;
    public $id_paciente;
    public $documento;
    public $nombre;
    public $apellido;
    public $correo;
    public $contrasena_hash;
    public $intentos_fallidos;
    public $bloqueo_hasta;
    public $session_id_activa;
    public $reset_token;
    public $token_expira;
    public $id_rol;

    public function __construct($db) {
        $this->conn = $db;
    }

    /**
     * Busca un paciente o profesional por documento.
     */
    public function findByDocumento($documento) {
        $query = "
            SELECT 
                u.id_usuario,
                u.correo,
                u.contrasena AS contrasena_hash,
                u.intentos_fallidos,
                u.bloqueo_hasta,
                u.session_id_activa,
                u.reset_token,
                u.token_expira,
                u.id_rol,

                COALESCE(p.id_paciente, NULL) AS id_paciente,
                COALESCE(p.numero_documento, pr.numero_documento) AS documento,
                COALESCE(p.nombre, pr.nombre) AS nombre,
                COALESCE(p.apellido, pr.apellido) AS apellido
            FROM {$this->table_usuarios} u
            LEFT JOIN {$this->table_pacientes} p ON p.id_usuario = u.id_usuario
            LEFT JOIN {$this->table_profesionales} pr ON pr.id_usuario = u.id_usuario
            WHERE p.numero_documento = :documento OR pr.numero_documento = :documento
            LIMIT 1
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':documento', $documento);
        $stmt->execute();

        if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {

            // Cargar todas las propiedades correspondientes
            foreach ($row as $key => $value) {
                if (property_exists($this, $key)) {
                    $this->$key = $value;
                }
            }

            return $this;
        }

        return false;
    }

    /**
     * Verifica el login, bloqueo, intentos y contraseña.
     */
    public function login($password_plano) {

        // Bloqueo activo
        if ($this->bloqueo_hasta && strtotime($this->bloqueo_hasta) > time()) {
            return false;
        }

        // Bloqueo expirado → resetear
        if ($this->bloqueo_hasta && strtotime($this->bloqueo_hasta) <= time()) {
            $this->resetIntentos();
        }

        // Hash modo legacy
        $password_ingresada_hash = hash('sha256', $password_plano);

        if ($password_ingresada_hash === $this->contrasena_hash) {
            $this->resetIntentos();
            return true;
        }

        $this->incrementIntentos();
        return false;
    }


    /**
     * Incrementa intentos fallidos y aplica bloqueo.
     */
    public function incrementIntentos() {
        $max_intentos = 5;
        $tiempo_bloqueo = 30 * 60; // 30 minutos

        $this->intentos_fallidos++;

        $query = "
            UPDATE {$this->table_usuarios}
            SET intentos_fallidos = :intentos
                " . ($this->intentos_fallidos >= $max_intentos ? ", bloqueo_hasta = :bloqueo" : "") . "
            WHERE id_usuario = :id
        ";

        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':intentos', $this->intentos_fallidos, PDO::PARAM_INT);
        $stmt->bindParam(':id', $this->id_usuario, PDO::PARAM_INT);

        if ($this->intentos_fallidos >= $max_intentos) {
            $bloqueo = date('Y-m-d H:i:s', time() + $tiempo_bloqueo);
            $stmt->bindParam(':bloqueo', $bloqueo);
            $this->bloqueo_hasta = $bloqueo;
        }

        $stmt->execute();
    }

    /**
     * Resetea intentos y desbloquea usuario.
     */
    public function resetIntentos() {
        $query = "
            UPDATE {$this->table_usuarios}
            SET intentos_fallidos = 0,
                bloqueo_hasta = NULL
            WHERE id_usuario = :id
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id_usuario, PDO::PARAM_INT);
        $stmt->execute();

        $this->intentos_fallidos = 0;
        $this->bloqueo_hasta = null;
    }

    /**
     * Verifica si existe otra sesión activa.
     */
    public function hasActiveSession($current_session_id) {
        return !empty($this->session_id_activa) &&
               $this->session_id_activa !== $current_session_id;
    }

    /**
     * Guarda la sesión activa en la DB.
     */
    public function setActiveSession($session_id) {
        $query = "
            UPDATE {$this->table_usuarios}
            SET session_id_activa = :sid
            WHERE id_usuario = :id
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':sid', $session_id);
        $stmt->bindParam(':id', $this->id_usuario);
        $stmt->execute();

        $this->session_id_activa = $session_id;
    }

    /**
     * Limpia la sesión activa (logout real).
     */
    public function clearActiveSession() {
        $query = "
            UPDATE {$this->table_usuarios}
            SET session_id_activa = NULL
            WHERE id_usuario = :id
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id_usuario);

        if ($stmt->execute()) {
            $this->session_id_activa = null;
            return true;
        }

        return false;
    }

    /**
     * Guarda token de recuperación de contraseña.
     */
    public function saveResetToken($token) {
        $expira = date('Y-m-d H:i:s', time() + (10 * 60));

        $query = "
            UPDATE {$this->table_usuarios}
            SET reset_token = :token,
                token_expira = :expira
            WHERE id_usuario = :id
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':token', $token);
        $stmt->bindParam(':expira', $expira);
        $stmt->bindParam(':id', $this->id_usuario);

        return $stmt->execute();
    }

    /**
     * Actualiza la contraseña del usuario.
     */
    public function updatePassword($new_password) {

        $hash = hash('sha256', $new_password);

        $query = "
            UPDATE {$this->table_usuarios}
            SET contrasena = :hash,
                reset_token = NULL,
                token_expira = NULL,
                intentos_fallidos = 0
            WHERE id_usuario = :id
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':hash', $hash);
        $stmt->bindParam(':id', $this->id_usuario);

        return $stmt->execute();
    }
}
?>
