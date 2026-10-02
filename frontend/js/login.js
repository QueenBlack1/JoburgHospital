document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector('i');
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        if (icon) icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });

  const form = document.getElementById('loginForm');
  if (!form) {
    console.error('loginForm not found');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const emailError = document.getElementById('loginEmailError');
    const passwordError = document.getElementById('loginPasswordError');
    const btn = document.getElementById('loginBtn');

    if (emailError) emailError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    emailInput?.classList.remove('error');
    passwordInput?.classList.remove('error');

    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    let isValid = true;

    if (!email) {
      if (emailError) emailError.textContent = 'Email is required';
      emailInput?.classList.add('error');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailError) emailError.textContent = 'Please enter a valid email';
      emailInput?.classList.add('error');
      isValid = false;
    }

    if (!password) {
      if (passwordError) passwordError.textContent = 'Password is required';
      passwordInput?.classList.add('error');
      isValid = false;
    }

    if (!isValid) return;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    }

    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success && data.user) {
        localStorage.setItem('joburg_current_user', JSON.stringify(data.user));

        const role = String(data.user.role || '').trim().toLowerCase();

        switch (role) {
          case 'admin':
          case 'administrator':
            window.location.href = '/admin-dashboard';
            break;
          case 'doctor':
            window.location.href = '/doctor-dashboard';
            break;
          case 'pharmacist':
            window.location.href = '/pharmacist-dashboard';
            break;
          case 'patient':
            window.location.href = '/patient-dashboard';
            break;
          default:
            console.error('Unknown or missing user role:', data.user.role);
            localStorage.removeItem('joburg_current_user');
            if (passwordError) {
              passwordError.textContent =
                'Your account role could not be identified. Please contact the administrator.';
            }
            passwordInput?.classList.add('error');
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
            }
            break;
        }
      } else {
        if (passwordError) {
          passwordError.textContent = data.message || 'Invalid email or password';
        }
        passwordInput?.classList.add('error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      if (passwordError) {
        passwordError.textContent = 'Cannot connect to server. Is the backend running?';
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
      }
    }
  });
});