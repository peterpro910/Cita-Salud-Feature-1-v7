// auth.js – Versión Refactorizada y Optimizada

document.addEventListener('DOMContentLoaded', () => {
    
    const LOGIN_URL = './../html/login.html';
    const API_LOGOUT = './../api/logout.php';
    const logoutLink = document.getElementById('logout-link');

    // Función común para limpiar el lado del cliente
    const clearClientSession = () => {
        const keysToRemove = [
            'id_paciente',
            'nombre_paciente',
            'accepted_appointment_notifications_persistent',
            'last_especialidad_id',
            'last_sede_id',
            'last_profesional_id'
        ];

        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        // Bandera que fuerza limpieza del formulario en la siguiente carga
        sessionStorage.setItem('logout_clear_form', 'true');
    };

    // Función principal de logout
    const performLogout = async () => {
        try {
            const response = await fetch(API_LOGOUT, { method: 'POST' });

            if (!response.ok) {
                console.warn("Advertencia: logout.php respondió con error.", await response.text());
            }
        } catch (err) {
            console.error("Error durante el logout remoto:", err);
        }

        clearClientSession();

        // Usamos replace para evitar volver a esta página con back()
        window.location.replace(LOGIN_URL);
    };

    // Si no existe el enlace, no hacer nada
    if (!logoutLink) return;

    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await performLogout();
    });
});
