<?php
declare(strict_types=1);

// models/Sede.php

/**
 * Modelo Sede
 * Proporciona métodos para obtener información sobre sedes.
 */
class Sede
{
    /**
     * @var PDO Conexión a la base de datos inyectada
     */
    private $conn;

    /**
     * Nombre de la tabla (se mantiene privado y controlado)
     * @var string
     */
    private $table_name = 'sedes';

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    /**
     * Obtiene las sedes que tienen profesionales con una especialidad específica.
     *
     * @param int $especialidad_id ID de la especialidad.
     * @return array Lista de sedes (cada elemento es un array asociativo) — vacío si no hay resultados o en error.
     */
    public function getSedesPorEspecialidad(int $especialidad_id): array
    {
        // Protección adicional: asegurar entero positivo
        $especialidad_id = abs(intval($especialidad_id));

        // Consulta segura y legible (uso de backticks para nombres de tablas/columnas)
        $query = "
            SELECT DISTINCT
                `s`.`id_sede`,
                `s`.`nombre_sede`,
                `s`.`direccion`,
                `c`.`nombre_ciudad`
            FROM `{$this->table_name}` AS `s`
            INNER JOIN `profesionales_sedes` AS `ps` ON `s`.`id_sede` = `ps`.`id_sede`
            INNER JOIN `profesionales` AS `p` ON `ps`.`id_profesional` = `p`.`id_profesional`
            INNER JOIN `profesionales_especialidades` AS `pe` ON `p`.`id_profesional` = `pe`.`id_profesional`
            INNER JOIN `ciudades` AS `c` ON `s`.`id_ciudad` = `c`.`id_ciudad`
            WHERE `pe`.`id_especialidad` = :especialidad_id
            ORDER BY `s`.`nombre_sede` ASC
        ";

        try {
            $stmt = $this->conn->prepare($query);
            $stmt->bindValue(':especialidad_id', $especialidad_id, PDO::PARAM_INT);
            $stmt->execute();

            // Devolvemos todos los resultados como array asociativo
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return $result !== false ? $result : [];
        } catch (PDOException $e) {
            // Registrar el error para diagnóstico (no mostrar al usuario)
            error_log('Error getSedesPorEspecialidad: ' . $e->getMessage());
            return [];
        }
    }
}
