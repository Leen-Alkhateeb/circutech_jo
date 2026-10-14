
(() => {
  'use strict';

  // Configuration
  const CONFIG = {
    USE_BACKEND: false,

    ENDPOINTS: {
      register: '/api/auth/register',
      login: '/api/auth/login',
      adminLogin: '/api/admin/login'
    },

    REDIRECT_AFTER_LOGIN: '../apppage/app.html',
    REDIRECT_AFTER_ADMIN_LOGIN: '../apppage/app.html#adminOverview',

    MAX_ATTEMPTS: 5,
    LOCK_SECONDS: 30
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  // Validation
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^(?:\+962|00962|0)7[789]\d{7}$/;
  const NAME_RE = /^\p{L}[\p{L}\p{M} .'-]{1,59}$/u;

  const COMMON_PASSWORDS = [
    'password', 'password1', 'password123',
    '12345678', '123456789', '1234567890',
    'qwerty123', 'qwertyuiop', 'iloveyou',
    'admin123', 'letmein123', 'abc12345',
    '11111111'
  ];

  function analysePassword(password, context = {}) {
    const rules = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password)
    };

    let score = Object.values(rules).filter(Boolean).length;

    if (password.length >= 12) score++;

    const lower = password.toLowerCase();
    const emailName = (context.email || '').split('@')[0].toLowerCase();

    const fullName = (context.name || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);

    const isCommon =
      COMMON_PASSWORDS.includes(lower) ||
      /^(password|qwerty|admin)/.test(lower);

    const hasRepeat = /(.)\1{2,}/.test(password);

    const hasSeq =
      /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef)/i
        .test(password);

    const hasPersonal =
      (emailName.length >= 3 && lower.includes(emailName)) ||
      fullName.some(word => lower.includes(word));

    if (hasRepeat) score--;
    if (hasSeq) score--;
    if (hasPersonal) score = Math.min(score, 2);
    if (isCommon) score = Math.min(score, 1);

    score = Math.max(0, Math.min(score, 6));

    let level = 0;

    if (password.length) {
      if (score <= 2) level = 1;
      else if (score === 3) level = 2;
      else if (score === 4) level = 3;
      else level = 4;
    }

    const meetsRequired =
      rules.length && rules.upper && rules.lower && rules.number;

    return {
      rules,
      level,
      isCommon,
      hasPersonal,
      meetsRequired
    };
  }

  const LEVEL_TEXT = [
    'Password strength',
    'Weak',
    'Fair',
    'Good',
    'Strong'
  ];

  const validators = {
    required: value =>
      value ? '' : 'This field is required.',

    name: value => {
      value = value.trim();

      if (!value) return 'Full name is required.';

      return NAME_RE.test(value)
        ? ''
        : 'Use letters only (2–60 characters).';
    },

    email: value => {
      value = value.trim();

      if (!value) return 'Email is required.';

      return EMAIL_RE.test(value)
        ? ''
        : 'Enter a valid email address.';
    },

    phone: value => {
      value = value.replace(/[\s-]/g, '');

      if (!value) return '';

      return PHONE_RE.test(value)
        ? ''
        : 'Use a Jordanian mobile, e.g. 0791234567.';
    },

    newPassword: (value, form) => {
      if (!value) return 'Password is required.';

      const result = analysePassword(value, {
        email: form.elements.email.value,
        name: form.elements.name
          ? form.elements.name.value
          : ''
      });

      if (!result.meetsRequired) {
        return 'Password does not meet all the requirements.';
      }

      if (result.isCommon) {
        return 'This password is too common. Choose another one.';
      }

      if (result.hasPersonal) {
        return 'Do not use your name or email in the password.';
      }

      return '';
    },

    confirm: (value, form) => {
      if (!value) return 'Please confirm your password.';

      return value === form.elements.password.value
        ? ''
        : 'Passwords do not match.';
    },

    terms: (_value, form) =>
      form.elements.terms.checked
        ? ''
        : 'You must accept the terms to continue.'
  };

  // Field Helpers
  function setError(input, message) {
    const field = input.closest('.field');
    const output = field ? $('.field-error', field) : null;

    if (output) output.textContent = message;

    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateField(input) {
    const rule = input.dataset.validate;

    if (!rule || !validators[rule]) return true;

    const message = validators[rule](input.value, input.form);

    setError(input, message);

    return !message;
  }

  function showStatus(form, type, message) {
    const element = $('.form-status', form);

    if (!element) return;

    element.className =
      'form-status' + (message ? ' ' + type : '');

    element.textContent = message || '';
  }

  function setLoading(form, loading) {
    const button = $('.auth-submit', form);

    if (!button) return;

    button.disabled = loading;
    button.classList.toggle('loading', loading);
  }

  function validateForm(form) {
    const inputs = $$('[data-validate]', form);

    const results = inputs.map(input => ({
      input,
      valid: validateField(input)
    }));

    const firstInvalid = results.find(result => !result.valid);

    if (firstInvalid) firstInvalid.input.focus();

    return !firstInvalid;
  }

  // Demo Storage for Regular Users
  const USERS_KEY = 'circutech_demo_users';

  const readUsers = () => {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch {
      return [];
    }
  };

  const writeUsers = users => {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {
      // Storage may be unavailable.
    }
  };

  async function sha256(value) {
    if (!window.crypto?.subtle) {
      throw new Error('Secure password hashing is unavailable.');
    }

    const buffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value)
    );

    return [...new Uint8Array(buffer)]
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  const demoApi = {
    async register({ name, email, phone, password }) {
      const users = readUsers();

      if (users.some(user => user.email === email)) {
        return {
          ok: false,
          field: 'email',
          message: 'This email is already registered.'
        };
      }

      const hash = await sha256(email + ':' + password);

      users.push({
        name,
        email,
        phone,
        hash,
        createdAt: Date.now()
      });

      writeUsers(users);

      return {
        ok: true,
        user: { name, email }
      };
    },

    async login({ email, password }) {
      const user = readUsers().find(
        item => item.email === email
      );

      const hash = await sha256(email + ':' + password);

      if (!user || user.hash !== hash) {
        return {
          ok: false,
          message: 'Incorrect email or password.'
        };
      }

      return {
        ok: true,
        user: {
          name: user.name,
          email: user.email
        }
      };
    }
  };

  async function request(kind, payload) {
    if (!CONFIG.USE_BACKEND) {
      return demoApi[kind](payload);
    }

    try {
      const response = await fetch(CONFIG.ENDPOINTS[kind], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok !== false) {
        return { ...data, ok: true };
      }

      return {
        ok: false,
        message: data.message || 'Something went wrong.',
        field: data.field
      };
    } catch {
      return {
        ok: false,
        message: 'Cannot reach the server. Please try again.'
      };
    }
  }

  // Tabs: Login, Register and Admin
  const tabs = {
    login: $('#tabLogin'),
    register: $('#tabRegister'),
    admin: $('#tabAdmin')
  };

  const forms = {
    login: $('#loginForm'),
    register: $('#registerForm'),
    admin: $('#adminForm')
  };

  // Stop if the required HTML elements are missing.
  if (Object.values(tabs).some(tab => !tab) ||
      Object.values(forms).some(form => !form)) {
    console.error('Login HTML is missing a required tab or form.');
    return;
  }

  const hero = {
    login: [
      'Sign in',
      'Access the scanner, dashboard and rewards.'
    ],
    register: [
      'Create account',
      'Join CircuTech Jo and start earning green points.'
    ],
    admin: [
      'Admin Login',
      'Sign in to the administration portal.'
    ]
  };

  function showTab(name, updateHash = true) {
    if (!tabs[name] || !forms[name]) return;

    Object.keys(tabs).forEach(key => {
      const active = key === name;

      tabs[key].setAttribute(
        'aria-selected',
        String(active)
      );

      tabs[key].tabIndex = active ? 0 : -1;
      forms[key].hidden = !active;
    });

    $('#heroTitle').textContent = hero[name][0];
    $('#heroText').textContent = hero[name][1];

    document.title = hero[name][0] + ' | CircuTech Jo';

    if (updateHash) {
      history.replaceState(null, '', '#' + name);
    }
  }

  Object.entries(tabs).forEach(([name, button]) => {
    button.addEventListener('click', () => showTab(name));

    button.addEventListener('keydown', event => {
      if (
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowLeft'
      ) return;

      const names = Object.keys(tabs);
      const index = names.indexOf(name);
      const direction = event.key === 'ArrowRight' ? 1 : -1;

      const nextIndex =
        (index + direction + names.length) % names.length;

      const nextName = names[nextIndex];

      showTab(nextName);
      tabs[nextName].focus();
    });
  });

  $$('[data-switch]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();

      const destination = link.dataset.switch;

      if (tabs[destination]) showTab(destination);
    });
  });

  const initialTab = location.hash.replace('#', '');

  showTab(
    Object.hasOwn(tabs, initialTab) ? initialTab : 'login',
    false
  );

  // Show / Hide Password
  $$('.pw-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.toggle);

      if (!input) return;

      const show = input.type === 'password';

      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';

      button.setAttribute(
        'aria-label',
        show ? 'Hide password' : 'Show password'
      );
    });
  });

  // Live Validation
  $$('form [data-validate]').forEach(input => {
    let touched = false;

    const eventName =
      input.type === 'checkbox' ? 'change' : 'input';

    input.addEventListener('blur', () => {
      touched = true;
      validateField(input);
    });

    input.addEventListener(eventName, () => {
      if (touched || input.type === 'checkbox') {
        validateField(input);
      }
    });
  });

  // Password Strength Meter
  const registerForm = forms.register;
  const registerPassword = $('#regPassword');
  const meter = $('#pwMeter');
  const meterLabel = $('#pwLabel');

  function updateStrength() {
    if (!registerPassword || !meter || !meterLabel) return;

    const result = analysePassword(registerPassword.value, {
      email: registerForm.elements.email.value,
      name: registerForm.elements.name.value
    });

    $$('#pwHelp li').forEach(item => {
      item.classList.toggle(
        'ok',
        Boolean(result.rules[item.dataset.rule])
      );
    });

    meter.dataset.level = result.level;

    meterLabel.textContent = result.level
      ? 'Strength: ' + LEVEL_TEXT[result.level]
      : LEVEL_TEXT[0];

    const confirm = registerForm.elements.confirm;

    if (confirm.value) validateField(confirm);
  }

  registerPassword.addEventListener('input', updateStrength);
  registerForm.elements.email.addEventListener('input', updateStrength);
  registerForm.elements.name.addEventListener('input', updateStrength);

  // Session
  function startSession(user) {
    try {
      sessionStorage.setItem(
        'circutech_session',
        JSON.stringify(user)
      );

      sessionStorage.setItem('circutech_welcome', '1');
    } catch {
      // Session storage may be unavailable.
    }
  }

  // Register
  registerForm.addEventListener('submit', async event => {
    event.preventDefault();

    showStatus(registerForm, '', '');

    if (!validateForm(registerForm)) return;

    const fields = registerForm.elements;

    const payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim().toLowerCase(),
      phone: fields.phone.value.replace(/[\s-]/g, ''),
      password: fields.password.value
    };

    setLoading(registerForm, true);

    try {
      const result = await request('register', payload);

      if (!result.ok) {
        if (result.field && fields[result.field]) {
          setError(fields[result.field], result.message);
        } else {
          showStatus(registerForm, 'error', result.message);
        }

        return;
      }

      registerForm.reset();
      updateStrength();

      showStatus(
        registerForm,
        'success',
        'Account created! You can sign in now.'
      );

      setTimeout(() => {
        showTab('login');

        forms.login.elements.email.value = payload.email;
        forms.login.elements.password.focus();
      }, 1000);

    } catch {
      showStatus(
        registerForm,
        'error',
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(registerForm, false);
    }
  });

  // Regular User Login
  const loginForm = forms.login;

  let failedAttempts = 0;
  let lockedUntil = 0;

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();

    showStatus(loginForm, '', '');

    const wait = Math.ceil(
      (lockedUntil - Date.now()) / 1000
    );

    if (wait > 0) {
      showStatus(
        loginForm,
        'error',
        'Too many attempts. Try again in ' + wait + ' seconds.'
      );
      return;
    }

    if (!validateForm(loginForm)) return;

    const fields = loginForm.elements;

    const payload = {
      email: fields.email.value.trim().toLowerCase(),
      password: fields.password.value
    };

    setLoading(loginForm, true);

    try {
      const result = await request('login', payload);

      if (!result.ok) {
        failedAttempts++;

        if (failedAttempts >= CONFIG.MAX_ATTEMPTS) {
          lockedUntil = Date.now() + CONFIG.LOCK_SECONDS * 1000;
          failedAttempts = 0;

          showStatus(
            loginForm,
            'error',
            'Too many attempts. Try again in ' +
              CONFIG.LOCK_SECONDS + ' seconds.'
          );
        } else {
          showStatus(loginForm, 'error', result.message);
        }

        fields.password.value = '';
        fields.password.focus();

        return;
      }

      if (!result.user) {
        showStatus(
          loginForm,
          'error',
          'The server did not return user information.'
        );
        return;
      }

      failedAttempts = 0;

      startSession(result.user);

      showStatus(
        loginForm,
        'success',
        'Login successful. Redirecting...'
      );

      setTimeout(() => {
        location.href = CONFIG.REDIRECT_AFTER_LOGIN;
      }, 900);

    } catch {
      showStatus(
        loginForm,
        'error',
        'Cannot complete login. Please try again.'
      );
    } finally {
      setLoading(loginForm, false);
    }
  });

  // Admin Login
  const adminForm = forms.admin;

  adminForm.addEventListener('submit', async event => {
    event.preventDefault();

    showStatus(adminForm, '', '');

    const fields = adminForm.elements;
    const email = fields.email.value.trim().toLowerCase();
    const password = fields.password.value;

    if (!email || !password) {
      showStatus(
        adminForm,
        'error',
        'Please enter your email and password.'
      );
      return;
    }

    if (!EMAIL_RE.test(email)) {
      showStatus(
        adminForm,
        'error',
        'Enter a valid email address.'
      );
      return;
    }

    // Admin authentication requires a real backend.
    if (!CONFIG.USE_BACKEND) {
      showStatus(
        adminForm,
        'error',
        'Admin login requires a connected authentication server.'
      );
      return;
    }

    setLoading(adminForm, true);

    try {
      const response = await fetch(CONFIG.ENDPOINTS.adminLogin, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        showStatus(
          adminForm,
          'error',
          data.message || 'Invalid admin credentials.'
        );
        return;
      }

      if (!data.user || data.user.role !== 'admin') {
        showStatus(
          adminForm,
          'error',
          'Admin access denied.'
        );
        return;
      }

      showStatus(
        adminForm,
        'success',
        'Login successful. Redirecting...'
      );

      // The server must also protect the admin page and its APIs.
      location.href = CONFIG.REDIRECT_AFTER_ADMIN_LOGIN;

    } catch {
      showStatus(
        adminForm,
        'error',
        'Cannot reach the server. Please try again.'
      );
    } finally {
      setLoading(adminForm, false);
    }
  });

  // Demo Account for Regular Users
  const demoButton = $('#demoBtn');

  if (demoButton) {
    demoButton.addEventListener('click', async () => {
      const email = 'demo@circutech.jo';
      const password = 'Demo@1234';

      try {
        if (
          !CONFIG.USE_BACKEND &&
          !readUsers().some(user => user.email === email)
        ) {
          await demoApi.register({
            name: 'Demo User',
            email,
            phone: '',
            password
          });
        }

        loginForm.elements.email.value = email;
        loginForm.elements.password.value = password;

        loginForm.requestSubmit();

      } catch {
        showStatus(
          loginForm,
          'error',
          'Unable to prepare the demo account.'
        );
      }
    });
  }

})();
