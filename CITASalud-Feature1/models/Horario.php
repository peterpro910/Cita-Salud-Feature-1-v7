<?php
class Horario {
    private $conn;
    private $table_name = "horarios_profesionales";

    public function __construct($db) {
        $this->conn = $db;
    }

    /**
     * Obtiene los horarios disponibles para un profesional,
     * excluyendo los horarios donde el paciente ya tiene cita
     * en la MISMA FECHA Y MISMA HORA (bug corregido).
     */
    public function getHorariosDisponiblesPorProfesional($profesional_id, $paciente_id) {
        $query = "
            SELECT 
                hp.id_horario,
                hp.fecha,
                hp.hora
            FROM {$this->table_name} hp
            WHERE 
                hp.id_profesional = :profesional_id
                AND hp.disponible = 1
                -- No mostrar horarios pasados
                AND TIMESTAMP(hp.fecha, hp.hora) >= NOW()
                -- Rango de agenda permitido (60 días)
                AND hp.fecha BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                -- Evitar horas ya tomadas por el paciente (FECHA + HORA exacta)
                AND NOT EXISTS (
                    SELECT 1
                    FROM citas c
                    JOIN horarios_profesionales hp2 ON hp2.id_horario = c.id_horario
                    WHERE c.id_paciente = :paciente_id
                    AND hp2.fecha = hp.fecha
                    AND hp2.hora = hp.hora
                )
            ORDER BY hp.fecha ASC, hp.hora ASC
        ";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':profesional_id', $profesional_id, PDO::PARAM_INT);
        $stmt->bindParam(':paciente_id', $paciente_id, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt;
    }
}
?>
