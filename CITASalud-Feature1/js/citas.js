// /js/citas.js
document.addEventListener('DOMContentLoaded', () => {

    // -----------------------------------------------------------
    // 1. CONFIGURACIÓN Y GLOBALIZACIÓN
    // -----------------------------------------------------------

    const idPaciente = sessionStorage.getItem('id_paciente');
    if (!idPaciente) {
        alert('Por favor, inicie sesión primero.');
        window.location.href = './../html/login.html';
        return;
    }

    window.idPaciente = idPaciente;

    const citasContainer = document.getElementById('citas-container');
    const mensajeDiv = document.getElementById('mensaje');
    const modal = document.getElementById('modal-detalle-cita');
    const modalContent = document.getElementById('modal-info-body');
    const btnCerrarModal = document.querySelector('#modal-detalle-cita .close-modal-btn');

    const modalMensaje = document.getElementById('modal-mensaje');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalTexto = document.getElementById('modal-texto');
    const btnCerrarMensaje = document.getElementById('modal-cerrar-btn');

    function mostrarMensaje(texto, tipo) {
        if (mensajeDiv) {
            mensajeDiv.textContent = texto;
            mensajeDiv.className = `mensaje ${tipo}`;
            mensajeDiv.setAttribute('aria-live', 'polite');
        }
    }

    window.mostrarModalMensaje = function (titulo, texto, type = 'info', callback = null) {
        if (modalMensaje && modalTitulo && modalTexto && btnCerrarMensaje) {
            modalTitulo.innerHTML = titulo;
            modalTexto.innerHTML = texto;
            modalMensaje.className = `modal modal-${type}`;
            modalMensaje.style.display = 'flex';

            const closeHandler = () => {
                modalMensaje.style.display = 'none';
                btnCerrarMensaje.removeEventListener('click', closeHandler);
                if (callback) callback();
            };

            btnCerrarMensaje.addEventListener('click', closeHandler);
        } else {
            alert(`${titulo}\n${texto}`);
            if (callback) callback();
        }
    };

    window.cargarCitas = cargarCitas;

    const ESTADOS = {
        AGENDADA: 1,
        MODIFICADA: 2,
        CANCELADA: 3,
        ASISTIDA: 4,
        SIN_ASISTENCIA: 5
    };

    function getEstadoClass(idEstado) {
        const estadoMap = {
            [ESTADOS.AGENDADA]: 'estado-agendada',
            [ESTADOS.MODIFICADA]: 'estado-modificada',
            [ESTADOS.CANCELADA]: 'estado-cancelada',
            [ESTADOS.ASISTIDA]: 'estado-asistida',
            [ESTADOS.SIN_ASISTENCIA]: 'estado-sin-asistencia'
        };
        return estadoMap[parseInt(idEstado)] || 'estado-pasada';
    }

    function getTiempoRestante(fechaHora) {
        const ahora = new Date();
        const cita = new Date(fechaHora);
        const diff = cita.getTime() - ahora.getTime();
        if (diff < 0) return null;

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${d}d ${h}h ${m}m`;
    }

    window.formatDateTime = function (dateStr, timeStr, locale = 'es-CO') {
        if (!dateStr || !timeStr) return { fecha: '', hora: '', fechaHora: '' };
        const dateObj = new Date(`${dateStr}T${timeStr}`);
        return {
            fecha: dateObj.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
            hora: dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true }),
            fechaHora: `${dateStr} ${timeStr}`
        };
    };


    // ===========================================================
    //              HU-20 — Filtro por Especialidad
    // ===========================================================

    const selectEspecialidad = document.getElementById('filtro-especialidad');
    const btnLimpiarEspecialidad = document.getElementById('btn-limpiar-filtro-especialidad');
    const KEY_FILTRO_ESP = 'filtroEspecialidadGuardado';

    let mapaEspecialidades = {};

    async function cargarEspecialidades() {
        if (!selectEspecialidad) return;

        try {
            const response = await fetch(`./../api/get_especialidades_paciente.php?id_paciente=${idPaciente}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Error al obtener especialidades.');

            selectEspecialidad.innerHTML = '<option value="todas">Todas las especialidades</option>';
            mapaEspecialidades = {};

            if (data.especialidades?.length > 0) {
                data.especialidades.sort((a, b) =>
                    a.nombre_especialidad.localeCompare(b.nombre_especialidad)
                );

                data.especialidades.forEach(esp => {
                    const option = new Option(
                        `${esp.nombre_especialidad} (${esp.total_citas})`,
                        esp.id_especialidad
                    );
                    selectEspecialidad.appendChild(option);

                    mapaEspecialidades[esp.id_especialidad] = esp.nombre_especialidad;
                });
            }

            selectEspecialidad.value = localStorage.getItem(KEY_FILTRO_ESP) || 'todas';

        } catch (error) {
            console.error(error);
            selectEspecialidad.innerHTML = '<option value="todas">Error al cargar</option>';
        }
    }


    // ===========================================================
    //              HU-17 — Filtro por Estado
    // ===========================================================

    const filtroSelect = document.getElementById('filtro-estado');
    const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');
    const mensajeListaVacia = document.getElementById('mensaje-lista-vacia');

    let todasLasCitas = [];
    const KEY_FILTRO_ESTADO = 'filtroEstadoGuardado';

    const MAPA_ESTADOS = {
        1: 'Agendada',
        2: 'Modificada',
        3: 'Cancelada',
        4: 'Asistida',
        5: 'Sin Asistencia'
    };

    const ESTADOS_ORDENADOS_IDS = [1, 4, 3, 2, 5];

    function calcularContadores(citas) {
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        citas.forEach(c => counts[c.id_estado]++);
        return counts;
    }

    function popularDropdownFiltro(counts) {
        filtroSelect.innerHTML = '';
        filtroSelect.appendChild(new Option(`Todas las citas (${todasLasCitas.length})`, 'todas'));

        ESTADOS_ORDENADOS_IDS.forEach(id => {
            filtroSelect.appendChild(new Option(`${MAPA_ESTADOS[id]} (${counts[id]})`, id));
        });
    }

    function mostrarMensajeVacio(filtroEstado, filtroEspecialidad) {
        let texto = 'No tiene citas registradas.';

        if (filtroEstado !== 'todas' || filtroEspecialidad !== 'todas') {
            const est = MAPA_ESTADOS[filtroEstado] || '';
            const esp = mapaEspecialidades[filtroEspecialidad] || '';

            if (filtroEstado !== 'todas' && filtroEspecialidad !== 'todas') texto = `No tiene citas ${est} en ${esp}.`;
            else if (filtroEstado !== 'todas') texto = `No tiene citas ${est}.`;
            else texto = `No tiene citas en ${esp}.`;
        }

        mensajeListaVacia.textContent = texto;
        mensajeListaVacia.style.display = 'block';
    }


    // ===========================================================
    //                  CREACIÓN DE LAS CARDS
    // ===========================================================

    function crearCardCita(cita) {

        const {
            id_cita, fecha, hora, nombre_estado, nombre_especialidad, id_estado,
            nombre_profesional, apellido_profesional, nombre_sede, id_horario_original,
            id_horario, id_especialidad, id_sede, id_profesional
        } = cita;

        const { fecha: fechaTexto, hora: horaTexto, fechaHora } = window.formatDateTime(fecha, hora);

        const card = document.createElement('div');
        card.className = `cita-card ${getEstadoClass(id_estado)}`;
        card.tabIndex = 0;

        const restante = (id_estado === 1 || id_estado === 2) ? getTiempoRestante(fechaHora) : null;

        card.innerHTML = `
            <h3>${nombre_especialidad || 'Especialidad no definida'}</h3>
            <p>Fecha: <strong>${fechaTexto}</strong></p>
            <p>Hora: <strong>${horaTexto}</strong></p>
            <p>Estado: <span class="estado-label ${getEstadoClass(id_estado)}">${nombre_estado}</span></p>

            ${restante ? `<p class="contador">Restante: <strong>${restante}</strong></p>` : ''}

            <div class="card-actions">
                <button class="btn-accion btn-ver-mas">Ver más</button>

                <button class="btn-accion btn-modificar"
                    data-id-cita="${id_cita}"
                    data-id-horario-original="${id_horario || id_horario_original}"
                    data-id-especialidad="${id_especialidad}"
                    data-especialidad-nombre="${nombre_especialidad}"
                    data-fecha="${fecha}"
                    data-hora="${hora}"
                    data-id-sede="${id_sede}"
                    data-sede-nombre="${nombre_sede}"
                    data-id-profesional="${id_profesional}"
                    data-profesional-nombre="${nombre_profesional} ${apellido_profesional}"
                    ${id_estado !== 1 ? 'disabled' : ''}>
                    Modificar
                </button>

                <button class="btn-accion btn-cancelar"
                    data-cita-id="${id_cita}"
                    data-especialidad="${nombre_especialidad}"
                    data-fecha="${fecha}"
                    data-hora="${hora}"
                    data-profesional="${nombre_profesional} ${apellido_profesional}"
                    data-sede="${nombre_sede}"
                    ${(id_estado !== 1 && id_estado !== 2) ? 'disabled' : ''}>
                    Cancelar
                </button>
            </div>
        `;

        // VER MÁS
        card.querySelector('.btn-ver-mas').addEventListener('click', () => {
            mostrarDetallesCita(cita);
        });

        // MODIFICAR
        const btnModificar = card.querySelector('.btn-modificar');
        if (!btnModificar.disabled) {
            btnModificar.addEventListener('click', (e) => {
                const d = e.currentTarget.dataset;
                if (window.inicializarModificacion) {
                    window.inicializarModificacion(
                        d.idCita, d.idHorarioOriginal, d.idEspecialidad,
                        d.especialidadNombre, d.fecha, d.hora, d.idSede,
                        d.sedeNombre, d.idProfesional, d.profesionalNombre
                    );
                }
            });
        }

        // CANCELAR
        const btnCancelar = card.querySelector('.btn-cancelar');
        if (!btnCancelar.disabled) {
            btnCancelar.addEventListener('click', e => {
                if (window.iniciarProcesoCancelacion) {
                    window.iniciarProcesoCancelacion(e);
                }
            });
        }

        return card;
    }


    // ===========================================================
    //              RENDERIZADO DE CITAS
    // ===========================================================

    function renderizarCitas() {
        citasContainer.innerHTML = '';

        const filtroEstado = filtroSelect.value;
        const filtroEspecialidad = selectEspecialidad.value;

        const filtradas = todasLasCitas.filter(c => {
            const estadoOK = filtroEstado === 'todas' || c.id_estado === parseInt(filtroEstado);
            const espOK = filtroEspecialidad === 'todas' || c.id_especialidad === parseInt(filtroEspecialidad);
            return estadoOK && espOK;
        });

        if (filtradas.length === 0) {
            mostrarMensajeVacio(filtroEstado, filtroEspecialidad);
            return;
        }

        mensajeListaVacia.style.display = 'none';

        filtradas.forEach(c => citasContainer.appendChild(crearCardCita(c)));
    }


    // ===========================================================
    //                CARGA DE CITAS (API)
    // ===========================================================

    async function cargarCitas() {

        await cargarEspecialidades();
        mostrarMensaje('Cargando tus citas...', 'info');

        try {
            const response = await fetch(`./../api/get_citas_paciente.php?id_paciente=${idPaciente}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Error cargando citas.');

            if (!Array.isArray(data) || data.length === 0) {
                todasLasCitas = [];
                popularDropdownFiltro(calcularContadores([]));
                renderizarCitas();
                mostrarMensaje('', '');
                return;
            }

            data.sort((a, b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));

            todasLasCitas = data;

            const counts = calcularContadores(todasLasCitas);
            popularDropdownFiltro(counts);

            filtroSelect.value = localStorage.getItem(KEY_FILTRO_ESTADO) || 'todas';

            renderizarCitas();
            mostrarMensaje('', '');

            if (window.citaIntervalFiltro) clearInterval(window.citaIntervalFiltro);
            window.citaIntervalFiltro = setInterval(cargarCitas, 60000);

        } catch (err) {
            console.error(err);
            mostrarMensaje('Error al cargar las citas. Intente de nuevo.', 'error');
            citasContainer.innerHTML = '';
            mensajeListaVacia.textContent = 'Error al cargar las citas.';
            mensajeListaVacia.style.display = 'block';
        }
    }


    // ===========================================================
    //        MODAL — VER DETALLES DE UNA CITA
    // ===========================================================

    function mostrarDetallesCita(cita) {

        const {
            fecha, hora, nombre_especialidad, nombre_profesional,
            apellido_profesional, nombre_sede, direccion_sede,
            nombre_ciudad, nombre_estado, id_estado
        } = cita;

        const { fecha: fText, hora: hText } = window.formatDateTime(fecha, hora);

        const profesional = (nombre_profesional && apellido_profesional)
            ? `${nombre_profesional} ${apellido_profesional}`
            : 'No asignado';

        const direccion = direccion_sede && nombre_ciudad
            ? `${direccion_sede}, ${nombre_ciudad}`
            : 'Dirección no disponible';

        const extra = [];

        if (id_estado === 3 && cita.fecha_cancelacion) {
            const f = window.formatDateTime(cita.fecha_cancelacion, cita.hora_cancelacion);
            extra.push(`
                <hr>
                <h4>Detalles de Cancelación</h4>
                <p><strong>Motivo:</strong> ${cita.motivo_cancelacion || 'No especificado'}</p>
                <p><strong>Fecha/Hora:</strong> ${f.fecha} - ${f.hora}</p>
            `);
        }

        if (id_estado === 2 && cita.fecha_original) {
            const f = window.formatDateTime(cita.fecha_original, cita.hora_original);
            extra.push(`
                <hr>
                <h4>Detalles de Modificación</h4>
                <p><strong>Fecha/Hora Original:</strong> ${f.fecha} - ${f.hora}</p>
            `);
        }

        modalContent.innerHTML = `
            <h2>Detalles de Cita</h2>
            <p><strong>Especialidad:</strong> ${nombre_especialidad}</p>
            <p><strong>Estado:</strong> <span class="estado-label ${getEstadoClass(id_estado)}">${nombre_estado}</span></p>
            <hr>
            <p><strong>Fecha:</strong> ${fText}</p>
            <p><strong>Hora:</strong> ${hText}</p>
            <p><strong>Profesional:</strong> ${profesional}</p>
            <p><strong>Sede:</strong> ${nombre_sede}</p>
            <p><strong>Dirección:</strong> ${direccion}</p>
            ${extra.join('')}
        `;

        modal.style.display = 'flex';
    }

    const closeModal = () => modal.style.display = 'none';

    btnCerrarModal?.addEventListener('click', closeModal);

    window.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });


    // ===========================================================
    //               LISTENERS DE FILTROS
    // ===========================================================

    filtroSelect?.addEventListener('change', e => {
        localStorage.setItem(KEY_FILTRO_ESTADO, e.target.value);
        renderizarCitas();
    });

    btnLimpiarFiltro?.addEventListener('click', () => {
        filtroSelect.value = 'todas';
        localStorage.removeItem(KEY_FILTRO_ESTADO);
        renderizarCitas();
    });

    selectEspecialidad?.addEventListener('change', e => {
        localStorage.setItem(KEY_FILTRO_ESP, e.target.value);
        renderizarCitas();
    });

    btnLimpiarEspecialidad?.addEventListener('click', () => {
        selectEspecialidad.value = 'todas';
        localStorage.removeItem(KEY_FILTRO_ESP);
        renderizarCitas();
    });


    // ===========================================================
    //                    INICIAR TODO
    // ===========================================================

    cargarCitas();
});
