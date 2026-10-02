document.addEventListener('DOMContentLoaded', () => {
  if (typeof Auth !== 'undefined' && Auth.redirectIfLoggedIn) {
    Auth.redirectIfLoggedIn();
  }

  const form = document.getElementById('registerForm');
  const formContainer = document.getElementById('registerFormContainer');
  const successMessage = document.getElementById('successMessage');
  const registeredEmail = document.getElementById('registeredEmail');

  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function showError(input, errorId, message) {
    if (input) input.classList.add('error');
    const el = document.getElementById(errorId);
    if (el) el.textContent = message;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isValid = true;

    const role = document.getElementById('role');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('registerEmail');
    const phone = document.getElementById('phone');
    const idNumber = document.getElementById('idNumber');
    const password = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const terms = document.getElementById('terms');

    [role, firstName, lastName, email, phone, idNumber, password, confirmPassword].forEach(el => {
      if (el) el.classList.remove('error');
    });
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

    if (!role.value) {
      showError(role, 'roleError', 'Please select a role');
      isValid = false;
    }

    if (!firstName.value.trim()) {
      showError(firstName, 'firstNameError', 'First name is required');
      isValid = false;
    }

    if (!lastName.value.trim()) {
      showError(lastName, 'lastNameError', 'Last name is required');
      isValid = false;
    }

    if (!email.value.trim()) {
      showError(email, 'registerEmailError', 'Email is required');
      isValid = false;
    } else if (!isValidEmail(email.value)) {
      showError(email, 'registerEmailError', 'Please enter a valid email address');
      isValid = false;
    }

    if (!phone.value.trim()) {
      showError(phone, 'phoneError', 'Phone number is required');
      isValid = false;
    }

    if (role.value === 'patient') {
      if (!idNumber.value.trim() || idNumber.value.trim().length < 6) {
        showError(idNumber, 'idNumberError', 'A valid ID number is required for patients');
        isValid = false;
      }
    }

    if (!password.value.trim()) {
      showError(password, 'registerPasswordError', 'Password is required');
      isValid = false;
    } else if (password.value.length < 8) {
      showError(password, 'registerPasswordError', 'Password must be at least 8 characters');
      isValid = false;
    }

    if (password.value !== confirmPassword.value) {
      showError(confirmPassword, 'confirmPasswordError', 'Passwords do not match');
      isValid = false;
    }

    if (!terms.checked) {
      document.getElementById('termsError').textContent = 'You must agree to the terms';
      isValid = false;
    }

    if (!isValid) return;

    const btn = document.getElementById('registerBtn');
    const originalBtnContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    btn.disabled = true;

    const payload = {
      role: role.value,
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      password: password.value,
      idNumber: role.value === 'patient' ? idNumber.value.trim() : null
    };

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        formContainer.style.display = 'none';
        successMessage.style.display = 'block';
        registeredEmail.textContent = email.value.trim();
      } else {
        showError(email, 'registerEmailError', data.message || 'Registration failed');
        btn.innerHTML = originalBtnContent;
        btn.disabled = false;
      }
    } catch (err) {
      console.error('Registration error:', err);
      showError(email, 'registerEmailError', 'Network error. Please try again.');
      btn.innerHTML = originalBtnContent;
      btn.disabled = false;
    }
  });
});