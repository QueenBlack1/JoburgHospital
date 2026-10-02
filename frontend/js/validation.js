const Validation = {
  isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase().trim());
  },

  isStrongPassword(password) {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return re.test(password);
  },

  isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const re = /^(\+27|0)[6-8][0-9]{8}$/;
    return re.test(cleaned);
  },

  isValidName(name) {
    return name.trim().length >= 2 && /^[a-zA-Z\s\-']+$/.test(name.trim());
  },

  isValidRole(role) {
    const allowedRoles = ['patient', 'doctor', 'administrator', 'pharmacist'];
    return allowedRoles.includes(role);
  },

  validateRegistration(data) {
    const errors = {};

    if (!this.isValidRole(data.role)) {
      errors.role = 'Please select a valid role';
    }

    if (!this.isValidName(data.firstName)) {
      errors.firstName = 'First name must be at least 2 characters and contain only letters';
    }

    if (!this.isValidName(data.lastName)) {
      errors.lastName = 'Last name must be at least 2 characters and contain only letters';
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!data.phone || !this.isValidPhone(data.phone)) {
      errors.phone = 'Please enter a valid South African phone number';
    }

    if (!data.password) {
      errors.password = 'Password is required';
    } else if (!this.isStrongPassword(data.password)) {
      errors.password = 'Password must be at least 8 characters and include uppercase, lowercase and a number';
    }

    if (data.password !== data.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!data.terms) {
      errors.terms = 'You must agree to the Terms and Privacy Policy';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  validateLogin(email, password) {
    const errors = {};

    if (!email || !this.isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password || password.length < 6) {
      errors.password = 'Password is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

window.Validation = Validation;