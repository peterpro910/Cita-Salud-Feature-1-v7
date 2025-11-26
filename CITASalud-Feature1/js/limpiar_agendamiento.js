// /js/limpiar_agendamiento.js (Versión Optimizada y Corregida)

document.addEventListener('DOMContentLoaded', () => {
    
    // Verifica si se vino desde un logout (flag guardado por login/logout)
    const mustClear = sessionStorage.getItem('logout_clear_form') === 'true';

    if (!mustClear) return;

    console.log('[limpiar_agendamiento] Se detectó cierre de sesión previo → limpiando formulario de agendamiento.');

    // Seleccionamos únicamente los campos del agendamiento
    const agendarForm = document.getElementById('agendar-form') || document; 
    const fields = agendarForm.querySelectorAll(
        'input:not([type="hidden"]):not(.flatpickr-input), select, textarea'
    );

    fields.forEach(field => {
        const tag = field.tagName.toLowerCase();

        // Input de texto, número, email, password
        if (tag === 'input' && !['checkbox', 'radio', 'button', 'submit'].includes(field.type)) {
            field.value = '';
        }

        // Checkboxes / Radios
        else if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = false;
        }

        // <select> → restablece a la primera opción válida
        else if (tag === 'select') {
            if (field.options.length > 0) {
                field.selectedIndex = 0;
            }
        }

        // <textarea>
        else if (tag === 'textarea') {
            field.value = '';
        }
    });

    // Si tienes Flatpickr en fecha/hora — limpiarlo manualmente si existe
    if (window.fp instanceof Object && typeof window.fp.clear === 'function') {
        window.fp.clear();
    }

    // Eliminar la bandera para que no vuelva a ejecutar la limpieza
    sessionStorage.removeItem('logout_clear_form');

    console.log('[limpiar_agendamiento] Formulario limpiado correctamente.');
});
