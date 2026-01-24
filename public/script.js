document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const messageDiv = document.getElementById('message');
    // Handle Login
    const authForm = document.getElementById('authForm');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const toggleLink = document.getElementById('toggle-auth');
    const signupFields = document.getElementById('signup-fields');
    const identifierLabel = document.getElementById('identifier-label');

    let isLogin = true;

    // Toggle between Login and Signup
    toggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        if (isLogin) {
            formTitle.textContent = 'Welcome Back';
            submitBtn.textContent = 'Sign In';
            identifierLabel.textContent = 'WhatsApp Number or Email';
            signupFields.style.display = 'none';
            toggleLink.innerHTML = 'New user? <span style="color: #4f46e5; font-weight: bold;">Sign Up</span>';
            clearMessage();
        } else {
            formTitle.textContent = 'Create Account';
            submitBtn.textContent = 'Sign Up';
            identifierLabel.textContent = 'WhatsApp Number'; // specific label for consistency
            signupFields.style.display = 'block';
            toggleLink.innerHTML = 'Already have an account? <span style="color: #4f46e5; font-weight: bold;">Sign In</span>';
            clearMessage();
        }
    });

    // Handle Form Submit
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;

        if (isLogin) {
            // LOGIN FLOW
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });
                const data = await res.json();

                if (res.ok) {
                    showMessage('Login successful! Redirecting...', 'success');
                    console.log('Token:', data.token);
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setTimeout(() => {
                        window.location.href = '/hi.html';
                    }, 1000);
                } else {
                    console.error('Login Failed:', data);
                    showMessage(data.message || 'Login failed', 'error');
                }
            } catch (error) {
                console.error('Login Error:', error);
                showMessage('An error occurred. Please try again.', 'error');
            }
        } else {
            // SIGNUP FLOW
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;

            if (!name || !email || !identifier || !password) {
                showMessage('Please fill in all fields', 'error');
                return;
            }

            // Force 10-digit mobile validation
            const mobileRegex = /^\d{10}$/;
            if (!mobileRegex.test(identifier)) {
                showMessage('Mobile number must be exactly 10 digits', 'error');
                return;
            }

            const payload = {
                name,
                whatsappNumber: identifier,
                email,
                password
            };
            console.log('Sending Signup Payload:', JSON.stringify(payload));

            try {
                const res = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                let data;
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    data = await res.json();
                } else {
                    const text = await res.text();
                    console.error('Non-JSON response:', text);
                    throw new Error(`Server Error: ${res.status} ${res.statusText}. Please restart the server.`);
                }

                if (res.ok) {
                    showMessage('Account created! Please login.', 'success');
                    // Switch to login view automatically after delay or manual
                    setTimeout(() => {
                        toggleLink.click();
                    }, 1500);
                } else {
                    console.error('Signup Failed:', data);
                    showMessage(data.message || 'Signup failed', 'error');
                }
            } catch (error) {
                console.error('Signup Error:', error);
                showMessage('An error occurred. Please try again.', 'error');
            }
        }
    });



    function showMessage(msg, type) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');
    }

    function clearMessage() {
        messageDiv.textContent = '';
        messageDiv.classList.add('hidden');
    }

    // --- Forgot Password Logic ---
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const backToLogin = document.getElementById('back-to-login');
    const resetRequestForm = document.getElementById('resetRequestForm');
    const resetBtn = document.getElementById('reset-btn');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none'; // logic from line 2 implies login-form is the container for authForm
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
        resetRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reset-email').value;

            if (!email) {
                showMessage('Please enter your email', 'error');
                return;
            }

            resetBtn.disabled = true;
            resetBtn.textContent = 'Sending...';
            clearMessage();

            try {
                const res = await fetch('/api/forgot-password', {
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
            } catch (error) {
                console.error('Reset Request Error:', error);
                showMessage('An error occurred. Please try again.', 'error');
            } finally {
                resetBtn.disabled = false;
                resetBtn.textContent = 'Send Reset Link';
            }
        });
    }

    // Toggle Password Visibility
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('login-password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            // Toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Toggle the eye / eye slash icon
            this.classList.toggle('bi-eye');
            this.classList.toggle('bi-eye-slash');
        });
    }
});
