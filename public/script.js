const BACKEND_URL = "https://fest-app-backend.onrender.com";

document.addEventListener('DOMContentLoaded', () => {

    // Expose Splash Functions Globally
    window.showSplash = () => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.remove('fade-out');
            splash.style.display = 'flex';
            splash.style.visibility = 'visible';
            splash.style.opacity = '1';
        }
    };

    window.dismissSplash = () => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.style.display = 'none';
            }, 800);
        }
    };

    initBackgroundAnimation();
    initSplashScreen();

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

            // Show Splash
            window.showSplash();

            try {
                const res = await fetch(`${BACKEND_URL}/api/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, whatsappNumber: identifier, email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    window.dismissSplash(); // Dismiss
                    showMessage(signupMessage, 'Success! Redirecting to login...', 'success');
                    setTimeout(() => {
                        showLoginBtn.click();
                    }, 1500);
                } else {
                    window.dismissSplash(); // Dismiss
                    showMessage(signupMessage, data.message || 'Signup failed', 'error');
                }
            } catch (err) {
                console.error(err);
                window.dismissSplash(); // Dismiss
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
            const loginBtn = authLoginForm.querySelector('button');

            // 1. Show Loading State (Splash)
            window.showSplash();

            try {
                const res = await fetch(`${BACKEND_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                const data = await res.json();

                if (res.ok) {
                    // Success
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    // Redirect
                    window.location.href = '/hi.html';
                } else {
                    // Error
                    window.dismissSplash();
                    throw new Error(data.message || 'Invalid Credentials');
                }
            } catch (err) {
                console.error(err);
                window.dismissSplash();

                // Show Error on Button (Legacy UX, kept for backup)
                loginBtn.textContent = err.message || 'Invalid Credentials';
                loginBtn.style.background = 'linear-gradient(135deg, #ff4444, #cc0000)'; // Reddish hint

                setTimeout(() => {
                    loginBtn.textContent = 'Enter Void';
                    loginBtn.style.background = '';
                }, 3000);
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

    function initBackgroundAnimation() {
        const container = document.getElementById('background-animation');
        if (!container) return;

        // Clear existing shapes
        container.innerHTML = '';

        const colors = ['#0ef', '#ff00ff', '#00ff9d']; // Cyan, Magenta, Green
        const shapes = ['shape-circle', 'shape-square', 'shape-triangle'];

        // Mobile Optimization: Fewer shapes for professional look on small screens
        const isMobile = window.innerWidth < 768;
        const numShapes = isMobile ? 8 : 20;

        // Initial spawn
        for (let i = 0; i < numShapes; i++) {
            spawnShape(container, colors, shapes, true);
        }
    }

    function spawnShape(container, colors, shapes, initial = false) {
        const el = document.createElement('div');
        el.classList.add('geo-shape');

        const shapeType = shapes[Math.floor(Math.random() * shapes.length)];
        el.classList.add(shapeType);

        const color = colors[Math.floor(Math.random() * colors.length)];
        el.style.color = color;

        // Size: 40px to 100px
        const size = Math.floor(Math.random() * 60) + 40;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;

        // Handle SVG Triangle for hollow look
        if (shapeType === 'shape-triangle') {
            el.innerHTML = `<svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;">
                <polygon points="50,5 95,95 5,95" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round" />
            </svg>`;
            el.style.border = 'none';
        }

        container.appendChild(el);

        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const offset = 200;

        // 0: Top, 1: Right, 2: Bottom, 3: Left
        let startSide = Math.floor(Math.random() * 4);
        let endSide = (startSide + 2) % 4; // Opposite side 

        // Randomize end side slightly
        if (Math.random() > 0.6) endSide = (endSide + 1) % 4;


        const getCoords = (side) => {
            let x, y;
            switch (side) {
                case 0: // Top
                    x = Math.random() * viewportW;
                    y = -offset;
                    break;
                case 1: // Right
                    x = viewportW + offset;
                    y = Math.random() * viewportH;
                    break;
                case 2: // Bottom
                    x = Math.random() * viewportW;
                    y = viewportH + offset;
                    break;
                case 3: // Left
                    x = -offset;
                    y = Math.random() * viewportH;
                    break;
            }
            return { x, y };
        };

        let start = getCoords(startSide);
        let end = getCoords(endSide);

        if (initial) {
            start.x = Math.random() * viewportW;
            start.y = Math.random() * viewportH;
        }

        // Speed: 4s to 8s
        const duration = (Math.random() * 4000) + 4000;

        const rotationStart = Math.random() * 360;
        const rotationEnd = rotationStart + (Math.random() > 0.5 ? 180 : -180);

        const animation = el.animate([
            { transform: `translate(${start.x}px, ${start.y}px) rotate(${rotationStart}deg)` },
            { transform: `translate(${end.x}px, ${end.y}px) rotate(${rotationEnd}deg)` }
        ], {
            duration: duration,
            easing: 'linear',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            el.remove();
            spawnShape(container, colors, shapes);
        };
    }

    function initSplashScreen() {
        const splash = document.getElementById('splash-screen');
        const sentenceEl = document.getElementById('loading-sentence');
        if (!splash || !sentenceEl) return;

        const sentences = [
            "Igniting the Fest Spirit...",
            "Waking up the server...",
            "Rolling out the red carpet...",
            "Preparing the main stage...",
            "Tuning the instruments...",
            "Spotlight is warming up..."
        ];

        let sentenceIndex = 0;

        // Rotate Sentences every 2 seconds
        const textInterval = setInterval(() => {
            if (splash.style.display !== 'none') {
                sentenceEl.style.opacity = 0;
                setTimeout(() => {
                    sentenceIndex = (sentenceIndex + 1) % sentences.length;
                    sentenceEl.textContent = sentences[sentenceIndex];
                    sentenceEl.style.opacity = 1;
                }, 500);
            }
        }, 2500);

        // Ping Backend Loop
        const startTime = Date.now();
        const minDisplayTime = 2000;
        let isDismissed = false;

        const pingBackend = async () => {
            if (isDismissed) return;

            try {
                // We use a timeout signal for the fetch itself so we don't hang forever on one request
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s per request

                const res = await fetch(`${BACKEND_URL}/api/config`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    // Backend is Awake!
                    const elapsedTime = Date.now() - startTime;
                    const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

                    setTimeout(() => {
                        dismissSplash();
                    }, remainingTime);
                } else {
                    throw new Error('Backend responded but not ready');
                }
            } catch (err) {
                console.log("Waiting for backend...", err.message);
                // Retry after 2 seconds
                setTimeout(pingBackend, 2000);
            }
        };

        // Start Pinging
        pingBackend();

        // Safety Force Dismiss after 60 seconds (Render usually wakes up in 30-50s)
        setTimeout(() => {
            if (!isDismissed) {
                console.warn("Backend wake up timeout - forcing entry");
                dismissSplash();
            }
        }, 60000);

        function dismissSplash() {
            if (isDismissed) return;
            isDismissed = true;

            clearInterval(textInterval);
            splash.classList.add('fade-out');

            setTimeout(() => {
                splash.style.display = 'none';
            }, 800);
        }
    }
});
