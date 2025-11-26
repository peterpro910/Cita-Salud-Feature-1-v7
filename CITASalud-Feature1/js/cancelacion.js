// /js/cancelacion.js
// Versión corregida y preparada para quality gate / SonarQube

(function () {
    'use strict';

    // -----------------------------
    // Utilidades
    // -----------------------------
    /**
     * Escapa texto para insertar en el DOM evitando inyección HTML básica.
     * @param {string} str
     * @returns {string}
     */
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Safe text setter: si el elemento existe, usa textContent (no innerHTML).
     * Si se requiere HTML controlado (p. ej. <br>), usar setHtmlSafe().
     * @param {HTMLElement|null} el
     * @param {string} text
     */
    function setText(el, text) {
        if (!(el instanceof HTMLElement)) return;
        el.textContent = text ?? '';
    }

    /**
     * Inserta pequeño HTML controlado (solo etiquetas <strong> y <br> permitidas).
     * Escapa el resto.
     * @param {HTMLElement|null} el
     * @param {string} rawText
     */
    function setHtmlSafe(el, rawText) {
        if (!(el instanceof HTMLElement)) return;
        // reemplazar saltos de línea por <br> y escapar el resto
        const escaped = escapeHTML(rawText).replace(/\n/g, '<br>');
        el.innerHTML = escaped;
    }

    /**
     * Ejecuta fetch y retorna json (o lanza error con mensaje).
     * @param {string} url
     * @param {object} [opts]
     */
    async function fetchJson(url, opts = {}) {
        const res = await fetch(url, opts);
        const contentType = res.headers.get('content-type') || '';
        let body = null;
        if (contentType.includes('application/json')) {
            body = await res.json();
        } else {
            // Intentamos texto por si el servidor devolvió mensaje legible
            body = { message: await res.text() };
        }
        if (!res.ok) {
            const errMsg = (body && body.message) ? body.message : `HTTP ${res.status}`;
            const error = new Error(errMsg);
            error.status = res.status;
            error.body = body;
            throw error;
        }
        return body;
    }

    // -----------------------------
    // Elementos DOM (cache)
    // -----------------------------
    const modalMensaje = document.getElementById('modal-mensaje');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalTexto = document.getElementById('modal-texto');
    const btnCerrarMensaje = document.getElementById('modal-cerrar-btn');

    const motivoSelect = document.getElementById('motivo-select');
    const btnContinuarCancelacion = document.getElementById('btn-continuar-cancelacion');
    const modalCancelacion = document.getElementById('modal-cancelacion');

    const modalResumen = document.getElementById('modal-resumen-cancelacion');
    const resumenEspecialidad = document.getElementById('resumen-especialidad');
    const resumenFecha = document.getElementById('resumen-fecha');
    const resumenHora = document.getElementById('resumen-hora');
    const resumenProfesional = document.getElementById('resumen-profesional');
    const resumenSede = document.getElementById('resumen-sede');
    const resumenMotivo = document.getElementById('resumen-motivo-seleccionado');
    const resumenCancelacionesMes = document.getElementById('resumen-cancelaciones-mes');

    const btnConfirmarCancelacion = document.getElementById('btn-confirmar-cancelacion');
    const btnModificarMotivo = document.getElementById('btn-modificar-motivo');
    const btnCerrarCancelacion = document.getElementById('btn-cerrar-cancelacion');
    const formMotivo = document.getElementById('form-motivo-cancelacion');
    const btnCerrarResumen = document.getElementById('btn-cerrar-resumen-cancelacion');

    // -----------------------------
    // Estado interno
    // -----------------------------
    let citaDataTemporal = null;

    // -----------------------------
    // Dependencias externas (seguras)
    // -----------------------------
    const idPaciente = sessionStorage.getItem('id_paciente') || null;
    const cargarCitas = (typeof window.cargarCitas === 'function') ? window.cargarCitas : null;

    // -----------------------------
    // Mensajes/Modal de aviso
    // -----------------------------
    /**
     * Muestra modal genérico de mensaje.
     * Usa texto escapado; si se quiere HTML controlado, usar setHtmlSafe.
     * @param {string} titulo
     * @param {string} texto
     */
    function mostrarModalMensaje(titulo, texto) {
        if (!(modalMensaje instanceof HTMLElement) || !(modalTitulo instanceof HTMLElement) || !(modalTexto instanceof HTMLElement)) {
            // fallback simple con alert
            // eslint-disable-next-line no-alert
            alert(`${titulo}\n\n${texto}`);
            return;
        }
        setText(modalTitulo, titulo);
        setHtmlSafe(modalTexto, texto);
        modalMensaje.style.display = 'flex';
        modalMensaje.setAttribute('aria-hidden', 'false');
    }

    // -----------------------------
    // Lógica: cargar motivos
    // -----------------------------
    async function cargarMotivos() {
        if (!(motivoSelect instanceof HTMLSelectElement)) return;
        motivoSelect.innerHTML = '<option value="" disabled selected hidden>Seleccione un motivo</option>';
        motivoSelect.disabled = true;

        try {
            const data = await fetchJson('../api/get_motivos_cancelacion.php');
            if (!Array.isArray(data) || data.length === 0) {
                motivoSelect.innerHTML = '<option value="" disabled>No hay motivos disponibles</option>';
                motivoSelect.disabled = true;
                return;
            }
            motivoSelect.innerHTML = '<option value="" disabled selected hidden>Seleccione un motivo</option>';
            data.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = String(m.id);
                opt.textContent = String(m.nombre || m.label || m.nombre_motivo || '');
                motivoSelect.appendChild(opt);
            });
            motivoSelect.disabled = false;
        } catch (err) {
            motivoSelect.innerHTML = '<option value="" disabled>Error al cargar motivos</option>';
            motivoSelect.disabled = true;
            mostrarModalMensaje('Error de Conexión', 'No fue posible cargar los motivos de cancelación.');
        }
    }

    // -----------------------------
    // Iniciar proceso de cancelación (expuesto globalmente)
    // -----------------------------
    /**
     * Inicia proceso de cancelación (se invoca desde botón en cada card).
     * @param {Event} e
     */
    window.iniciarProcesoCancelacion = function (e) {
        const target = e && e.target ? e.target : null;
        if (!target) {
            mostrarModalMensaje('Error', 'Evento inválido al iniciar cancelación.');
            return;
        }

        if (!idPaciente) {
            mostrarModalMensaje('Error de Sesión', 'No se pudo identificar al paciente. Por favor inicie sesión nuevamente.');
            return;
        }

        const idCita = target.getAttribute('data-cita-id');
        if (!idCita) {
            mostrarModalMensaje('Error Interno', 'Faltan datos de la cita para iniciar la cancelación.');
            return;
        }

        // Recoger datos del dataset con sanitización mínima
        const especialidad = target.getAttribute('data-especialidad') || '';
        const fecha = target.getAttribute('data-fecha') || '';
        const hora = target.getAttribute('data-hora') || '';
        const profesional = target.getAttribute('data-profesional') || '';
        const sede = target.getAttribute('data-sede') || '';

        citaDataTemporal = {
            id: String(idCita),
            especialidad: especialidad,
            fecha: fecha,
            hora: hora,
            profesional: profesional,
            sede: sede,
            motivo_id: null,
            motivo_nombre: null
        };

        // Validación de 24 horas
        if (!citaDataTemporal.fecha || !citaDataTemporal.hora) {
            mostrarModalMensaje('Datos incompletos', 'No se pudo determinar la fecha/hora de la cita.');
            return;
        }

        const fechaCita = new Date(`${citaDataTemporal.fecha}T${citaDataTemporal.hora}`);
        const ahora = new Date();
        const diffHoras = (fechaCita.getTime() - ahora.getTime()) / (1000 * 60 * 60);

        if (Number.isFinite(diffHoras) === false || isNaN(diffHoras)) {
            mostrarModalMensaje('Error Interno', 'Formato de fecha/hora inválido.');
            return;
        }

        if (diffHoras < 24) {
            mostrarModalMensaje('Cancelación Rechazada', 'No es posible cancelar la cita con menos de 24 horas de anticipación.');
            return;
        }

        // Preparar modal de motivo
        if (motivoSelect instanceof HTMLSelectElement) {
            motivoSelect.value = '';
            btnContinuarCancelacion.disabled = true;
        }
        if (modalCancelacion instanceof HTMLElement) {
            modalCancelacion.style.display = 'flex';
            modalCancelacion.setAttribute('aria-hidden', 'false');
        }
    };

    // -----------------------------
    // Listeners: motivo select -> habilita continuar
    // -----------------------------
    if (motivoSelect instanceof HTMLSelectElement && btnContinuarCancelacion instanceof HTMLElement) {
        motivoSelect.addEventListener('change', (ev) => {
            const val = ev && ev.target ? ev.target.value : '';
            btnContinuarCancelacion.disabled = !val;
        });
    }

    // -----------------------------
    // Form: envío del motivo -> mostrar resumen y verificar límites
    // -----------------------------
    if (formMotivo instanceof HTMLFormElement) {
        formMotivo.addEventListener('submit', async (ev) => {
            ev.preventDefault();

            if (!citaDataTemporal) {
                mostrarModalMensaje('Error', 'No hay una cita seleccionada para cancelar.');
                return;
            }

            // Guardar motivo
            if (motivoSelect instanceof HTMLSelectElement) {
                citaDataTemporal.motivo_id = motivoSelect.value || null;
                citaDataTemporal.motivo_nombre = (motivoSelect.selectedOptions[0] && motivoSelect.selectedOptions[0].text) || '';
            }

            // Ocultar modal motivo
            if (modalCancelacion instanceof HTMLElement) {
                modalCancelacion.style.display = 'none';
                modalCancelacion.setAttribute('aria-hidden', 'true');
            }

            // Poblar resumen (usar textContent para seguridad)
            setText(resumenEspecialidad, citaDataTemporal.especialidad || 'N/A');
            setText(resumenFecha, citaDataTemporal.fecha || 'N/A');
            setText(resumenHora, citaDataTemporal.hora || 'N/A');
            setText(resumenProfesional, citaDataTemporal.profesional || 'N/A');
            setText(resumenSede, citaDataTemporal.sede || 'N/A');
            setText(resumenMotivo, citaDataTemporal.motivo_nombre || 'N/A');

            // Mostrar resumen
            if (modalResumen instanceof HTMLElement) {
                modalResumen.style.display = 'flex';
                modalResumen.setAttribute('aria-hidden', 'false');
            }

            // Consultar límite mensual (API)
            if (!idPaciente) {
                setText(resumenCancelacionesMes, 'Error: sesión inválida.');
                if (btnConfirmarCancelacion instanceof HTMLElement) btnConfirmarCancelacion.disabled = true;
                return;
            }

            try {
                const url = `../api/count_cancelaciones.php?id_paciente=${encodeURIComponent(idPaciente)}`;
                const data = await fetchJson(url);

                // Asumir estructura { totales: number, limite: number, restantes: number } — adaptarse si es distinto
                const limite = (typeof data.limite === 'number') ? data.limite : 3;
                const totales = (typeof data.totales === 'number') ? data.totales : (typeof data.total_cancelaciones === 'number' ? data.total_cancelaciones : 0);
                const restantes = (typeof data.restantes === 'number') ? data.restantes : Math.max(0, limite - totales);

                if (restantes > 0) {
                    setHtmlSafe(resumenCancelacionesMes, `Te quedan ${restantes} cancelaciones disponibles este mes (Límite: ${limite}).`);
                    if (btnConfirmarCancelacion instanceof HTMLElement) btnConfirmarCancelacion.disabled = false;
                } else {
                    setHtmlSafe(resumenCancelacionesMes, `<strong style="color:red">¡ADVERTENCIA!</strong> Ha alcanzado el límite de ${limite} cancelaciones mensuales. NO PUEDE CANCELAR MÁS.`);
                    if (btnConfirmarCancelacion instanceof HTMLElement) btnConfirmarCancelacion.disabled = true;
                }
            } catch (err) {
                setText(resumenCancelacionesMes, 'No se pudo verificar el límite de cancelaciones (error de conexión).');
                if (btnConfirmarCancelacion instanceof HTMLElement) btnConfirmarCancelacion.disabled = true;
            }
        });
    }

    // -----------------------------
    // Botón: modificar motivo (volver al modal motivo)
    // -----------------------------
    if (btnModificarMotivo instanceof HTMLElement) {
        btnModificarMotivo.addEventListener('click', () => {
            if (modalResumen instanceof HTMLElement) {
                modalResumen.style.display = 'none';
                modalResumen.setAttribute('aria-hidden', 'true');
            }
            if (modalCancelacion instanceof HTMLElement) {
                modalCancelacion.style.display = 'flex';
                modalCancelacion.setAttribute('aria-hidden', 'false');
            }
        });
    }

    // -----------------------------
    // Botón: cerrar modal motivo
    // -----------------------------
    if (btnCerrarCancelacion instanceof HTMLElement) {
        btnCerrarCancelacion.addEventListener('click', () => {
            if (modalCancelacion instanceof HTMLElement) {
                modalCancelacion.style.display = 'none';
                modalCancelacion.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // -----------------------------
    // Confirmar cancelación (acción final)
    // -----------------------------
    if (btnConfirmarCancelacion instanceof HTMLElement) {
        btnConfirmarCancelacion.addEventListener('click', async () => {
            if (!citaDataTemporal || !citaDataTemporal.id) {
                mostrarModalMensaje('Error', 'No existe una cita válida para cancelar.');
                return;
            }

            btnConfirmarCancelacion.disabled = true;

            const payload = {
                id_cita: String(citaDataTemporal.id),
                id_paciente: String(idPaciente || ''),
                id_motivo_cancelacion: String(citaDataTemporal.motivo_id || '')
            };

            try {
                const result = await fetchJson('../api/cancelar_cita.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Cerrar resumen
                if (modalResumen instanceof HTMLElement) {
                    modalResumen.style.display = 'none';
                    modalResumen.setAttribute('aria-hidden', 'true');
                }

                // Construir mensaje de éxito (con escapes)
                let mensajeExito = result && result.message ? String(result.message) : 'Cita cancelada correctamente. Se ha enviado la confirmación por email.';
                if (result && typeof result.cancelaciones_restantes !== 'undefined') {
                    mensajeExito += `\n\nLe quedan ${escapeHTML(String(result.cancelaciones_restantes))} cancelaciones disponibles este mes.`;
                }

                mostrarModalMensaje('Cancelación Exitosa', mensajeExito);

                // Recargar citas si existe la función
                if (typeof cargarCitas === 'function') {
                    try {
                        cargarCitas();
                    } catch (ignore) {
                        // no hacer nada si recarga falla
                    }
                }

            } catch (err) {
                // err.body puede contener detalle del servidor
                const detalle = (err && err.body && err.body.message) ? String(err.body.message) : err.message || 'Error al cancelar la cita.';
                mostrarModalMensaje(`Error de Cancelación`, detalle);
            } finally {
                btnConfirmarCancelacion.disabled = false;
            }
        });
    }

    // -----------------------------
    // Cerrar resumen
    // -----------------------------
    if (btnCerrarResumen instanceof HTMLElement) {
        btnCerrarResumen.addEventListener('click', () => {
            if (modalResumen instanceof HTMLElement) {
                modalResumen.style.display = 'none';
                modalResumen.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // -----------------------------
    // Cerrar modal de mensajes generales
    // -----------------------------
    if (btnCerrarMensaje instanceof HTMLElement) {
        btnCerrarMensaje.addEventListener('click', () => {
            if (modalMensaje instanceof HTMLElement) {
                modalMensaje.style.display = 'none';
                modalMensaje.setAttribute('aria-hidden', 'true');
            }
        });
    }

    // -----------------------------
    // Inicialización: cargar motivos
    // -----------------------------
    (function init() {
        // Cargar motivos en background si el elemento existe
        if (motivoSelect instanceof HTMLSelectElement) {
            void cargarMotivos();
        }
    }());
}());
