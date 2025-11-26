// js/agendamiento_refactor.js
// Código optimizado para SonarQube, mantenible, modular y seguro

(function () {
    "use strict";

    // -------------------------------------------------------------
    // UTILIDADES DE SEGURIDAD Y FETCH SEGURO
    // -------------------------------------------------------------
    const escapeHTML = (str) =>
        String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    const safeText = (el, text) => {
        if (el instanceof HTMLElement) el.textContent = escapeHTML(text);
    };

    async function safeFetchJSON(url, options = {}) {
        const response = await fetch(url, options);
        const isJson = response.headers.get("content-type")?.includes("application/json");

        const data = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
            const error = new Error(data.message || `HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return data;
    }

    // -------------------------------------------------------------
    // VARIABLES DE ESTADO
    // -------------------------------------------------------------
    let flatpickrInstance = null;
    let allAvailableTimes = [];

    // -------------------------------------------------------------
    // ELEMENTOS DOM
    // -------------------------------------------------------------
    const $ = (id) => document.getElementById(id);

    const idPaciente = sessionStorage.getItem("id_paciente");
    if (!idPaciente) {
        alert("Por favor, inicie sesión primero.");
        window.location.href = "./../html/login.html";
        return;
    }

    const especialidadSelect = $("especialidad");
    const sedeSelect = $("sede");
    const profesionalSelect = $("profesional");
    const horarioSelect = $("horario");
    const agendarBtn = $("agendar-btn");
    const confirmarBtn = $("confirmar-btn");
    const regresarBtn = $("regresar-btn");
    const mensajeDiv = $("mensaje");
    const resumenDiv = $("resumen-cita");
    const citaForm = $("cita-form");
    const modal = $("modal-confirmacion");
    const btnAceptar = $("btn-aceptar");

    // -------------------------------------------------------------
    // MENSAJES
    // -------------------------------------------------------------
    function mostrarMensaje(texto, tipo = "") {
        mensajeDiv.className = `mensaje ${tipo}`;
        safeText(mensajeDiv, texto);
    }

    // -------------------------------------------------------------
    // CARGA DE ESPECIALIDADES
    // -------------------------------------------------------------
    async function cargarEspecialidades(selectedId = null) {
        mostrarMensaje("Cargando especialidades...", "info");
        especialidadSelect.disabled = true;

        try {
            const data = await safeFetchJSON("./../api/get_especialidades.php");
            especialidadSelect.innerHTML = `<option value="">Selecciona una especialidad</option>`;

            data.forEach((item) => {
                const option = document.createElement("option");
                option.value = item.id_especialidad;
                option.textContent = item.nombre_especialidad;

                if (item.horarios_disponibles === 0) {
                    option.textContent += " (Sin disponibilidad)";
                    option.disabled = true;
                }
                especialidadSelect.appendChild(option);
            });

            if (selectedId) especialidadSelect.value = selectedId;

        } catch (e) {
            mostrarMensaje(e.message || "Error al cargar especialidades", "error");
        } finally {
            especialidadSelect.disabled = false;
            mostrarMensaje("");
        }
    }

    // -------------------------------------------------------------
    // CARGA DE SEDES
    // -------------------------------------------------------------
    async function cargarSedes(idEspecialidad, selectedId = null) {
        mostrarMensaje("Cargando sedes...", "info");
        sedeSelect.disabled = true;
        profesionalSelect.disabled = true;
        horarioSelect.disabled = true;

        try {
            const data = await safeFetchJSON(`./../api/get_sedes.php?especialidad_id=${idEspecialidad}`);
            sedeSelect.innerHTML = `<option value="">Selecciona una sede</option>`;

            data.forEach((item) => {
                const op = document.createElement("option");
                op.value = item.id;
                op.textContent = `${item.nombre} - ${item.direccion}, ${item.ciudad}`;
                sedeSelect.appendChild(op);
            });

            if (selectedId) sedeSelect.value = selectedId;

        } catch (e) {
            mostrarMensaje(e.message, "error");
        } finally {
            sedeSelect.disabled = false;
            mostrarMensaje("");
        }
    }

    // -------------------------------------------------------------
    // CARGA DE PROFESIONALES
    // -------------------------------------------------------------
    async function cargarProfesionales(idEspecialidad, idSede, selectedId = null) {
        mostrarMensaje("Cargando profesionales...", "info");
        profesionalSelect.disabled = true;

        try {
            const data = await safeFetchJSON(
                `./../api/get_profesionales.php?especialidad_id=${idEspecialidad}&sede_id=${idSede}`
            );

            profesionalSelect.innerHTML = `<option value="">Selecciona un profesional</option>`;

            data.forEach((item) => {
                const op = document.createElement("option");
                op.value = item.id;
                op.textContent = `${item.nombre_completo} - ${item.titulo_profesional} (${item.anos_experiencia} años)`;

                if (item.horarios_disponibles === 0) {
                    op.textContent += " (Sin disponibilidad)";
                    op.disabled = true;
                }
                profesionalSelect.appendChild(op);
            });

            if (selectedId) profesionalSelect.value = selectedId;

        } catch (e) {
            mostrarMensaje(e.message, "error");
        } finally {
            profesionalSelect.disabled = false;
            mostrarMensaje("");
        }
    }

    // -------------------------------------------------------------
    // CARGA DE HORARIOS
    // -------------------------------------------------------------
    async function cargarHorarios(idProfesional) {
        mostrarMensaje("Cargando horarios...", "info");
        agendarBtn.style.display = "none";
        horarioSelect.disabled = true;

        $("horarios-list").style.display = "none";
        $("horarios-list").innerHTML = "";

        if (flatpickrInstance) flatpickrInstance.destroy();

        try {
            const data = await safeFetchJSON(
                `./../api/get_horarios.php?profesional_id=${idProfesional}&id_paciente=${idPaciente}`
            );

            allAvailableTimes = data;
            const availableDates = [...new Set(data.map((h) => h.fecha))];

            horarioSelect.disabled = false;

            flatpickrInstance = flatpickr(horarioSelect, {
                enable: availableDates,
                locale: "es",
                dateFormat: "Y-m-d",
                altInput: true,
                altFormat: "d F, Y",
                onChange: (dates, dateStr) => {
                    if (dates.length > 0) showAvailableTimes(dateStr);
                }
            });

        } catch (e) {
            mostrarMensaje(e.message, "error");
        } finally {
            mostrarMensaje("");
        }
    }

    // -------------------------------------------------------------
    // MOSTRAR HORARIOS DISPONIBLES
    // -------------------------------------------------------------
    function showAvailableTimes(date) {
        const container = $("horarios-list");
        container.innerHTML = "";
        container.style.display = "flex";

        const filtered = allAvailableTimes.filter((h) => h.fecha === date);

        if (filtered.length === 0) {
            container.innerHTML = "<p>No hay horarios disponibles.</p>";
            return;
        }

        filtered.forEach((h) => {
            const btn = document.createElement("button");
            btn.className = "time-btn";
            btn.setAttribute("data-id-horario", h.id_horario);
            btn.setAttribute("data-fecha-hora", `${h.fecha} ${h.hora}`);

            btn.textContent = new Date(`2000-01-01T${h.hora}`).toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit"
            });

            btn.addEventListener("click", () => {
                document.querySelectorAll(".time-btn").forEach((b) => b.classList.remove("selected"));
                btn.classList.add("selected");
                $("horario_seleccionado").value = h.id_horario;
                agendarBtn.style.display = "block";
            });

            container.appendChild(btn);
        });
    }

    // -------------------------------------------------------------
    // RESUMEN
    // -------------------------------------------------------------
    function mostrarResumen() {
        const horarioSeleccionado = document.querySelector(".time-btn.selected");
        if (!horarioSeleccionado) return;

        const fechaHora = horarioSeleccionado.getAttribute("data-fecha-hora");
        const [fecha, hora] = fechaHora.split(" ");

        const fechaObj = new Date(`${fecha}T${hora}`);
        const fechaTexto = fechaObj.toLocaleDateString("es-CO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });

        const horaTexto = fechaObj.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        safeText($("resumen-paciente"), sessionStorage.getItem("nombre_paciente"));
        safeText($("resumen-especialidad"), especialidadSelect.selectedOptions[0].textContent);
        safeText($("resumen-profesional"), profesionalSelect.selectedOptions[0].textContent);
        safeText($("resumen-sede"), sedeSelect.selectedOptions[0].textContent);
        safeText($("resumen-fecha-hora"), `${fechaTexto} - ${horaTexto}`);

        citaForm.style.display = "none";
        resumenDiv.style.display = "block";
    }

    // -------------------------------------------------------------
    // AGENDAR CITA
    // -------------------------------------------------------------
    async function agendarCita(e) {
        e.preventDefault();
        confirmarBtn.disabled = true;

        mostrarMensaje("Confirmando cita...", "info");

        const payload = {
            id_paciente: idPaciente,
            id_profesional: profesionalSelect.value,
            id_sede: sedeSelect.value,
            id_especialidad: especialidadSelect.value,
            id_horario: $("horario_seleccionado").value
        };

        try {
            await safeFetchJSON("./../api/agendar_cita.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            modal.style.display = "flex";

        } catch (e) {
            mostrarMensaje(e.message || "Error al agendar cita", "error");
            resumenDiv.style.display = "none";
            citaForm.style.display = "block";
        } finally {
            confirmarBtn.disabled = false;
        }
    }

    // -------------------------------------------------------------
    // EVENTOS
    // -------------------------------------------------------------
    especialidadSelect.addEventListener("change", async (e) => {
        const id = e.target.value;
        if (!id) return limpiarDependencias();

        sessionStorage.setItem("last_especialidad_id", id);
        await cargarSedes(id);
    });

    sedeSelect.addEventListener("change", async (e) => {
        const id = e.target.value;
        if (!id) return limpiarProfesionales();

        sessionStorage.setItem("last_sede_id", id);
        await cargarProfesionales(especialidadSelect.value, id);
    });

    profesionalSelect.addEventListener("change", async (e) => {
        const id = e.target.value;
        if (!id) return limpiarHorarios();

        sessionStorage.setItem("last_profesional_id", id);
        await cargarHorarios(id);
    });

    agendarBtn.addEventListener("click", mostrarResumen);
    confirmarBtn.addEventListener("click", agendarCita);

    regresarBtn.addEventListener("click", () => {
        resumenDiv.style.display = "none";
        citaForm.style.display = "block";
    });

    btnAceptar.addEventListener("click", () => {
        modal.style.display = "none";
        resumenDiv.style.display = "none";
        citaForm.style.display = "block";
        citaForm.reset();
        $("horarios-list").innerHTML = "";
        agendarBtn.style.display = "none";

        limpiarDependencias();
        cargarEspecialidades();
    });

    // -------------------------------------------------------------
    // LIMPIEZAS
    // -------------------------------------------------------------
    function limpiarHorarios() {
        horarioSelect.value = "";
        horarioSelect.disabled = true;

        const cont = $("horarios-list");
        cont.style.display = "none";
        cont.innerHTML = "";

        if (flatpickrInstance) flatpickrInstance.destroy();
        agendarBtn.style.display = "none";
    }

    function limpiarProfesionales() {
        profesionalSelect.innerHTML = `<option value="">Selecciona una sede primero</option>`;
        profesionalSelect.disabled = true;
        limpiarHorarios();
    }

    function limpiarDependencias() {
        sedeSelect.innerHTML = `<option value="">Selecciona una especialidad primero</option>`;
        sedeSelect.disabled = true;
        limpiarProfesionales();
    }

    // -------------------------------------------------------------
    // INICIALIZACIÓN
    // -------------------------------------------------------------
    (async function iniciarFormulario() {
        await cargarEspecialidades();

        const lastEsp = sessionStorage.getItem("last_especialidad_id");
        const lastSede = sessionStorage.getItem("last_sede_id");
        const lastProf = sessionStorage.getItem("last_profesional_id");

        if (!lastEsp) return;

        especialidadSelect.value = lastEsp;
        await cargarSedes(lastEsp, lastSede);

        if (!lastSede) return;

        await cargarProfesionales(lastEsp, lastSede, lastProf);

        if (!lastProf) return;

        await cargarHorarios(lastProf);
    })();
})();
