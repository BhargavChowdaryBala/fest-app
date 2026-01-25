const BACKEND_URL = "https://fest-app-backend.onrender.com";

document.addEventListener('DOMContentLoaded', () => {

    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');

    // Toggle Logic
    if (showRegisterBtn && showLoginBtn) {
        showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.style.display = 'none';
            registerSection.style.display = 'block';
        });

        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerSection.style.display = 'none';
            loginSection.style.display = 'block';
        });
    }

    // Password Toggle Logic
    document.querySelectorAll('.toggle-password').forEach(eye => {
        eye.addEventListener('click', function () {
            const input = this.previousElementSibling;
            if (input.getAttribute('type') === 'password') {
                input.setAttribute('type', 'text');
                this.textContent = '🙈'; // Change icon to open eye/hide
            } else {
                input.setAttribute('type', 'password');
                this.textContent = '👁️'; // Change icon to closed eye/show
            }
        });
    });

    // Forms
    const authLoginForm = document.getElementById('authLoginForm');
    const authSignupForm = document.getElementById('authSignupForm');
    const loginMessage = document.getElementById('login-message');
    const signupMessage = document.getElementById('signup-message');

    // === SIGN UP HANDLER ===
    if (authSignupForm) {
        authSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('signup-name').value;
            const identifier = document.getElementById('signup-identifier').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            if (!/^\d{10}$/.test(identifier)) {
                showMessage(signupMessage, 'Mobile number must be 10 digits', 'error');
                return;
            }

            try {
                const res = await fetch(`${BACKEND_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, whatsappNumber: identifier, email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    showMessage(signupMessage, 'Success! Redirecting to login...', 'success');
                    setTimeout(() => {
                        showLoginBtn.click();
                    }, 1500);
                } else {
                    showMessage(signupMessage, data.message || 'Signup failed', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage(signupMessage, 'Server error', 'error');
            }
        });
    }

    // === LOG IN HANDLER ===
    if (authLoginForm) {
        authLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const identifier = document.getElementById('login-identifier').value;
            const password = document.getElementById('login-password').value;

            try {
                const res = await fetch(`${BACKEND_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                const data = await res.json();

                if (res.ok) {
                    showMessage(loginMessage, 'Welcome back!', 'success');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setTimeout(() => window.location.href = '/hi.html', 1000);
                } else {
                    showMessage(loginMessage, data.message || 'Login failed', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage(loginMessage, 'Server error', 'error');
            }
        });
    }

    // === FORGOT PASSWORD ===
    const forgotLink = document.getElementById('forgot-password-link');
    const forgotModal = document.getElementById('forgot-password-modal');
    const closeForgot = document.getElementById('close-forgot-modal');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetBtn = resetRequestForm ? resetRequestForm.querySelector('button') : null;
    const resetMessage = document.getElementById('reset-message');

    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotModal.style.display = 'flex';
        });
    }

    if (closeForgot) {
        closeForgot.addEventListener('click', (e) => {
            e.preventDefault();
            forgotModal.style.display = 'none';
        });
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target == forgotModal) {
            forgotModal.style.display = 'none';
        }
    });

    if (resetRequestForm) {
        resetRequestForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;
            const SERVICE_ID = "service_u42f0fr";
            const TEMPLATE_ID = "template_xgf3kld";

            if (resetBtn) {
                resetBtn.disabled = true;
                resetBtn.textContent = 'Generating...';
            }

            try {
                const res = await fetch(`${BACKEND_URL}/api/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                if (res.ok && data.useEmailJS) {
                    if (resetBtn) resetBtn.textContent = 'Sending Email...';
                    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                        to_email: data.email,
                        reset_link: data.resetUrl
                    });
                    showMessage(resetMessage, 'Reset email sent!', 'success');
                    setTimeout(() => forgotModal.style.display = 'none', 2000);
                } else if (res.ok) {
                    showMessage(resetMessage, data.message, 'success');
                } else {
                    showMessage(resetMessage, data.message || 'Failed', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage(resetMessage, 'Error sending email', 'error');
            } finally {
                if (resetBtn) {
                    resetBtn.disabled = false;
                    resetBtn.textContent = 'Send Link';
                }
            }
        });
    }

    function showMessage(element, msg, type) {
        if (!element) return;
        element.textContent = msg;
        element.className = `message ${type}`;
        element.style.display = 'block';
    }
});
