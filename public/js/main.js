// ================================================================
// FUTURISTIC ANIMATIONS & INTERACTIONS
// ================================================================

function addToCart(productId, quantity = 1) {
  const btn = event.currentTarget;
  createRipple(btn, event);

  fetch('/api/cart/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, quantity: quantity })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Product added to cart!', 'success');
      updateCartBadge(data.cartCount);
      pulseNavbar();
      createFloatingParticle(btn);
    } else {
      showToast(data.error || 'Failed to add to cart', 'error');
    }
  })
  .catch(() => showToast('Something went wrong', 'error'));
}

function removeFromCart(productId) {
  fetch('/api/cart/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Item removed from cart', 'success');
      updateCartBadge(data.cartCount);
    }
  })
  .catch(() => showToast('Something went wrong', 'error'));
}

function updateCartItem(productId, quantity) {
  fetch('/api/cart/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, quantity: quantity })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      updateCartBadge(data.cartCount);
      location.reload();
    }
  })
  .catch(() => showToast('Something went wrong', 'error'));
}

function updateCartBadge(count) {
  const badges = document.querySelectorAll('.cart-count, .cart-badge');
  badges.forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
    // Pop animation
    badge.style.transform = 'scale(1.4)';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
  });
}

function pulseNavbar() {
  const nav = document.querySelector('.navbar');
  if (nav) {
    nav.style.borderBottomColor = 'var(--primary)';
    nav.style.boxShadow = '0 0 30px rgba(201,169,110,0.15)';
    setTimeout(() => {
      nav.style.borderBottomColor = '';
      nav.style.boxShadow = '';
    }, 800);
  }
}

// ---- RIPPLE EFFECT ----
function createRipple(element, event) {
  const circle = document.createElement('span');
  const diameter = Math.max(element.clientWidth, element.clientHeight);
  const radius = diameter / 2;
  const rect = element.getBoundingClientRect();

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add('ripple-effect');

  const existingRipple = element.querySelector('.ripple-effect');
  if (existingRipple) existingRipple.remove();

  element.appendChild(circle);
  setTimeout(() => circle.remove(), 600);
}

// ---- FLOATING PARTICLE ----
function createFloatingParticle(element) {
  const particle = document.createElement('div');
  particle.style.cssText = `
    position: fixed;
    width: 6px;
    height: 6px;
    background: var(--primary);
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 0 10px var(--primary);
  `;

  const rect = element.getBoundingClientRect();
  particle.style.left = `${rect.left + rect.width / 2}px`;
  particle.style.top = `${rect.top + rect.height / 2}px`;

  document.body.appendChild(particle);

  const angle = Math.random() * Math.PI * 2;
  const distance = 60 + Math.random() * 40;
  const dx = Math.cos(angle) * distance;
  const dy = -Math.abs(Math.sin(angle) * distance) - 30;

  particle.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
  ], {
    duration: 700,
    easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)'
  }).onfinish = () => particle.remove();
}

// ---- TOAST ----
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ================================================================
// INITIALIZATION
// ================================================================
document.addEventListener('DOMContentLoaded', () => {

  // ---- NAVBAR SCROLL ----
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.style.boxShadow = window.scrollY > 50
        ? '0 4px 30px rgba(0,0,0,0.4), 0 0 40px rgba(201,169,110,0.05)'
        : 'none';
    });
  }

  // ---- SCROLL REVEAL WITH STAGGER ----
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.product-card, .feature-card, .about-card, .founder-card, .value-card, .contact-card, .section-header, .stat-card, .category-item').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) ${(i % 5) * 0.08}s, transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) ${(i % 5) * 0.08}s`;
    revealObserver.observe(el);
  });

  // Add revealed class styles
  const style = document.createElement('style');
  style.textContent = `.revealed { opacity: 1 !important; transform: translateY(0) !important; }`;
  document.head.appendChild(style);

  // ---- PARALLAX ON HERO ----
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        heroBg.style.transform = `translateY(${scrolled * 0.35}px)`;
      }
    });
  }

  // ---- 3D TILT ON PRODUCT CARDS ----
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 25;
      const rotateY = (centerX - x) / 25;
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.02)`;
      card.style.boxShadow = `${-rotateY * 2}px ${rotateX * 2}px 40px rgba(0,0,0,0.3), 0 0 40px rgba(201,169,110,0.08)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
  });

  // ---- MAGNETIC EFFECT ON BUTTONS ----
  document.querySelectorAll('.btn-primary, .btn-glow').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px) translateY(-3px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // ---- TYPED EFFECT ON HERO BADGE (if exists) ----
  const heroBadge = document.querySelector('.hero-badge');
  if (heroBadge) {
    const text = heroBadge.textContent;
    heroBadge.textContent = '';
    heroBadge.style.borderRight = '2px solid var(--primary)';
    let i = 0;
    const typeInterval = setInterval(() => {
      heroBadge.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(typeInterval);
        setTimeout(() => { heroBadge.style.borderRight = 'none'; }, 1000);
      }
    }, 50);
  }

  // ---- COUNTER ANIMATION FOR STATS ----
  document.querySelectorAll('.stat-info h3').forEach(stat => {
    const text = stat.textContent;
    const match = text.match(/[\d,]+/);
    if (match) {
      const target = parseInt(match[0].replace(/,/g, ''));
      const prefix = text.substring(0, text.indexOf(match[0]));
      const suffix = text.substring(text.indexOf(match[0]) + match[0].length);
      let current = 0;
      const step = Math.max(1, Math.floor(target / 40));
      const interval = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        stat.textContent = prefix + current.toLocaleString() + suffix;
      }, 30);
    }
  });

  // ---- CURSOR GLOW ----
  if (window.matchMedia('(pointer: fine)').matches) {
    const cursorGlow = document.createElement('div');
    cursorGlow.id = 'cursorGlow';
    cursorGlow.style.cssText = `
      position: fixed;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle, rgba(201,169,110,0.35) 0%, transparent 70%);
      transform: translate(-50%, -50%);
      z-index: 9998;
      transition: opacity 0.4s;
      will-change: left, top;
    `;
    document.body.appendChild(cursorGlow);

    let mx = 0, my = 0, gx = 0, gy = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    (function animateGlow() {
      gx += (mx - gx) * 0.08;
      gy += (my - gy) * 0.08;
      cursorGlow.style.left = gx + 'px';
      cursorGlow.style.top = gy + 'px';
      requestAnimationFrame(animateGlow);
    })();
  }

  // ---- SMOOTH SCROLL FOR ANCHOR LINKS ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---- STAGGER REVEAL FOR GRID ITEMS ----
  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 60);
        staggerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.products-grid .product-card, .categories-grid .category-tile').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(25px)';
    el.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
    staggerObserver.observe(el);
  });

  // ---- NAVBAR GLOW ON SCROLL ----
  const nav = document.querySelector('.navbar');
  if (nav) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      if (scrollY > 100) {
        nav.style.borderBottomColor = 'rgba(201,169,110,0.12)';
        nav.style.boxShadow = '0 4px 40px rgba(0,0,0,0.5), 0 0 30px rgba(201,169,110,0.04)';
      } else {
        nav.style.borderBottomColor = '';
        nav.style.boxShadow = '';
      }
      lastScroll = scrollY;
    });
  }

  // ---- TILT EFFECT ON CATEGORY TILES ----
  document.querySelectorAll('.category-tile').forEach(tile => {
    tile.addEventListener('mousemove', (e) => {
      const rect = tile.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 30;
      const rotateY = (centerX - x) / 30;
      tile.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)`;
    });
    tile.addEventListener('mouseleave', () => {
      tile.style.transform = '';
    });
  });

  // ---- FLOATING PARTICLES IN HERO ----
  const hero = document.querySelector('.hero');
  if (hero) {
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: ${2 + Math.random() * 3}px;
        height: ${2 + Math.random() * 3}px;
        background: rgba(201,169,110,${0.15 + Math.random() * 0.2});
        border-radius: 50%;
        pointer-events: none;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation: floatParticle ${5 + Math.random() * 10}s ease-in-out infinite;
        animation-delay: ${Math.random() * 5}s;
      `;
      hero.appendChild(particle);
    }
    const floatStyle = document.createElement('style');
    floatStyle.textContent = `
      @keyframes floatParticle {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
        25% { transform: translate(${20 + Math.random() * 30}px, -${20 + Math.random() * 30}px) scale(1.2); opacity: 0.6; }
        50% { transform: translate(-${10 + Math.random() * 20}px, ${10 + Math.random() * 20}px) scale(0.8); opacity: 0.4; }
        75% { transform: translate(${10 + Math.random() * 20}px, -${10 + Math.random() * 20}px) scale(1.1); opacity: 0.5; }
      }
    `;
    document.head.appendChild(floatStyle);
  }

  // ---- TEXT GRADIENT ANIMATION ON HERO H1 ----
  const heroH1 = document.querySelector('.hero h1');
  if (heroH1) {
    heroH1.addEventListener('mouseenter', () => {
      heroH1.style.animationPlayState = 'paused';
    });
    heroH1.addEventListener('mouseleave', () => {
      heroH1.style.animationPlayState = 'running';
    });
  }

  // ---- RIPPLE ON ALL BUTTONS ----
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        transform: translate(-50%, -50%);
        pointer-events: none;
        left: ${e.clientX - rect.left}px;
        top: ${e.clientY - rect.top}px;
        animation: rippleExpand 0.6s ease-out forwards;
      `;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `
    @keyframes rippleExpand {
      to { width: 300px; height: 300px; opacity: 0; }
    }
  `;
  document.head.appendChild(rippleStyle);
});
