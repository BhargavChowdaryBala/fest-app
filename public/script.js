const BACKEND_URL = ""; // Relative path for same-origin deployment

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const messageDiv = document.getElementById('message');
    const authForm = document.getElementById('authForm');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const toggleLink = document.getElementById('toggle-auth');
    const signupFields = document.getElementById('signup-fields');
    const identifierLabel = document.getElementById('identifier-label');

    let isLogin = true;

    // Toggle Login / Signup
    toggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        if (isLogin) {
            formTitle.textContent = 'Welcome Back';
            submitBtn.textContent = 'Sign In';
            identifierLabel.textContent = 'WhatsApp Number or Email';
            signupFields.style.display = 'none';
            toggleLink.innerHTML = 'New user? <span style="color:#4f46e5;font-weight:bold;">Sign Up</span>';
            clearMessage();
        } else {
            formTitle.textContent = 'Create Account';
            submitBtn.textContent = 'Sign Up';
            identifierLabel.textContent = 'WhatsApp Number';
            signupFields.style.display = 'block';
            toggleLink.innerHTML = 'Already have an account? <span style="color:#4f46e5;font-weight:bold;">Sign In</span>';
            clearMessage();
        }
    });

    // Submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;

        // ================= LOGIN =================
        if (isLogin) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                const data = await res.json();

                if (res.ok) {
                    showMessage('Login successful! Redirecting...', 'success');
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setTimeout(() => window.location.href = '/hi.html', 1000);
                } else {
                    showMessage(data.message || 'Login failed', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('An error occurred. Please try again.', 'error');
            }
        }

        // ================= SIGNUP =================
        else {
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;

            if (!name || !email || !identifier || !password) {
                showMessage('Please fill in all fields', 'error');
                return;
            }

            if (!/^\d{10}$/.test(identifier)) {
                showMessage('Mobile number must be exactly 10 digits', 'error');
                return;
            }

            try {
                const res = await fetch(`${BACKEND_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        whatsappNumber: identifier,
                        email,
                        password
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    showMessage('Account created! Please login.', 'success');
                    setTimeout(() => toggleLink.click(), 1500);
                } else {
                    showMessage(data.message || 'Signup failed', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('An error occurred. Please try again.', 'error');
            }
        }
    });

    // ================= FORGOT PASSWORD =================
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const backToLogin = document.getElementById('back-to-login');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetBtn = document.getElementById('reset-btn');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', e => {
            e.preventDefault();
            loginForm.style.display = 'none';
            forgotPasswordForm.style.display = 'block';
            clearMessage();
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', () => {
            forgotPasswordForm.style.display = 'none';
            loginForm.style.display = 'block';
            clearMessage();
        });
    }

    if (resetRequestForm) {
        resetRequestForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;

            resetBtn.disabled = true;
            resetBtn.textContent = 'Sending...';

            try {
                const res = await fetch(`${BACKEND_URL}/api/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await res.json();

                if (res.ok) {
                    showMessage(data.message, 'success');
                    resetRequestForm.reset();
                } else {
                    showMessage(data.message || 'Failed to send email', 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                resetBtn.disabled = false;
                resetBtn.textContent = 'Send Reset Link';
            }
        });
    }

    function showMessage(msg, type) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');
    }

    function clearMessage() {
        messageDiv.textContent = '';
        messageDiv.classList.add('hidden');
    }
});
