(() => {
  'use strict';
  
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================
     1. إدارة الثيم (الوضع الداكن والفاتح)
     ================================---------- */
  const themeBtn = $('#theme');
  const saved = () => { 
    try { 
      return localStorage.getItem('theme'); 
    } catch { 
      return null; 
    } 
  };

  function applyTheme(mode, persist) {
    root.dataset.theme = mode;
    if (themeBtn) { 
      themeBtn.innerHTML = mode === 'dark' 
        ? '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>' 
        : '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'; 
      themeBtn.setAttribute('aria-pressed', mode === 'dark'); 
    }
    if (persist) { 
      try { 
        localStorage.setItem('theme', mode); 
      } catch {} 
    }
  }

  applyTheme(saved() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);
  
  if (themeBtn) {
    themeBtn.onclick = () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  }

  /* ==========================================
     2. تأثير الهيدر وزر العودة للأعلى
     ================================---------- */
  const nav = $('header.nav');
  const toTop = $('#toTop');

  const onScroll = () => { 
    if (nav) nav.classList.toggle('scrolled', scrollY > 20); 
    if (toTop) toTop.classList.toggle('show', scrollY > 500); 
  };

  addEventListener('scroll', onScroll, { passive: true }); 
  onScroll();

  /* ==========================================
     3. القائمة الجانبية للشاشات الصغيرة (Mobile Menu)
     ================================---------- */
  const btn = $('#menuBtn');
  
  const setMenu = open => { 
    if (!nav || !btn) return; 
    nav.classList.toggle('open', open); 
    btn.setAttribute('aria-expanded', open); 
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); 
  };

  if (btn) {
    btn.onclick = () => setMenu(!nav.classList.contains('open'));
    addEventListener('keydown', e => { 
      if (e.key === 'Escape') setMenu(false); 
    });
    document.addEventListener('click', e => { 
      if (!nav.contains(e.target)) setMenu(false); 
    });
  }

  /* ==========================================
     4. عدادات الأرقام وتأثيرات الظهور (Counters & Reveal)
     ================================---------- */
  const count = el => {
    const n = +el.dataset.n;
    const suf = el.dataset.s || '';
    const fmt = v => v.toLocaleString('en-US') + suf;

    if (reduce) { 
      el.textContent = fmt(n); 
      return; 
    }

    const t0 = performance.now();
    (function tick(t) { 
      const p = Math.min((t - t0) / 1400, 1); 
      el.textContent = fmt(Math.round(n * (1 - (1 - p) ** 3))); 
      if (p < 1) requestAnimationFrame(tick); 
    })(t0);
  };

  const targets = $$('[data-n]');
  const rev = $$('.sr');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return; 
      io.unobserve(en.target);
      en.target.hasAttribute('data-n') ? count(en.target) : en.target.classList.add('seen');
    }), { threshold: .2 });

    targets.forEach(e => io.observe(e)); 
    rev.forEach(e => io.observe(e));
  } else { 
    targets.forEach(count); 
    rev.forEach(e => e.classList.add('seen')); 
  }

  /* ==========================================
     5. التحقق من حالة تسجيل الدخول للزوار
     ================================---------- */
  try { 
    if (sessionStorage.getItem('circutech_session')) { 
      const lg = $('.btn-sm.login'); 
      if (lg) { 
        lg.textContent = 'My CircuTech'; 
        lg.href = lg.href.replace('loginpage/login.html', 'apppage/app.html'); 
      } 
    } 
  } catch {}

  /* تحديث السنة تلقائياً في التذييل */
  const y = $('#year'); 
  if (y) y.textContent = new Date().getFullYear();

  /* ==========================================
     6. نموذج الاتصال (Contact Form Handler)
     ================================---------- */
  const CONTACT_ENDPOINT = '';
  const form = $('#contactForm');

  if (form) {
    const out = $('#formMsg');
    const f = form.elements;
    
    const say = (t, ok) => { 
      out.textContent = t; 
      out.className = 'form-msg ' + (ok ? 'ok' : 'err'); 
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      [f.name, f.email, f.message].forEach(i => i.removeAttribute('aria-invalid'));
      
      const d = { 
        name: f.name.value.trim(), 
        email: f.email.value.trim(), 
        message: f.message.value.trim() 
      };
      
      let bad = null, msg = '';
      if (!d.name) { 
        bad = f.name; 
        msg = 'Enter your name.'; 
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { 
        bad = f.email; 
        msg = 'Enter a valid email address.'; 
      } else if (d.message.length < 10) { 
        bad = f.message; 
        msg = 'Write a message of at least 10 characters.'; 
      }

      if (bad) { 
        bad.setAttribute('aria-invalid', 'true'); 
        bad.focus(); 
        say(msg, false); 
        return; 
      }

      const b = $('button[type=submit]', form); 
      b.disabled = true; 
      say('Sending…', true);

      try {
        if (CONTACT_ENDPOINT) {
          const r = await fetch(CONTACT_ENDPOINT, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(d) 
          });
          if (!r.ok) throw 0; 
          say('Thank you. We will reply within two working days.', true);
        } else { 
          await new Promise(r => setTimeout(r, 600)); 
          say('Demo mode: your message was not sent. Connect an endpoint to go live.', true); 
        }
        form.reset();
      } catch { 
        say('Message not sent. Try again or email us directly.', false); 
      } finally { 
        b.disabled = false; 
      }
    });
  }
})();