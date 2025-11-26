// ---------------------------------------------
//  session-manager.js (Versión Refactorizada)
// ---------------------------------------------

// Tiempos en milisegundos
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;      // 30 minutos
const MAX_SESSION_DURATION = 60 * 60 * 1000;    // 1 hora
const EXPIRATION_WARNING_TIME = 2 * 60 * 1000;  // 2 minutos antes
const REMOTE_CHECK_INTERVAL = 30 * 1000;        // 30 segundos

let inactivityTimer = null;
let durationCheckInterval = null;
let warningTimeout = null;
let remoteCheckInterval = null;

let isInternalNavigation = false;

/* ----------------------------------------------------
   UTILIDAD: Limpia todos los timers y listeners
---------------------------------------------------- */
function clearAllSessionTimers() {
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimeout);
    clearInterval(durationCheckInterval);
    clearInterval(remoteCheckInterval);
    inactivityTimer = null;
    warningTimeout = null;
}

/* ----------------------------------------------------
   CIERRA SESIÓN COMPLETA (cliente + servidor)
---------------------------------------------------- */
async function expireSession(message = "Su sesión ha expirado.") {
    clearAllSessionTimers();

    window.removeEventListener("beforeunload", handleBeforeUnload);

    try {
        await fetch("../api/logout.php", { method: "POST" });
    } catch (err) {
        console.error("⚠ Error notificando logout al servidor:", err);
    }

    alert(message + " Será redirigido/a al inicio.");

    sessionStorage.clear();
    localStorage.removeItem("sessionStartTime");

    window.location.href = "./../html/login.html";
}

/* ----------------------------------------------------
   CIERRE DE NAVEGADOR / PESTAÑA (logout seguro)
---------------------------------------------------- */
function handleBeforeUnload(event) {
    if (isInternalNavigation) return;

    if (sessionStorage.getItem("isLoggedIn") === "true") {
        try {
            navigator.sendBeacon("../api/logout.php");
        } catch (e) {
            console.error("sendBeacon falló:", e);
        }
    }
}

/* ----------------------------------------------------
   VALIDACIÓN REMOTA DE SESIÓN ÚNICA
---------------------------------------------------- */
async function checkRemoteSessionValidity() {
    try {
        const response = await fetch("../api/check_session.php");
        const result = await response.json();

        if (result?.is_valid === false) {
            expireSession(
                "Su sesión fue cerrada porque se abrió una nueva en otro dispositivo."
            );
        }
    } catch (err) {
        console.error("⚠ Error al validar sesión remota:", err);
    }
}

/* ----------------------------------------------------
   CONTROL DE DURACIÓN MÁXIMA
---------------------------------------------------- */
function checkSessionDuration() {
    const startTime = Number(localStorage.getItem("sessionStartTime"));
    if (!startTime) return;

    const elapsed = Date.now() - startTime;
    const remaining = MAX_SESSION_DURATION - elapsed;

    if (remaining <= 0) {
        expireSession("Su sesión ha expirado tras 1 hora de uso.");
        return;
    }

    if (remaining <= EXPIRATION_WARNING_TIME && warningTimeout === null) {
        showExpirationWarning(remaining);
    }
}

/* ----------------------------------------------------
   MOSTRAR ADVERTENCIA DE EXPIRACIÓN
---------------------------------------------------- */
function showExpirationWarning(remaining) {
    const extend = confirm("Su sesión está por expirar. ¿Desea extenderla?");

    if (extend) {
        extendSession();
        return;
    }

    warningTimeout = setTimeout(() => {
        expireSession("Su sesión ha expirado.");
    }, remaining);
}

/* ----------------------------------------------------
   EXTENDER SESIÓN
---------------------------------------------------- */
function extendSession() {
    localStorage.setItem("sessionStartTime", Date.now());
    clearTimeout(warningTimeout);
    warningTimeout = null;
    resetInactivityTimer();
}

/* ----------------------------------------------------
   CONTROL DE INACTIVIDAD
---------------------------------------------------- */
function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        expireSession("Su sesión ha expirado por inactividad (30 min).");
    }, INACTIVITY_TIMEOUT);
}

/* ----------------------------------------------------
   DETECTAR NAVEGACIÓN INTERNA (NO logout)
---------------------------------------------------- */
function setupInternalNavigationDetection() {
    document.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (!link) return;

        try {
            const current = window.location.origin;
            const target = new URL(link.href).origin;

            if (current === target) {
                isInternalNavigation = true;
                setTimeout(() => (isInternalNavigation = false), 120);
            }
        } catch (_) {
        }
    });
}

/* ----------------------------------------------------
   INICIO DEL SISTEMA DE GESTIÓN DE SESIÓN
---------------------------------------------------- */
function startSessionManager() {
    const startTime = localStorage.getItem("sessionStartTime");

    if (!startTime) {
        window.location.href = "./../html/login.html";
        return;
    }

    document.addEventListener("mousemove", resetInactivityTimer);
    document.addEventListener("keypress", resetInactivityTimer);
    document.addEventListener("click", resetInactivityTimer);
    document.addEventListener("scroll", resetInactivityTimer);

    durationCheckInterval = setInterval(checkSessionDuration, 5000);
    remoteCheckInterval = setInterval(checkRemoteSessionValidity, REMOTE_CHECK_INTERVAL);

    resetInactivityTimer();
    checkRemoteSessionValidity();
    setupInternalNavigationDetection();

    window.addEventListener("beforeunload", handleBeforeUnload);
}

/* ----------------------------------------------------
   INICIO AUTOMÁTICO
---------------------------------------------------- */
if (sessionStorage.getItem("isLoggedIn") === "true") {
    startSessionManager();
} else if (!window.location.pathname.includes("login.html")) {
    window.location.href = "./../html/login.html";
}
