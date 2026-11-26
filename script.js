/* ==========================================================================
   Hàm dùng chung: chạy khi DOM sẵn sàng
   ========================================================================== */
function phandanhReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

/* Hàm dùng chung: thêm class is-visible khi khối cuộn tới */
function phandanhReveal(selector, threshold, onReveal) {
  var blocks = document.querySelectorAll(selector);
  if (!blocks.length) return;

  function show(el) {
    if (el.classList.contains('is-visible')) return;
    el.classList.add('is-visible');
    if (onReveal) onReveal(el);
  }

  if (!('IntersectionObserver' in window)) {
    blocks.forEach(show);
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        show(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: threshold });

  blocks.forEach(function (el) { observer.observe(el); });
}


/* ==========================================================================
   0. TOPBAR – chuyển thông báo (nút trước/sau, tự chạy, vuốt)
   ========================================================================== */
phandanhReady(function () {
  document.querySelectorAll('.phandanh-topbar').forEach(function (root) {
    if (root.dataset.phandanhReady) return;
    root.dataset.phandanhReady = '1';

    var slides = root.querySelectorAll('.phandanh-topbar-slide');
    var prev = root.querySelector('.phandanh-topbar-prev');
    var next = root.querySelector('.phandanh-topbar-next');
    var track = root.querySelector('.phandanh-topbar-track');
    var total = slides.length;
    var current = 0;
    var timer = null;
    var delay = (parseFloat(root.dataset.autoplay) || 0) * 1000;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Chỉ có 1 thông báo thì ẩn nút
    if (total < 2) {
      prev.hidden = true;
      next.hidden = true;
      return;
    }

    slides.forEach(function (slide, i) {
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (i + 1) + ' / ' + total);
      if (i !== current) slide.setAttribute('aria-hidden', 'true');
    });

    function goTo(index, reverse) {
      index = (index + total) % total;
      if (index === current) return;

      root.classList.toggle('is-reverse', !!reverse);
      var old = slides[current];
      old.classList.remove('is-active');
      old.classList.add('is-leaving');
      old.setAttribute('aria-hidden', 'true');
      setTimeout(function () { old.classList.remove('is-leaving'); }, 450);

      slides[index].classList.add('is-active');
      slides[index].removeAttribute('aria-hidden');
      current = index;
    }

    function start() {
      stop();
      if (delay && !reduceMotion) {
        timer = setInterval(function () { goTo(current + 1, false); }, delay);
      }
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    prev.addEventListener('click', function () { goTo(current - 1, true); start(); });
    next.addEventListener('click', function () { goTo(current + 1, false); start(); });

    // Dừng khi rê chuột / đang focus vào thanh
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    // Phím mũi tên khi đang focus vào thanh
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') goTo(current - 1, true);
      if (e.key === 'ArrowRight') goTo(current + 1, false);
    });

    // Vuốt trên điện thoại
    var startX = null;
    track.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      stop();
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1), dx > 0);
      startX = null;
      start();
    }, { passive: true });

    // Tab bị ẩn thì tạm dừng
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    start();
  });
});


/* ==========================================================================
   1. MENU
   ========================================================================== */
(function () {
  class PhandanhMobileNavCarousel extends HTMLElement {
    connectedCallback() {
      this.wrapper = this.querySelector('.phandanh-mobile-nav-carousel__wrapper');
      if (this.wrapper) {
        this.wrapper.setAttribute('role', 'region');
        this.wrapper.setAttribute('aria-label', 'Featured products carousel');
      }
    }
  }

  class PhandanhMegaMenu extends HTMLElement {
    connectedCallback() {
      this.mobileToggle = this.querySelector('.phandanh-mega-menu-mobile-toggle');
      this.nav = this.querySelector('.phandanh-mega-menu-nav');
      this.menuItems = this.querySelectorAll('[data-menu-item]');
      this.menuTriggers = this.querySelectorAll('[data-menu-trigger]');

      this.setupEventListeners();
      this.updateCartCount();
    }

    setupEventListeners() {
      if (this.mobileToggle) {
        this.mobileToggle.addEventListener('click', () => this.toggleMobileMenu());
      }

      this.menuTriggers.forEach((trigger) => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleDropdown(trigger.closest('[data-menu-item]'));
        });
      });

      document.addEventListener('click', (e) => {
        if (!this.contains(e.target)) this.closeAllDropdowns();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeAllDropdowns();
      });

      document.addEventListener('cart:updated', () => this.updateCartCount());

      window.addEventListener('scroll', () => {
        if (this.nav.classList.contains('active')) this.positionMobileNav();
      }, { passive: true });
    }

    toggleMobileMenu() {
      const isActive = this.nav.classList.toggle('active');
      this.mobileToggle.setAttribute('aria-expanded', isActive);
      if (isActive) this.positionMobileNav();
    }

    // Menu mobile luôn mở ngay dưới thanh menu (kể cả khi có topbar phía trên)
    positionMobileNav() {
      const bottom = Math.max(0, this.getBoundingClientRect().bottom);
      this.nav.style.top = bottom + 'px';
      this.nav.style.height = 'calc(100vh - ' + bottom + 'px)';
    }

    toggleDropdown(menuItem) {
      const isActive = menuItem.classList.contains('active');
      this.closeAllDropdowns();

      if (!isActive) {
        menuItem.classList.add('active');
        const trigger = menuItem.querySelector('[data-menu-trigger]');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
      }
    }

    closeAllDropdowns() {
      this.menuItems.forEach((item) => {
        item.classList.remove('active');
        const trigger = item.querySelector('[data-menu-trigger]');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    }

    updateCartCount() {
      // Chỉ chạy trên website thật (Shopify có /cart.js). Mở file trực tiếp sẽ bỏ qua.
      if (location.protocol === 'file:') return;

      fetch('/cart.js')
        .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
        .then((cart) => {
          const countElement = this.querySelector('[data-cart-count]');
          if (countElement) countElement.textContent = cart.item_count;
        })
        .catch(() => {});
    }
  }

  if (!customElements.get('phandanh-mobile-nav-carousel')) {
    customElements.define('phandanh-mobile-nav-carousel', PhandanhMobileNavCarousel);
  }
  if (!customElements.get('phandanh-mega-menu')) {
    customElements.define('phandanh-mega-menu', PhandanhMegaMenu);
  }
})();


/* ==========================================================================
   2. HERO – hiệu ứng xuất hiện
   ========================================================================== */
phandanhReady(function () {
  phandanhReveal('.phandanh-hero', 0.2);
});


/* ==========================================================================
   3. BRAND – logo chạy ngang vô tận
   ========================================================================== */
phandanhReady(function () {
  function setupPhandanhLogos(root) {
    if (root.dataset.phandanhReady) return;
    root.dataset.phandanhReady = '1';

    var track = root.querySelector('.phandanh-logos-track');
    var original = track && track.querySelector('.phandanh-logos-group');
    if (!original) return;

    function build() {
      // Xoá các bản sao cũ, chỉ giữ nhóm gốc
      track.querySelectorAll('.phandanh-logos-group[data-clone]').forEach(function (g) { g.remove(); });

      var groupWidth = original.getBoundingClientRect().width;
      if (!groupWidth) return;

      // Nhân bản cho tới khi 1 nửa track phủ kín chiều ngang khung
      var copiesPerHalf = Math.max(1, Math.ceil(root.offsetWidth / groupWidth));
      var totalGroups = copiesPerHalf * 2;

      for (var i = 1; i < totalGroups; i++) {
        var clone = original.cloneNode(true);
        clone.setAttribute('data-clone', '');
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('a').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
        track.appendChild(clone);
      }

      var speed = parseFloat(root.dataset.speed) || 60;
      var distance = groupWidth * copiesPerHalf;
      root.style.setProperty('--phandanh-logos-duration', (distance / speed) + 's');
      track.style.animationDirection = root.dataset.direction === 'right' ? 'reverse' : 'normal';
    }

    // Chờ ảnh tải xong để đo đúng chiều rộng
    var imgs = original.querySelectorAll('img');
    var pending = imgs.length;
    if (!pending) build();
    imgs.forEach(function (img) {
      if (img.complete) {
        if (--pending === 0) build();
      } else {
        img.addEventListener('load', function () { if (--pending === 0) build(); }, { once: true });
        img.addEventListener('error', function () { if (--pending === 0) build(); }, { once: true });
      }
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 200);
    });
  }

  document.querySelectorAll('.phandanh-logos').forEach(setupPhandanhLogos);
});


/* ==========================================================================
   4. ABOUT – hiệu ứng xuất hiện
   ========================================================================== */
phandanhReady(function () {
  phandanhReveal('.phandanh-about', 0.2);
});


/* ==========================================================================
   5. BEST SELLER – slider sản phẩm
   ========================================================================== */
phandanhReady(function () {
  function setupPhandanhBest(root) {
    if (root.dataset.phandanhReady) return;
    root.dataset.phandanhReady = '1';

    var track = root.querySelector('.phandanh-best-track');
    var prev = root.querySelector('.phandanh-best-prev');
    var next = root.querySelector('.phandanh-best-next');
    if (!track || !prev || !next) return;

    function step() {
      var card = track.querySelector('.phandanh-best-card');
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }

    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    }

    prev.addEventListener('click', function () {
      track.scrollBy({ left: -step(), behavior: 'smooth' });
    });

    next.addEventListener('click', function () {
      track.scrollBy({ left: step(), behavior: 'smooth' });
    });

    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }, { passive: true });

    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    update();
  }

  document.querySelectorAll('.phandanh-best').forEach(setupPhandanhBest);
});


/* ==========================================================================
   6. CONCERN – không cần JS (hiệu ứng thuần CSS)
   ========================================================================== */


/* ==========================================================================
   7. CLINICALLY – hiệu ứng xuất hiện + số chạy
   ========================================================================== */
phandanhReady(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-target')) || 0;
    if (reduceMotion) { el.textContent = target; return; }

    var duration = 1600;
    var start = null;

    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // chậm dần ở cuối
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(frame);
    }

    el.textContent = '0';
    requestAnimationFrame(frame);
  }

  phandanhReveal('.phandanh-clinical', 0.3, function (section) {
    section.querySelectorAll('.phandanh-clinical-count').forEach(countUp);
  });
});


/* ==========================================================================
   8. COLLAGEN – accordion đổi ảnh
   ========================================================================== */
phandanhReady(function () {
  function setupPhandanhIngr(root) {
    if (root.dataset.phandanhReady) return;
    root.dataset.phandanhReady = '1';

    var items = root.querySelectorAll('.phandanh-ingr-item');
    var images = root.querySelectorAll('.phandanh-ingr-img');
    var defaultIndex = 0;

    function showImage(index) {
      images.forEach(function (img, i) {
        img.classList.toggle('is-active', i === index);
      });
    }

    function closeItem(item) {
      item.classList.remove('is-open');
      item.querySelector('.phandanh-ingr-head').setAttribute('aria-expanded', 'false');
    }

    items.forEach(function (item) {
      var head = item.querySelector('.phandanh-ingr-head');

      head.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');

        // Chỉ mở 1 mục tại một thời điểm
        items.forEach(closeItem);

        if (!wasOpen) {
          item.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
          root.classList.add('has-open');
          showImage(parseInt(item.getAttribute('data-image'), 10) || 0);
        } else {
          // Đóng hết -> quay về ảnh mặc định, đen trắng
          root.classList.remove('has-open');
          showImage(defaultIndex);
        }
      });
    });
  }

  document.querySelectorAll('.phandanh-ingr').forEach(setupPhandanhIngr);
});


/* ==========================================================================
   9. SKIN BEGINS – accordion đổi ảnh
   ========================================================================== */
phandanhReady(function () {
  function setupPhandanhCore(root) {
    if (root.dataset.phandanhReady) return;
    root.dataset.phandanhReady = '1';

    var items = root.querySelectorAll('.phandanh-core-item');
    var images = root.querySelectorAll('.phandanh-core-img');

    function showImage(index) {
      images.forEach(function (img, i) {
        img.classList.toggle('is-active', i === index);
      });
    }

    items.forEach(function (item) {
      var head = item.querySelector('.phandanh-core-head');

      head.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');

        // Đóng tất cả, chỉ mở 1 mục tại một thời điểm
        items.forEach(function (it) {
          it.classList.remove('is-open');
          it.querySelector('.phandanh-core-head').setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
          item.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
          showImage(parseInt(item.getAttribute('data-image'), 10) || 0);
        }
        // Nếu đóng mục đang mở thì giữ nguyên ảnh của mục đó
      });
    });
  }

  document.querySelectorAll('.phandanh-core').forEach(setupPhandanhCore);
});


/* ==========================================================================
   10. FAQ – accordion
   ========================================================================== */
phandanhReady(function () {
  function setupPhandanhFaq(root) {
    if (root.dataset.phandanhReady) return;
    root.dataset.phandanhReady = '1';

    var items = root.querySelectorAll('.phandanh-faq-item');

    items.forEach(function (item) {
      var btn = item.querySelector('.phandanh-faq-question');
      btn.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');

      btn.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');

        // Chỉ mở 1 câu tại một thời điểm
        items.forEach(function (it) {
          it.classList.remove('is-open');
          it.querySelector('.phandanh-faq-question').setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  document.querySelectorAll('.phandanh-faq').forEach(setupPhandanhFaq);
});


/* ==========================================================================
   11. FORM LIÊN HỆ – kiểm tra dữ liệu + gửi
   ========================================================================== */
phandanhReady(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.querySelectorAll('.phandanh-contact-form').forEach(function (form) {
    if (form.dataset.phandanhReady) return;
    form.dataset.phandanhReady = '1';

    var submitBtn = form.querySelector('.phandanh-contact-submit');
    var success = form.querySelector('.phandanh-contact-success');
    var consent = form.querySelector('input[name="consent"]');
    var consentError = form.querySelector('.phandanh-contact-error--consent');

    function checkField(input) {
      var field = input.closest('.phandanh-contact-field');
      var value = input.value.trim();
      var ok = input.type === 'email' ? EMAIL_RE.test(value) : value.length > 0;
      if (field) field.classList.toggle('is-invalid', !ok);
      return ok;
    }

    var required = form.querySelectorAll('.phandanh-contact-field [required]');

    required.forEach(function (input) {
      input.addEventListener('blur', function () { if (input.value) checkField(input); });
      input.addEventListener('input', function () {
        var field = input.closest('.phandanh-contact-field');
        if (field && field.classList.contains('is-invalid')) checkField(input);
      });
    });

    if (consent) {
      consent.addEventListener('change', function () {
        if (consent.checked) consentError.classList.remove('is-shown');
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var valid = true;
      var firstBad = null;
      required.forEach(function (input) {
        if (!checkField(input)) {
          valid = false;
          if (!firstBad) firstBad = input;
        }
      });

      if (consent && !consent.checked) {
        valid = false;
        consentError.classList.add('is-shown');
        if (!firstBad) firstBad = consent;
      }

      if (!valid) {
        if (firstBad) firstBad.focus();
        return;
      }

      function done() {
        form.reset();
        submitBtn.disabled = false;
        success.hidden = false;
        setTimeout(function () { success.hidden = true; }, 6000);
      }

      submitBtn.disabled = true;
      var action = form.getAttribute('action');

      // Có link xử lý thì gửi thật, không có thì chỉ hiện thông báo
      if (action && location.protocol !== 'file:') {
        fetch(action, { method: 'POST', body: new FormData(form) })
          .then(done)
          .catch(function () {
            submitBtn.disabled = false;
            alert('Sorry, something went wrong. Please try again.');
          });
      } else {
        setTimeout(done, 400);
      }
    });
  });
});


/* ==========================================================================
   12. FOOTER – đăng ký nhận tin, accordion mobile, lên đầu trang
   ========================================================================== */
phandanhReady(function () {
  var footer = document.querySelector('.phandanh-footer');
  if (!footer || footer.dataset.phandanhReady) return;
  footer.dataset.phandanhReady = '1';

  // Năm hiện tại
  var year = footer.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // Đăng ký nhận tin
  var newsForm = footer.querySelector('.phandanh-footer-news-form');
  if (newsForm) {
    var input = newsForm.querySelector('input[type="email"]');
    var msg = newsForm.querySelector('.phandanh-footer-news-msg');
    newsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
        msg.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      msg.textContent = 'Thank you for subscribing!';
      newsForm.reset();
    });
  }

  // Accordion cột link trên mobile
  var mq = window.matchMedia('(max-width: 749px)');
  footer.querySelectorAll('.phandanh-footer-col').forEach(function (col) {
    var title = col.querySelector('.phandanh-footer-col-title');
    title.addEventListener('click', function () {
      if (!mq.matches) return;
      var open = col.classList.toggle('is-open');
      title.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // Nút lên đầu trang
  var topBtn = footer.querySelector('.phandanh-footer-top');
  if (topBtn) {
    var ticking = false;
    function onScroll() {
      topBtn.classList.toggle('is-shown', window.scrollY > 600);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});