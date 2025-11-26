<?php
declare(strict_types=1);

class Profesional
{
    /**
     * @var PDO
     */
    private $conn;

    /**
     * @var string
     */
    private $table_name = 'profesionales';

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    /**
     * Obtiene profesionales filtrados por especialidad y sede.
     *
     * Retorna solo profesionales con estado activo (id_estado = 1),
     * que no estén en ausencia actualmente, y con conteo de horarios futuros.
     *
     * @param int $especialidad_id
     * @param int $sede_id
     * @return array Lista de profesionales en arrays asociativos.
     */
    public function getProfesionalesPorEspecialidadYSede(
        int $especialidad_id,
        int $sede_id
    ): array 
    {
        // Normalización de valores
        $especialidad_id = abs(intval($especialidad_id));
        $sede_id = abs(intval($sede_id));

        $query = "
            SELECT 
                p.id_profesional, 
                p.nombre, 
                p.apellido, 
                p.titulo_profesional, 
                p.anos_experiencia,
                COUNT(hp.id_horario) AS horarios_disponibles
            FROM `{$this->table_name}` AS p
            INNER JOIN `profesionales_especialidades` AS pe 
                ON p.id_profesional = pe.id_profesional
            INNER JOIN `profesionales_sedes` AS ps 
                ON p.id_profesional = ps.id_profesional
            LEFT JOIN `horarios_profesionales` AS hp 
                ON p.id_profesional = hp.id_profesional
                AND hp.disponible = 1
                AND hp.fecha BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            WHERE 
                p.id_estado = 1
                AND pe.id_especialidad = :especialidad_id
                AND ps.id_sede = :sede_id
                AND NOT EXISTS (
                    SELECT 1
                    FROM `ausencias_profesionales` AS ap
                    WHERE ap.id_profesional = p.id_profesional
                    AND CURDATE() BETWEEN ap.fecha_inicio AND ap.fecha_fin
                )
            GROUP BY 
                p.id_profesional
            ORDER BY 
                p.nombre ASC, 
                p.apellido ASC
        ";

        try {
            $stmt = $this->conn->prepare($query);
            $stmt->bindValue(':especialidad_id', $especialidad_id, PDO::PARAM_INT);
            $stmt->bindValue(':sede_id', $sede_id, PDO::PARAM_INT);
            $stmt->execute();

            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return $result !== false ? $result : [];

        } catch (PDOException $e) {
            error_log('Error getProfesionalesPorEspecialidadYSede: ' . $e->getMessage());
            return [];
        }
    }
}
