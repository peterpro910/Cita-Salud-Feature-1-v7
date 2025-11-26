// js/login.js

const loginForm = document.getElementById('login-form');
const documentoInput = document.getElementById('documento');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');
const messageContainer = document.getElementById('message-container');
const loginButton = document.getElementById('login-button');

// Modales y formularios de Olvidó Contraseña
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const sessionActiveModal = document.getElementById('session-active-modal');
const forceLoginButton = document.getElementById('force-login-button');
const cancelLoginButton = document.getElementById('cancel-login-button');

const permissionModal = document.getElementById('permission-modal');
const modalBackButton = document.getElementById('modal-back-button');
const closePermissionModal = permissionModal.querySelector('.close-button');

const ROL_PACIENTE = 2; // Definir el ID del rol de paciente

// Función de utilidad para mostrar mensajes de forma temporal
function displayMessage(message, type = 'error') {
    messageContainer.innerHTML = message;
    messageContainer.className = `message-container ${type}`;
    messageContainer.classList.remove('hidden');

    if (type === 'success') {
        setTimeout(() => {
            messageContainer.classList.add('hidden');
        }, 3000);
    }
}

// ----------------------------------------------------
// A. LÓGICA DE INICIO DE SESIÓN
// ----------------------------------------------------
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginButton.disabled = true;

    displayMessage('Iniciando sesión...', 'info');

    const credentials = {
        documento: documentoInput.value.trim(),
        password: passwordInput.value
    };

    try {
        const response = await fetch('../api/login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        const result = await response.json();

        if (result.success) {
            displayMessage(result.message, 'success');

            if (result.user_id_rol == ROL_PACIENTE) {
                // Guardar sesión
                sessionStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('sessionStartTime', Date.now());

                // Guardar info del paciente
                sessionStorage.setItem('id_paciente', result.id_paciente);
                sessionStorage.setItem('nombre_paciente', result.nombre_paciente);

                setTimeout(() => {
                    window.location.href = './../html/citas.html';
                }, 3000);
            } else {
                // Rol NO autorizado
                permissionModal.classList.remove('hidden');

                await fetch('../api/logout.php', { method: 'POST' });
            }

        } else if (result.session_active) {
            // Sesión activa única
            document.getElementById('session-active-msg').textContent = result.message;

            forceLoginButton.dataset.documento = credentials.documento;
            forceLoginButton.dataset.password = credentials.password;

            sessionActiveModal.classList.remove('hidden');
            loginButton.disabled = false;

        } else {
            displayMessage(result.message, 'error');
            loginButton.disabled = false;
        }

    } catch (error) {
        displayMessage('Error de red o servidor. Intente de nuevo.', 'error');
        loginButton.disabled = false;
    }
});

// ----------------------------------------------------
// B. LÓGICA DE SESIÓN ACTIVA ÚNICA
// ----------------------------------------------------
forceLoginButton.addEventListener('click', async () => {
    sessionActiveModal.classList.add('hidden');
    loginButton.disabled = true;

    displayMessage('Forzando inicio de sesión...', 'info');

    const credentials = {
        documento: forceLoginButton.dataset.documento,
        password: forceLoginButton.dataset.password
    };

    try {
        const response = await fetch('../api/force_login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });

        const result = await response.json();

        if (result.success) {

            if (result.user_id_rol == ROL_PACIENTE) {
                displayMessage(result.message, 'success');
                sessionStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('sessionStartTime', Date.now());
                sessionStorage.setItem('id_paciente', result.id_paciente);
                sessionStorage.setItem('nombre_paciente', result.nombre_paciente);

                setTimeout(() => {
                    window.location.href = './../html/citas.html';
                }, 3000);

            } else {
                displayMessage(result.message, 'success');
                permissionModal.classList.remove('hidden');

                await fetch('../api/logout.php', { method: 'POST' });
            }

        } else {
            displayMessage(result.message, 'error');
            loginButton.disabled = false;
        }

    } catch (error) {
        displayMessage('Error al forzar el inicio de sesión.', 'error');
        loginButton.disabled = false;
    }
});

cancelLoginButton.addEventListener('click', () => {
    sessionActiveModal.classList.add('hidden');
    loginButton.disabled = false;
});

// ----------------------------------------------------
// C. OLVIDÓ CONTRASEÑA
// ----------------------------------------------------
document.getElementById('forgot-password-link').addEventListener('click', (e) => {
    e.preventDefault();
    forgotPasswordModal.classList.remove('hidden');
    document.getElementById('forgot-documento').value = documentoInput.value;
    document.getElementById('forgot-message').classList.add('hidden');
});

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const doc = document.getElementById('forgot-documento').value;
    const forgotMessage = document.getElementById('forgot-message');

    forgotMessage.classList.add('hidden');

    try {
        const response = await fetch('../api/forgot_password.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documento: doc })
        });

        const result = await response.json();

        forgotMessage.innerHTML = result.message;
        forgotMessage.className = 'message-container success';
        forgotMessage.classList.remove('hidden');

    } catch (error) {
        forgotMessage.innerHTML = 'Error de red. Intente de nuevo.';
        forgotMessage.className = 'message-container error';
        forgotMessage.classList.remove('hidden');
    }
});

document.getElementById('close-forgot-modal').addEventListener('click', () => {
    forgotPasswordModal.classList.add('hidden');
});

// ----------------------------------------------------
// D. UI — Toggle de contraseña
// ----------------------------------------------------
togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;

    togglePassword.textContent = type === 'password' ? '🔒' : '🔓';
    togglePassword.setAttribute(
        'aria-label',
        type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña'
    );
});

// ----------------------------------------------------
// E. MODAL DE PERMISOS
// ----------------------------------------------------
modalBackButton.addEventListener('click', () => {
    permissionModal.classList.add('hidden');
    loginForm.reset();
    documentoInput.focus();
    loginButton.disabled = false;
});

closePermissionModal.addEventListener('click', () => {
    permissionModal.classList.add('hidden');
    loginForm.reset();
    documentoInput.focus();
    loginButton.disabled = false;
});
