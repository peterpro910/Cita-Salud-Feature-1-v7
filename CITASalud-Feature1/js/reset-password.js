// js/reset-password.js – Versión Refactorizada y Optimizada

const resetPasswordForm = document.getElementById('reset-password-form');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const resetMessageContainer = document.getElementById('reset-message-container');

// Obtener parámetros desde la URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const documento = urlParams.get('doc');

// ============================
// FUNCIONES AUXILIARES
// ============================

/** Muestra un mensaje estándar en el contenedor */
function showMessage(message, type = "error") {
    resetMessageContainer.innerHTML = message;
    resetMessageContainer.className = `message-container ${type}`;
    resetMessageContainer.classList.remove('hidden');
}

/** Valida la contraseña y devuelve lista de errores */
function validatePassword(password) {
    const criteria = [];

    if (password.length < 7 || password.length > 16) criteria.push("Debe tener entre 7 y 16 caracteres.");
    if (!/[A-Z]/.test(password)) criteria.push("Debe contener al menos una letra mayúscula.");
    if (!/[a-z]/.test(password)) criteria.push("Debe contener al menos una letra minúscula.");
    if (!/[0-9]/.test(password)) criteria.push("Debe contener al menos un número.");
    if (!/[!@#$%^&*()_+={}\[\]|\\:;\"'<>,.?\/~`]/.test(password)) criteria.push("Debe contener al menos un carácter especial.");

    return criteria;
}

/** Valida que los parámetros del enlace sean correctos */
function validateURLParams() {
    if (!token || !documento) {
        showMessage("Enlace de restablecimiento incompleto. Solicite uno nuevo.", "error");
        return false;
    }
    return true;
}

// ============================
// PROCESO PRINCIPAL DEL FORMULARIO
// ============================

if (validateURLParams()) {
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        // Verificar coincidencia
        if (newPassword !== confirmPassword) {
            showMessage("Las contraseñas no coinciden.", "error");
            return;
        }

        // Validar criterios
        const validationErrors = validatePassword(newPassword);
        if (validationErrors.length > 0) {
            const formattedErrors = `<strong>La contraseña no cumple los requisitos:</strong><ul>${validationErrors.map(err => `<li>${err}</li>`).join('')}</ul>`;
            showMessage(formattedErrors, "error");
            return;
        }

        // Enviar al servidor
        try {
            const response = await fetch('../api/reset_password.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documento,
                    token,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const result = await response.json();

            if (result.success) {
                showMessage(`${result.message} Será redirigido al login en 5 segundos.`, "success");

                setTimeout(() => {
                    window.location.href = './../html/login.html';
                }, 5000);

            } else {
                showMessage(result.message, "error");
            }

        } catch (error) {
            showMessage("Error de red o de servidor.", "error");
        }
    });
}
