// js/notifications.js — Versión Refactorizada y Optimizada

document.addEventListener("DOMContentLoaded", () => {

    // ==========================
    // 1. INYECTAR CSS UNA VEZ
    // ==========================
    injectNotificationStyles();

    const toastContainer = document.getElementById("notification-toast-container");
    if (!toastContainer) return;

    const idPaciente = sessionStorage.getItem("id_paciente");
    const nombrePaciente = sessionStorage.getItem("nombre_paciente") || "Estimado Paciente";
    if (!idPaciente) return;

    const API_URL = `./../api/get_notifications.php?id_paciente=${idPaciente}`;
    const ACCEPT_KEY = "accepted_appointment_notifications_persistent";

    // ==========================
    // 2. UTILIDADES
    // ==========================

    function injectNotificationStyles() {
        const css = `
        #notification-toast-container {
            display: block;
            position: fixed;
            right: 1.5rem;
            bottom: 1.5rem;
            width: 380px;
            max-width: 90%;
            z-index: 9990;
            opacity: 0;
            visibility: hidden;
            transform: translateX(100%);
            transition: 0.4s ease-out;
        }
        #notification-toast-container.show {
            opacity: 1;
            visibility: visible;
            transform: translateX(0);
        }
        .toast-content {
            background: #f8fafc;
            border-radius: 12px;
            border-left: 4px solid #3b82f6;
            box-shadow: 0 8px 25px rgba(59,130,246,0.2);
            padding: 1.25rem;
            font-family: 'Inter', sans-serif;
            color: #0f172a;
        }
        .toast-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: .75rem;
            border-bottom: 1px solid #e0f2fe;
            padding-bottom: .5rem;
        }
        .toast-header h4 {
            margin: 0;
            background: linear-gradient(135deg,#0ea5e9,#3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 1.1rem;
            font-weight: 700;
        }
        .toast-close-btn {
            background: #fff;
            border: 1px solid #e0f2fe;
            border-radius: 8px;
            color: #64748b;
            font-size: 1.2rem;
            cursor: pointer;
            padding: .4rem .6rem;
        }
        .toast-list { list-style: none; padding: 0; margin: 0 0 1rem 0; }
        .toast-list li { margin-bottom: .4rem; line-height: 1.4; }
        #notification-accept-btn {
            width: 100%; padding: .75rem 1rem;
            background: linear-gradient(135deg,#10b981,#059669);
            color: #fff; border: none; border-radius: 10px;
            cursor: pointer; font-weight: 600;
        }`;
        const s = document.createElement("style");
        s.innerHTML = css;
        document.head.appendChild(s);
    }

    function formatDate(dateStr, hourStr) {
        const d = new Date(`${dateStr}T${hourStr}`);
        return {
            fecha: d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }),
            hora: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true }),
        };
    }

    function getAcceptedMap() {
        return JSON.parse(localStorage.getItem(ACCEPT_KEY)) || {};
    }

    function markAccepted(citas) {
        const map = getAcceptedMap();
        citas.forEach(c => (map[c.id_cita] = true));
        localStorage.setItem(ACCEPT_KEY, JSON.stringify(map));
        hideToast();
    }

    const showToast = () => setTimeout(() => toastContainer.classList.add("show"), 10);
    const hideToast = () => toastContainer.classList.remove("show");


    // ==========================
    // 3. RENDER DEL POPUP
    // ==========================

    function renderToast(nombrePaciente, citas) {
        const items = citas
            .map(c => {
                const { fecha, hora } = formatDate(c.fecha, c.hora);
                return `
                <li>
                    <i class="fas fa-calendar-check"></i> <strong>Especialidad:</strong> ${c.nombre_especialidad} <br>
                    <i class="fas fa-user-md"></i> <strong>Profesional:</strong> ${c.nombre_profesional || "No asignado"}<br>
                    <i class="fas fa-clock"></i> <strong>Fecha y Hora:</strong> ${fecha} a las ${hora}<br>
                    <i class="fas fa-hospital-alt"></i> <strong>Sede:</strong> ${c.nombre_sede || "Sede principal"} (${c.direccion_sede || "Dirección no disponible"})
                </li>`;
            })
            .join("");

        toastContainer.innerHTML = `
        <div class="toast-content">
            <div class="toast-header">
                <h4><i class="fas fa-bullhorn"></i> Recordatorio de Cita</h4>
                <button class="toast-close-btn" id="toast-close">&times;</button>
            </div>
            <p>Hola ${nombrePaciente}, tienes ${citas.length} cita(s) en las próximas 24 horas:</p>
            <ul class="toast-list">${items}</ul>
            <button id="notification-accept-btn">Aceptar</button>
        </div>`;

        document.getElementById("toast-close").onclick = hideToast;
        document.getElementById("notification-accept-btn").onclick = () => markAccepted(citas);
    }

    // ==========================
    // 4. PETICIÓN AL SERVIDOR
    // ==========================

    async function checkNotifications() {
        try {
            const res = await fetch(API_URL);
            const json = await res.json();
            if (!json.success || json.count === 0) return;

            const accepted = getAcceptedMap();
            const pendientes = json.data.filter(c => !accepted[c.id_cita]);

            if (pendientes.length === 0) return;

            renderToast(nombrePaciente, pendientes);
            showToast();

        } catch (err) {
            console.error("Error cargando notificaciones:", err);
        }
    }

    checkNotifications();
});
