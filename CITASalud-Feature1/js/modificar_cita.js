// /js/modificar_cita.js

(function () {

    // --- Variables de DOM ---
    const modal = document.getElementById('modificationModal');
    const modificationForm = document.getElementById('modificationForm');
    const confirmationScreen = document.getElementById('confirmationScreen');
    const mensajeModificacion = document.getElementById('mensaje-modificacion');

    // Formulario (Paso 1)
    const especialidadDisplay = document.getElementById('especialidad_display');
    const especialidadIdInput = document.getElementById('especialidad_id');
    const sedeSelect = document.getElementById('sede');
    const profesionalSelect = document.getElementById('profesional');
    const fechaHorarioDisplay = document.getElementById('fecha_horario_display');
    const horarioIdInput = document.getElementById('horario_id');
    const nextToConfirmationBtn = document.getElementById('nextToConfirmation');
    const cancelModificationBtn = document.getElementById('cancelModification');

    // Confirmación (Paso 2)
    const originalDatetimeSpan = document.getElementById('original_datetime');
    const originalProfesionalSpan = document.getElementById('original_profesional');
    const originalSedeSpan = document.getElementById('original_sede');
    const modifiedDatetimeSpan = document.getElementById('modified_datetime');
    const modifiedProfesionalSpan = document.getElementById('modified_profesional');
    const modifiedSedeSpan = document.getElementById('modified_sede');
    const confirmModificationBtn = document.getElementById('confirmModification');

    // ID correcto en citas.html
    const backToFormBtn = document.getElementById('backToFormBtn');

    // Estado interno
    let originalCitaData = {};
    let fp = null;
    let isSettingDateProgrammatically = false;
    let allAvailableTimes = [];
    let valorAuxiliarFechaHora = '';

    // --- Utilidades ---
    function mostrarMensajeInterno(texto, tipo = 'error') {
        if (mensajeModificacion) {
            mensajeModificacion.textContent = texto;
            mensajeModificacion.className = `mensaje ${tipo}`;
            mensajeModificacion.style.display = 'block';
        }
    }

    function ocultarMensajeInterno() {
        if (mensajeModificacion) {
            mensajeModificacion.style.display = 'none';
        }
    }

    function showStep(step) {
        if (modificationForm) modificationForm.style.display = step === 'form' ? 'block' : 'none';
        if (confirmationScreen) confirmationScreen.style.display = step === 'confirmation' ? 'block' : 'none';
        ocultarMensajeInterno();
    }

    // Formateador fallback
    function formatHoraLocal(timeStr) {
        if (!timeStr) return '';
        if (typeof window.formatDateTime === 'function') {
            return window.formatDateTime('2000-01-01', timeStr).hora;
        }
        const [h, m] = timeStr.split(':');
        const hora = parseInt(h);
        const ampm = hora >= 12 ? 'PM' : 'AM';
        const hora12 = hora % 12 || 12;
        return `${hora12}:${m} ${ampm}`;
    }

    // --- APIs ---
    async function cargarSedes(especialidadId) {
        try {
            const response = await fetch(`../api/get_sedes.php?especialidad_id=${especialidadId}`);
            if (!response.ok) throw new Error("No se pudo obtener las sedes");

            const data = await response.json();
            const sedesValidas = data.filter(sede => sede.nombre);
            sedesValidas.sort((a, b) => a.nombre.localeCompare(b.nombre));

            const sedeSelect = document.getElementById("sede");
            sedeSelect.innerHTML = "";

            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "-- Selecciona una sede --";
            defaultOption.selected = true;
            sedeSelect.appendChild(defaultOption);

            sedesValidas.forEach(sede => {
                const option = document.createElement("option");
                option.value = sede.id;
                option.textContent = `${sede.nombre} (${sede.ciudad})`;
                option.dataset.direccion = sede.direccion;
                sedeSelect.appendChild(option);
            });

        } catch (error) {
            console.error("Error al cargar sedes:", error);
            mostrarMensajeInterno("No se pudieron cargar las sedes disponibles.", "error");
        }
    }

    async function cargarProfesionales(sedeId, especialidadId, selectedProfesionalId) {
        const profesionalSelect = document.getElementById("profesional");
        if (!profesionalSelect) return;

        profesionalSelect.innerHTML = '<option>Cargando profesionales...</option>';
        profesionalSelect.disabled = true;

        try {
            const response = await fetch(`../api/get_profesionales.php?especialidad_id=${especialidadId}&sede_id=${sedeId}`);
            const data = await response.json();

            profesionalSelect.innerHTML = "";

            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-- Selecciona un profesional --";
            defaultOption.selected = !selectedProfesionalId;
            profesionalSelect.appendChild(defaultOption);

            if (Array.isArray(data) && data.length > 0) {
                data.sort((a, b) => {
                    const nombreA = a.nombre_completo;
                    const nombreB = b.nombre_completo;
                    return nombreA.localeCompare(nombreB);
                });

                data.forEach(profesional => {
                    const option = document.createElement("option");
                    option.value = profesional.id;
                    option.textContent = profesional.nombre_completo;
                    option.selected = option.value == selectedProfesionalId;
                    profesionalSelect.appendChild(option);
                });

                profesionalSelect.disabled = false;

                if (selectedProfesionalId) {
                    profesionalSelect.dispatchEvent(new Event('change'));
                }

            } else {
                mostrarMensajeInterno('No se encontraron profesionales.', 'warning');
            }

        } catch (error) {
            console.error("Error al cargar profesionales:", error);
            mostrarMensajeInterno('Error de conexión al cargar profesionales.', 'error');
        }
    }

    async function configurarFlatpickr(profesionalId) {
        const fechaHorarioDisplay = document.getElementById("fecha_horario_display");
        const horarioOriginalInput = document.getElementById("horario_original_id");
        const idPaciente = window.idPaciente;
        const idHorarioOriginal = horarioOriginalInput?.value;

        fechaHorarioDisplay.disabled = true;
        fechaHorarioDisplay.placeholder = "Cargando horarios...";

        if (fp) fp.destroy();

        try {
            const url = `../api/get_horarios.php?profesional_id=${profesionalId}&id_paciente=${idPaciente}&id_horario_a_liberar=${idHorarioOriginal}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!Array.isArray(data)) {
                fechaHorarioDisplay.placeholder = 'No hay horarios disponibles';
                return;
            }

            allAvailableTimes = data;
            const availableDates = [...new Set(data.map(h => h.fecha))];

            fechaHorarioDisplay.disabled = false;
            fechaHorarioDisplay.placeholder = 'Seleccionar fecha';

            fp = flatpickr(fechaHorarioDisplay, {
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "d F, Y",
                locale: "es",
                enableTime: false,
                enable: availableDates,
                minDate: "today",
                maxDate: new Date().fp_incr(60),

                onChange: function (_, dateStr) {
                    showAvailableTimes(dateStr);
                }
            });

        } catch (error) {
            console.error("Error horarios:", error);
            fechaHorarioDisplay.placeholder = 'Error al cargar horarios';
        }
    }

    function validateForm() {
        const sede = document.getElementById("sede")?.value;
        const profesional = document.getElementById("profesional")?.value;
        const horarioId = document.getElementById("horario_id")?.value;

        nextToConfirmationBtn.disabled = !(sede && profesional && horarioId);
    }

    function showAvailableTimes(selectedDate) {
        const timesContainer = document.getElementById("horarios-list");
        timesContainer.innerHTML = "";
        timesContainer.style.display = "flex";

        const dailyTimes = allAvailableTimes.filter(h => h.fecha === selectedDate);

        horarioIdInput.value = '';
        valorAuxiliarFechaHora = '';

        if (dailyTimes.length === 0) {
            timesContainer.innerHTML = '<p>No hay horarios disponibles.</p>';
            return;
        }

        dailyTimes.forEach(horario => {
            const btn = document.createElement('button');
            btn.className = "time-btn";
            btn.textContent = new Date(`2000-01-01T${horario.hora}`).toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit'
            });
            btn.dataset.id = horario.id_horario;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                horarioIdInput.value = horario.id_horario;

                valorAuxiliarFechaHora = `${selectedDate} ${horario.hora.substring(0, 5)}`;

                validateForm();
            });

            timesContainer.appendChild(btn);
        });

        validateForm();
    }

    // ------------------------------------------------
    // FUNCIÓN PRINCIPAL: inicializarModificacion()
    // ------------------------------------------------

    window.inicializarModificacion = async (
        idCita,
        idHorarioOriginal,
        especialidadId,
        especialidadNombre,
        fecha,
        hora,
        sedeId,
        sedeNombre,
        profesionalId,
        profesionalNombre
    ) => {

        // VALIDAR LA CITA EN BACKEND
        const validacion = await fetch(`../api/validar_modificacion.php?id_cita=${idCita}`);
        const resultVal = await validacion.json();

        if (!resultVal.success) {
            window.mostrarModalMensaje("Modificación no permitida", resultVal.message, "error");
            return; // ❌ NO ABRE EL MODAL
        }

        // SI PASÓ LA VALIDACIÓN → AHORA SÍ ABRIR EL MODAL
        modal.style.display = "flex";
        showStep("form");

        originalCitaData = {
            id_cita: idCita,
            id_horario_original: idHorarioOriginal,
            especialidad_id: especialidadId,
            especialidad_nombre: especialidadNombre,
            fecha,
            hora,
            sede_id: sedeId,
            sede_nombre: sedeNombre,
            profesional_id: profesionalId,
            profesional_nombre: profesionalNombre
        };

        especialidadDisplay.textContent = especialidadNombre;
        especialidadIdInput.value = especialidadId;

        await cargarSedes(especialidadId);

        const sedeDOM = document.getElementById("sede");
        sedeDOM.value = sedeId;

        await cargarProfesionales(sedeId, especialidadId, profesionalId);

        if (profesionalId) {
            await configurarFlatpickr(profesionalId);
        }

        validateForm();
    };

    // -------------------------------
    // LISTENERS MODAL
    // -------------------------------

    if (nextToConfirmationBtn) {
        nextToConfirmationBtn.addEventListener("click", () => {
            if (nextToConfirmationBtn.disabled) return;

            const fOriginal = window.formatDateTime(originalCitaData.fecha, originalCitaData.hora);

            const [fNuevaFecha, fNuevaHoraCorta] = valorAuxiliarFechaHora.split(" ");
            const fNuevaHoraCompleta = fNuevaHoraCorta.length === 5 ? fNuevaHoraCorta + ":00" : fNuevaHoraCorta;
            const fNueva = window.formatDateTime(fNuevaFecha, fNuevaHoraCompleta);

            document.getElementById("conf_original_datetime").textContent = `${fOriginal.fecha} - ${fOriginal.hora}`;
            document.getElementById("conf_original_profesional").textContent = originalCitaData.profesional_nombre;
            document.getElementById("conf_original_sede").textContent = originalCitaData.sede_nombre;

            const sedeSel = document.getElementById("sede");
            const profSel = document.getElementById("profesional");

            document.getElementById("conf_modified_datetime").textContent = `${fNueva.fecha} - ${fNueva.hora}`;
            document.getElementById("conf_modified_profesional").textContent = profSel.options[profSel.selectedIndex].text;
            document.getElementById("conf_modified_sede").textContent = sedeSel.options[sedeSel.selectedIndex].text;

            showStep("confirmation");
        });
    }

    if (backToFormBtn) {
        backToFormBtn.addEventListener("click", () => {
            horarioIdInput.value = "";
            valorAuxiliarFechaHora = "";
            showStep("form");
            validateForm();
        });
    }

    if (cancelModificationBtn) {
        cancelModificationBtn.addEventListener("click", () => {
            modal.style.display = "none";
            if (fp) fp.destroy();
        });
    }

    if (confirmModificationBtn) {
        confirmModificationBtn.addEventListener("click", async () => {
            confirmModificationBtn.disabled = true;

            window.mostrarModalMensaje("Procesando...", "Estamos modificando su cita.", "info");

            const dataToSend = {
                id_cita: originalCitaData.id_cita,
                id_paciente: window.idPaciente,
                id_horario_original: originalCitaData.id_horario_original,
                id_nuevo_horario: horarioIdInput.value,
                id_nueva_sede: sedeSelect.value,
                id_nuevo_profesional: profesionalSelect.value,
                id_especialidad: originalCitaData.especialidad_id
            };

            if (!dataToSend.id_nuevo_horario) {
                window.mostrarModalMensaje("Error", "Debe seleccionar un horario.", "error");
                confirmModificationBtn.disabled = false;
                return;
            }

            try {
                const response = await fetch("../api/modificar_cita.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(dataToSend)
                });

                const resJson = await response.json();

                document.getElementById("modal-mensaje").style.display = "none";
                modal.style.display = "none";

                if (response.ok) {
                    const nueva = window.formatDateTime(resJson.nueva_fecha, resJson.nueva_hora);
                    window.mostrarModalMensaje(
                        "Modificación Exitosa",
                        `Su cita fue modificada.<br><strong>${nueva.fecha} - ${nueva.hora}</strong>`,
                        "success"
                    );
                    window.cargarCitas();

                } else {
                    window.mostrarModalMensaje("Error", resJson.message, "error");
                }

            } catch (err) {
                window.mostrarModalMensaje("Error", "No se pudo contactar el servidor.", "error");
            }

            confirmModificationBtn.disabled = false;
        });
    }

})();
