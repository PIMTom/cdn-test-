(function () {
  'use strict';

  // 1. Try to find the script tag by its source name
  // 2. If that fails, just use the first script tag it finds as a backup
  const script = document.querySelector('script[src*="pim-widget"]') || document.currentScript;

  const config = {
    price:          parseFloat(script?.dataset?.pimPrice || 2985),
    maxInstalments: parseInt(script?.dataset?.pimMaxInstalments || 24),
    color:          script?.dataset?.pimColor || '#8b72d8',
    minPrice:       parseFloat(script?.dataset?.pimMinPrice || 500),
    maxPrice:       parseFloat(script?.dataset?.pimMaxPrice || 5000),
  };

  console.log("Widget Config Loaded:", config); // This will show in your Edge Console (F12)
  /* ── Helpers ── */
  const fmt = n => '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function shade(hex, pct) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16)        + (pct * 2.55 | 0)));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + (pct * 2.55 | 0)));
    const b = Math.min(255, Math.max(0, (num & 0xff)        + (pct * 2.55 | 0)));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /* ── Unique ID so multiple instances don't clash ── */
  const uid = 'pim_' + Math.random().toString(36).slice(2, 8);

  /* ── Compute payment plan ── */
  function compute(price, depositPct, instalments) {
    const deposit       = price * (depositPct / 100);
    const remaining     = price - deposit;
    const remInstalments = instalments - 1;
    const monthly       = remInstalments > 0 ? remaining / remInstalments : remaining;
    return { deposit, monthly, remInstalments };
  }

  /* ── Inject CSS (once per page) ── */
  function injectStyles(color) {
    const id = 'pim-styles-' + uid;
    if (document.getElementById(id)) return;

    const dark   = shade(color, -20);
    const darker = shade(color, -40);
    const light  = shade(color, 88);

    const css = `
      .${uid}-banner {
        background: ${color};
        border-radius: 10px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        user-select: none;
      }
      .${uid}-banner-left .sub  { font-size: 11px; color: rgba(255,255,255,.75); }
      .${uid}-banner-left .amt  { font-size: 17px; font-weight: 700; color: #fff; margin: 2px 0; }
      .${uid}-banner-left .link { font-size: 11px; color: rgba(255,255,255,.85); text-decoration: underline; }
      .${uid}-badge {
        background: rgba(255,255,255,.18);
        border-radius: 7px;
        padding: 5px 10px;
        font-size: 11px;
        color: #fff;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* Overlay */
      .${uid}-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.55);
        z-index: 99999;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .${uid}-overlay.open { display: flex; }

      /* Modal */
      .${uid}-modal {
        background: #fff;
        border-radius: 16px;
        overflow: hidden;
        width: 100%;
        max-width: 370px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 24px 64px rgba(0,0,0,.25);
        position: relative;
      }
      .${uid}-modal-head {
        background: ${color};
        padding: 22px 20px 18px;
        text-align: center;
        position: relative;
      }
      .${uid}-modal-head .logo-row {
        display: flex; align-items: center; justify-content: center; gap: 7px; margin-bottom: 8px;
      }
      .${uid}-modal-head .logo-row .icon-box {
        width: 28px; height: 28px;
        background: rgba(255,255,255,.2);
        border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
      }
      .${uid}-modal-head .logo-row span { font-size: 15px; font-weight: 600; color: #fff; }
      .${uid}-modal-head .tagline { font-size: 12px; color: rgba(255,255,255,.8); }
      .${uid}-modal-head .big     { font-size: 28px; font-weight: 700; color: #fff; line-height: 1.1; }
      .${uid}-modal-head .range   { font-size: 12px; color: rgba(255,255,255,.75); margin-top: 2px; }
      .${uid}-close {
        position: absolute; top: 12px; right: 14px;
        background: rgba(255,255,255,.2); border: none; border-radius: 50%;
        width: 26px; height: 26px; font-size: 16px; color: #fff;
        cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;
      }
      .${uid}-close:hover { background: rgba(255,255,255,.35); }

      .${uid}-total-bar {
        background: ${dark};
        padding: 11px 20px;
        text-align: center;
        font-size: 13px;
        color: rgba(255,255,255,.85);
      }
      .${uid}-total-bar b { font-size: 17px; font-weight: 700; color: #fff; }

      .${uid}-modal-body {
        padding: 20px 18px 22px;
        background: #f5f3ff;
      }
      .${uid}-modal-body h3 {
        font-size: 16px; font-weight: 600; text-align: center;
        color: ${darker}; margin: 0 0 16px;
      }

      /* Sliders */
      .${uid}-slider-block { margin-bottom: 16px; }
      .${uid}-slider-block label {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; color: #888; margin-bottom: 6px;
      }
      .${uid}-slider-block label span { font-weight: 600; color: ${darker}; font-size: 13px; }
      .${uid}-slider-block input[type=range] {
        -webkit-appearance: none; appearance: none;
        width: 100%; height: 4px;
        background: ${light};
        border-radius: 2px; outline: none; cursor: pointer;
      }
      .${uid}-slider-block input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none;
        width: 20px; height: 20px; border-radius: 50%;
        background: ${color}; cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,.25);
      }
      .${uid}-slider-block input[type=range]::-moz-range-thumb {
        width: 20px; height: 20px; border-radius: 50%; border: none;
        background: ${color}; cursor: pointer;
        box-shadow: 0 1px 4px rgba(0,0,0,.25);
      }

      /* Stat pills */
      .${uid}-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
      .${uid}-pill {
        background: ${light}; border-radius: 10px; padding: 12px 10px; text-align: center;
      }
      .${uid}-pill small { display: block; font-size: 10px; color: ${shade(color,-10)}; margin-bottom: 2px; }
      .${uid}-pill strong { font-size: 16px; font-weight: 700; color: ${darker}; }
      .${uid}-pill-full {
        background: ${light}; border-radius: 10px; padding: 12px 10px;
        text-align: center; margin-top: 10px;
      }
      .${uid}-pill-full small { display: block; font-size: 10px; color: ${shade(color,-10)}; margin-bottom: 2px; }
      .${uid}-pill-full strong { font-size: 16px; font-weight: 700; color: ${darker}; }

      /* Eligibility note */
      .${uid}-note {
        font-size: 11px; color: #aaa; text-align: center; margin-top: 14px; line-height: 1.5;
      }
    `;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Build DOM ── */
  function buildWidget() {
    injectStyles(config.color);

    /* ─ Banner ─ */
    const banner = document.createElement('div');
    banner.className = `${uid}-banner`;
    banner.setAttribute('role', 'button');
    banner.setAttribute('tabindex', '0');
    banner.setAttribute('aria-haspopup', 'dialog');
    banner.setAttribute('aria-label', 'View interest free finance options');
    banner.innerHTML = `
      <div class="${uid}-banner-left">
        <div class="sub">Interest Free Finance from</div>
        <div class="amt" id="${uid}-b-amt">calculating…</div>
        <div class="link">Find out more</div>
      </div>
      <div class="${uid}-badge">payitmonthly</div>
    `;

    /* ─ Overlay + Modal ─ */
    const overlay = document.createElement('div');
    overlay.className = `${uid}-overlay`;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Payment plan details');
    overlay.innerHTML = `
      <div class="${uid}-modal">

        <div class="${uid}-modal-head">
          <button class="${uid}-close" aria-label="Close">&times;</button>
          <div class="logo-row">
            <div class="icon-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="8" rx="2" fill="white"/>
                <rect x="13" y="3" width="8" height="8" rx="2" fill="white"/>
                <rect x="3" y="13" width="8" height="8" rx="2" fill="white"/>
                <rect x="13" y="13" width="8" height="8" rx="2" fill="rgba(255,255,255,.5)"/>
              </svg>
            </div>
            <span>payitmonthly</span>
          </div>
          <div class="tagline">Spread the cost of your purchase</div>
          <div class="big">0% Interest</div>
          <div class="range">Orders between £500 and £5,000</div>
        </div>

        <div class="${uid}-total-bar">
          Total Cost of Item: <b id="${uid}-m-total"></b>
        </div>

        <div class="${uid}-modal-body">
          <h3>Possible Payment Plan</h3>

          <div class="${uid}-slider-block">
            <label>
              Today's deposit
              <span id="${uid}-dep-lbl"></span>
            </label>
            <input type="range" id="${uid}-dep-slider" min="0" max="100" step="1" value="50">
          </div>

          <div class="${uid}-slider-block">
            <label>
              Number of instalments
              <span id="${uid}-inst-lbl"></span>
            </label>
            <input type="range" id="${uid}-inst-slider" min="2" max="${config.maxInstalments}" step="1" value="${Math.min(12, config.maxInstalments)}">
          </div>

          <div class="${uid}-stats">
            <div class="${uid}-pill">
              <small>Instalments</small>
              <strong id="${uid}-m-inst"></strong>
            </div>
            <div class="${uid}-pill">
              <small>Today's payment</small>
              <strong id="${uid}-m-dep"></strong>
            </div>
          </div>
          <div class="${uid}-pill-full">
            <small>Instalment Amount</small>
            <strong id="${uid}-m-monthly"></strong>
          </div>

          <p class="${uid}-note">
            Representative example. Subject to eligibility and approval.<br>
            Finance provided by PayItMonthly.
          </p>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    /* ─ Wire up events ─ */
    const open  = () => { overlay.classList.add('open'); updateModal(); };
    const close = () => overlay.classList.remove('open');

    banner.addEventListener('click', open);
    banner.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector(`.${uid}-close`).addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    overlay.querySelector(`#${uid}-dep-slider`).addEventListener('input', updateModal);
    overlay.querySelector(`#${uid}-inst-slider`).addEventListener('input', updateModal);

    /* ─ Initial render ─ */
    updateBanner();
    updateModal();

    return banner;
  }

  /* ── Update banner text ── */
  function updateBanner() {
    const el = document.getElementById(`${uid}-b-amt`);
    if (!el) return;
    const instSlider = document.getElementById(`${uid}-inst-slider`);
    const depSlider  = document.getElementById(`${uid}-dep-slider`);
    if (!instSlider || !depSlider) return;
    const { monthly } = compute(config.price, parseFloat(depSlider.value), parseInt(instSlider.value));
    el.textContent = fmt(monthly) + ' per month';
  }

  /* ── Update modal stats ── */
  function updateModal() {
    const instSlider = document.getElementById(`${uid}-inst-slider`);
    const depSlider  = document.getElementById(`${uid}-dep-slider`);
    if (!instSlider || !depSlider) return;

    const instalments = parseInt(instSlider.value);
    const depPct      = parseFloat(depSlider.value);
    const { deposit, monthly, remInstalments } = compute(config.price, depPct, instalments);

    document.getElementById(`${uid}-m-total`).textContent   = fmt(config.price);
    document.getElementById(`${uid}-dep-lbl`).textContent   = fmt(deposit);
    document.getElementById(`${uid}-inst-lbl`).textContent  = instalments;
    document.getElementById(`${uid}-m-inst`).textContent    = instalments;
    document.getElementById(`${uid}-m-dep`).textContent     = fmt(deposit);
    document.getElementById(`${uid}-m-monthly`).textContent = fmt(monthly) + ' × ' + remInstalments;

    updateBanner();
  }

  /* ── Find placeholder(s) or auto-append ── */
  function mount() {
    const placeholders = document.querySelectorAll('[data-acpim-widget]');

    if (placeholders.length > 0) {
      placeholders.forEach(el => {
        const widget = buildWidget();
        el.replaceWith(widget);
      });
    } else {
      /* No placeholder — insert banner just before the script tag itself */
      const widget = buildWidget();
      script.parentNode.insertBefore(widget, script);
    }
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();
