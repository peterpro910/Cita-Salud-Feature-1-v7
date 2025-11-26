<?php
// models/Especialidad.php

class Especialidad
{
    private PDO $conn;
    private string $table_name = "especialidades";

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    /**
     * Obtiene especialidades con profesionales activos
     * y el conteo de horarios disponibles.
     *
     * @return PDOStatement
     */
    public function getEspecialidadesDisponibles(): PDOStatement
    {
        $query = $this->buildEspecialidadesQuery();

        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        return $stmt;
    }

    /**
     * Construye la consulta SQL principal.
     *
     * @return string
     */
    private function buildEspecialidadesQuery(): string
    {
        return <<<SQL
            SELECT 
                e.id_especialidad, 
                e.nombre_especialidad,
                COUNT(hp.id_horario) AS horarios_disponibles
            FROM {$this->table_name} e
            INNER JOIN profesionales_especialidades pe 
                ON e.id_especialidad = pe.id_especialidad
            INNER JOIN profesionales p 
                ON pe.id_profesional = p.id_profesional
            LEFT JOIN horarios_profesionales hp 
                ON p.id_profesional = hp.id_profesional
                AND hp.disponible = 1
                AND hp.fecha >= CURDATE()
            WHERE p.id_estado = 1
            GROUP BY e.id_especialidad
            ORDER BY e.nombre_especialidad ASC
        SQL;
    }
}
?>
