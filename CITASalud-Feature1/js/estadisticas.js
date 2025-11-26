// /js/estadisticas.js (Completo y Optimizado)

document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------
    // 1. Validar sesión activa
    // -------------------------------
    const idPaciente = sessionStorage.getItem('id_paciente');

    if (!idPaciente) {
        alert('Por favor, inicie sesión primero.');
        window.location.href = './../html/login.html';
        return;
    }

    // Base de la API
    const API_BASE_URL = `./../api/get_estadisticas_asistencia.php?id_paciente=${idPaciente}`;

    // Paleta de colores unificada
    const COLORES = {
        ASISTIDA: '#007bff',
        NO_ASISTIDA: '#6c757d',
        TEXTO: '#343a40'
    };

    // -------------------------------
    // 2. Función principal
    // -------------------------------
    async function obtenerDatosYDibujar() {

        const filtroMes = document.getElementById('filtroMes');
        const mesSeleccionado = filtroMes ? filtroMes.value : '0';

        let apiURL = API_BASE_URL;
        if (mesSeleccionado !== '0') apiURL += `&mes=${mesSeleccionado}`;

        try {
            const response = await fetch(apiURL);
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

            const data = await response.json();

            // Actualizar Resumen
            document.getElementById('totalAsistidas').innerText = data.resumen.total_asistidas;
            document.getElementById('totalNoAsistidas').innerText = data.resumen.total_no_asistidas;
            document.getElementById('porcentajeCumplimiento').innerText = data.resumen.porcentaje_cumplimiento + '%';

            // Dibujar gráficos
            dibujarGraficoCircular(data.graficos.datos_totales);
            dibujarGraficoBarras(data.graficos.datos_totales);
            dibujarGraficoLineas(data.graficos.historial_mensual);

        } catch (error) {
            console.error('Error API:', error);
            document.getElementById('totalAsistidas').innerText = 'Error';
            document.getElementById('totalNoAsistidas').innerText = 'Error';
            document.getElementById('porcentajeCumplimiento').innerText = 'N/A';
        }
    }

    // -------------------------------
    // 3. Gráfico Circular
    // -------------------------------
    function dibujarGraficoCircular(datos) {
        const ctx = document.getElementById('graficoCircular').getContext('2d');

        const asistidas = datos.find(d => d.etiqueta === 'Asistidas').valor;
        const noAsistidas = datos.find(d => d.etiqueta === 'No Asistidas').valor;

        const total = asistidas + noAsistidas;
        const pAsist = total ? ((asistidas / total) * 100).toFixed(0) : 0;
        const pNoAsist = total ? ((noAsistidas / total) * 100).toFixed(0) : 0;

        // Eliminar gráfico previo
        const existing = Chart.getChart("graficoCircular");
        if (existing) existing.destroy();

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [
                    `Asistidas (${pAsist}%)`,
                    `No Asistidas (${pNoAsist}%)`
                ],
                datasets: [{
                    data: [asistidas, noAsistidas],
                    backgroundColor: [COLORES.ASISTIDA, COLORES.NO_ASISTIDA],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: COLORES.TEXTO }
                    }
                }
            }
        });
    }

    // -------------------------------
    // 4. Gráfico de Barras
    // -------------------------------
    function dibujarGraficoBarras(datos) {
        const ctx = document.getElementById('graficoBarras').getContext('2d');

        const asistidas = datos.find(d => d.etiqueta === 'Asistidas').valor;
        const noAsistidas = datos.find(d => d.etiqueta === 'No Asistidas').valor;

        const existing = Chart.getChart("graficoBarras");
        if (existing) existing.destroy();

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Asistidas', 'No Asistidas'],
                datasets: [{
                    data: [asistidas, noAsistidas],
                    backgroundColor: [COLORES.ASISTIDA, COLORES.NO_ASISTIDA],
                    borderColor: [COLORES.ASISTIDA, COLORES.NO_ASISTIDA],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: COLORES.TEXTO } },
                    x: { ticks: { color: COLORES.TEXTO } }
                }
            }
        });
    }

    // -------------------------------
    // 5. Gráfico de Líneas
    // -------------------------------
    function dibujarGraficoLineas(historial) {
        const ctx = document.getElementById('graficoLineas').getContext('2d');

        const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago",
                       "Sep", "Oct", "Nov", "Dic"];

        const labels = historial.map(item => {
            const [anio, mes] = item.mes_anio.split('-');
            return `${meses[parseInt(mes) - 1]}-${anio.slice(-2)}`;
        });

        const asistidas = historial.map(h => parseInt(h.asistidas));
        const noAsistidas = historial.map(h => parseInt(h.no_asistidas));

        const existing = Chart.getChart("graficoLineas");
        if (existing) existing.destroy();

        new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Asistidas',
                        data: asistidas,
                        borderColor: COLORES.ASISTIDA,
                        backgroundColor: 'rgba(0, 123, 255, 0.2)',
                        pointBackgroundColor: COLORES.ASISTIDA,
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3
                    },
                    {
                        label: 'No Asistidas',
                        data: noAsistidas,
                        borderColor: COLORES.NO_ASISTIDA,
                        backgroundColor: 'rgba(108, 117, 125, 0.2)',
                        pointBackgroundColor: COLORES.NO_ASISTIDA,
                        fill: true,
                        tension: 0.3,
                        borderWidth: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: false },
                    legend: { labels: { color: COLORES.TEXTO } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: COLORES.TEXTO } },
                    x: { ticks: { color: COLORES.TEXTO } }
                }
            }
        });
    }

    // -------------------------------
    // 6. Inicializar
    // -------------------------------
    obtenerDatosYDibujar();

    const filtroMes = document.getElementById('filtroMes');
    if (filtroMes) filtroMes.addEventListener('change', obtenerDatosYDibujar);

});
