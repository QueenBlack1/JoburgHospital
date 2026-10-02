const Auth = {
  CURRENT_USER_KEY: 'joburg_current_user',

  async register(userData) {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: userData.role,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phone: userData.phone || null,
          password: userData.password,
          idNumber: userData.idNumber || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || data.error || 'Registration failed.'
        };
      }

      return data;
    } catch (err) {
      console.error('Register error:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  },

  async login(email, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success && data.user) {
        localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data.user));
      }

      return data;
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Network error. Please try again.' };
    }
  },

  getCurrentUser() {
    const user = localStorage.getItem(this.CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  logout() {
    localStorage.removeItem(this.CURRENT_USER_KEY);
    window.location.href = 'login.html';
  },

  requireAuth(redirectTo = 'login.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirectTo;
    }
  },

  redirectIfLoggedIn() {
    const user = this.getCurrentUser();
    if (user) {
      this.redirectByRole(user.role);
    }
  },

  redirectByRole(role) {
    const r = (role || '').toLowerCase();

    switch (r) {
      case 'admin':
      case 'administrator':
        window.location.href = 'admin-dashboard.html';
        break;
      case 'doctor':
        window.location.href = 'doctor-dashboard.html';
        break;
      case 'pharmacist':
        window.location.href = 'pharmacist-dashboard.html';
        break;
      case 'patient':
      default:
        window.location.href = 'patient-dashboard.html';
        break;
    }
  }
};

window.Auth = Auth;