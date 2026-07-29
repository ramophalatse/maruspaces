/* ============================================================================
   scroll-world — day/night variant of the portable scroll-scrubbed engine
   ----------------------------------------------------------------------------
   Based on the scroll-world skill's reference scrub-engine.js. Each section may
   carry a `clip`/`still` (day) pair AND a `clipNight`/`stillNight` pair. Both
   are mounted simultaneously (mirroring this site's existing hero day/night
   pattern: two full scenes always in the DOM, cross-faded via opacity driven
   by `data-theme` on <html>) so switching themes never re-fetches or restarts
   a video — it only toggles which of the two already-loaded layers is visible.
   No mobile variants — desktop only, per this build's scope.

   USAGE — identical to scrub-engine.js, plus per-section:
     { ..., still, clip, stillNight, clipNight, ... }
   Theme is read from documentElement.dataset.theme === 'dark' (matches the
   existing Sanctuary Mandela hero's day/night toggle). If a section has no
   night pair, the day pair is shown regardless of theme.
   ========================================================================== */

function mountScrollWorld(container, config) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SECTIONS = config.sections || [];
  const CONNECTORS = config.connectors || [];
  const DIVE_W = config.diveScroll || 1.3;
  const CONN_W = config.connScroll || 0.9;
  const CROSSFADE = (config.crossfade != null) ? config.crossfade : 0.12;
  const N = SECTIONS.length;
  if (!N) return;

  injectCSS();
  container.classList.add('sw-root');

  const SEGMENTS = [];
  SECTIONS.forEach((s, i) => {
    const dive = {
      kind: 'dive', si: i,
      clip: s.clip, still: s.still,
      clipNight: s.clipNight, stillNight: s.stillNight,
      accent: s.accent, w: s.scroll || DIVE_W, linger: s.linger || 0
    };
    SEGMENTS.push(dive);
    s._seg = dive;
    if (i < N - 1 && CONNECTORS[i]) {
      const c = CONNECTORS[i];
      const cn = (config.connectorsNight || [])[i];
      SEGMENTS.push({
        kind: 'conn', si: i,
        clip: c, still: SECTIONS[i + 1].still,
        clipNight: cn, stillNight: SECTIONS[i + 1].stillNight,
        accent: SECTIONS[i + 1].accent, w: CONN_W
      });
    }
  });
  const NSEG = SEGMENTS.length;

  const sky = el('div', 'sw-sky');
  if (config.atmosphere !== false) {
    sky.appendChild(el('div', 'sw-sky__grad'));
    sky.appendChild(el('div', 'sw-sky__glow'));
  }
  const particles = el('div', 'sw-particles'); sky.appendChild(particles);

  const scrollbar = el('div', 'sw-scrollbar');
  const scrollbarFill = el('span'); scrollbar.appendChild(scrollbarFill);

  const topbar = el('div', 'sw-topbar');
  if (config.brand) {
    const brand = el('a', 'sw-brand'); brand.href = (config.brand.href || '#');
    if (config.brand.markDark || config.brand.markLight) {
      const mark = el('span', 'sw-brand__mark');
      if (config.brand.markDark) {
        const mDark = el('img', 'sw-brand__mark-img sw-brand__mark-img--dark');
        mDark.src = config.brand.markDark; mDark.alt = ''; mark.appendChild(mDark);
      }
      if (config.brand.markLight) {
        const mLight = el('img', 'sw-brand__mark-img sw-brand__mark-img--light');
        mLight.src = config.brand.markLight; mLight.alt = ''; mark.appendChild(mLight);
      }
      brand.appendChild(mark);
    }
    const nm = el('span', 'sw-brand__name'); nm.textContent = config.brand.name || ''; brand.appendChild(nm);
    topbar.appendChild(brand);
  }
  const nav = el('nav', 'sw-nav'); if (config.nav !== false) topbar.appendChild(nav);
  if (config.cta && config.cta.label) {
    const c = el('a', 'sw-topcta'); c.href = config.cta.href || '#'; c.textContent = config.cta.label;
    topbar.appendChild(c);
  }

  const stage = el('div', 'sw-stage');
  const copylayer = el('div', 'sw-copylayer');
  const hint = el('div', 'sw-hint');
  const hintText = el('span'); hintText.textContent = config.hint || 'scroll'; hint.appendChild(hintText);
  hint.appendChild(el('i'));
  const track = el('div', 'sw-track');

  [sky, scrollbar, topbar, stage, copylayer, hint, track].forEach(n => container.appendChild(n));

  // segment scenes — day + night still layers both mounted up front
  SEGMENTS.forEach(s => {
    const scene = el('div', 'sw-scene'); scene.style.setProperty('--sw-accent', s.accent || '');
    const imgDay = el('img', 'sw-scene__still sw-variant-day'); imgDay.alt = ''; imgDay.decoding = 'async'; imgDay.loading = 'lazy';
    if (s.still) imgDay.src = s.still;
    scene.appendChild(imgDay);
    let imgNight = null;
    if (s.stillNight) {
      imgNight = el('img', 'sw-scene__still sw-variant-night'); imgNight.alt = ''; imgNight.decoding = 'async'; imgNight.loading = 'lazy';
      imgNight.src = s.stillNight;
      scene.appendChild(imgNight);
    }
    stage.appendChild(scene);
    s.el = scene;
    s.imgDay = imgDay; s.imgNight = imgNight;
    s.videoDay = null; s.videoNight = null;
    s.hasClipDay = false; s.hasClipNight = false;
    s.loadingDay = false; s.loadingNight = false;
    s.readyDay = false; s.readyNight = false;
    s.cur = 0; s.target = 0; s.visible = false;
  });

  const copies = [];
  SECTIONS.forEach((s, i) => {
    const c = el('article', 'sw-copy'); c.style.setProperty('--sw-accent', s.accent || '');
    c.classList.toggle('sw-copy--dark', s.copyTheme === 'dark');
    c.classList.toggle('sw-copy--right', s.copyAlign === 'right');
    c.innerHTML =
      (s.eyebrow ? `<span class="sw-copy__eyebrow">${esc(s.eyebrow)}</span>` : '') +
      (s.title ? `<h2 class="sw-copy__title">${esc(s.title)}</h2>` : '') +
      (s.body ? `<p class="sw-copy__body">${esc(s.body)}</p>` : '') +
      (s.tags && s.tags.length ? `<ul class="sw-copy__tags">${s.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '') +
      (s.cta ? `<div class="sw-copy__cta">${ctaBtns(s.cta)}</div>` : '');
    copylayer.appendChild(c); copies.push(c);

    if (config.nav !== false) {
      const b = el('button', 'sw-nav__item'); b.textContent = s.label || '';
      b.addEventListener('click', () => jumpTo(i)); nav.appendChild(b);
    }
  });

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const SEEK_EPS = 0.008;
  const lingerEase = (x, L) => { L = clamp(L); const c = x - 0.5; return (1 - L) * x + L * (4 * c * c * c + 0.5); };
  let vh = window.innerHeight, stageX = 0, totalW = 0, activeIndex = -1, ticking = false;
  let laidOutW = window.innerWidth;

  function layout() {
    vh = window.innerHeight;
    laidOutW = window.innerWidth;
    stageX = window.innerWidth > 860 ? 4 : 0;
    let off = 0;
    SEGMENTS.forEach(s => { s.start = off * vh; off += s.w; s.end = off * vh; });
    totalW = off;
    track.style.height = (totalW * vh + vh) + 'px';
    read();
  }

  function jumpTo(i) {
    const seg = SECTIONS[i]._seg;
    // Copy opacity (see read()'s `cop` calc) peaks at pr=0 for the first
    // section and pr=0.5 for every other section — landing every jump at
    // the segment midpoint left the first section's text well short of full
    // opacity, since its fade curve is front-loaded rather than centered.
    const pr = i === 0 ? 0 : 0.5;
    window.scrollTo({ top: seg.start + (seg.end - seg.start) * pr, behavior: reduce ? 'auto' : 'smooth' });
  }

  function loadVariant(s, variant) {
    const isNight = variant === 'night';
    const clipUrl = isNight ? s.clipNight : s.clip;
    const loadingKey = isNight ? 'loadingNight' : 'loadingDay';
    if (reduce || s[loadingKey] || !clipUrl) return;
    s[loadingKey] = true;
    fetch(clipUrl).then(r => r.ok ? r.blob() : Promise.reject(new Error('404')))
      .then(blob => {
        const v = document.createElement('video');
        v.className = 'sw-scene__video ' + (isNight ? 'sw-variant-night' : 'sw-variant-day');
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.src = URL.createObjectURL(blob);
        v.addEventListener('loadedmetadata', () => { s[isNight ? 'readyNight' : 'readyDay'] = true; read(); });
        v.addEventListener('seeked', () => { s.el.classList.add(isNight ? 'has-clip-night' : 'has-clip-day'); }, { once: true });
        s.el.appendChild(v);
        if (isNight) { s.videoNight = v; s.hasClipNight = true; } else { s.videoDay = v; s.hasClipDay = true; }
      }).catch(() => { s[loadingKey] = false; });
  }

  function read() {
    const y = window.scrollY || window.pageYOffset;
    const fade = CROSSFADE * vh;
    let ci = 0;
    for (let i = 0; i < NSEG; i++) if (y >= SEGMENTS[i].start) ci = i;

    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      if (y > s.start - 1.6 * vh && y < s.end + 1.6 * vh) {
        loadVariant(s, 'day');
        if (s.clipNight) loadVariant(s, 'night');
      }
      const local = clamp((y - s.start) / (s.end - s.start), 0, 1);
      let target = s.linger ? lingerEase(local, s.linger) : local;
      // The two segments that meet at the loop seam get pinned by the line
      // above to their OWN far end while off-screen (segment 0 clamps to its
      // own last frame once you're past it; the last segment clamps to its
      // own first frame until you reach it) — exactly backwards for a wrap,
      // since the seam needs segment 0 sitting at ITS start and the last
      // segment sitting at ITS end. Left alone, the wrap has to seek a video
      // a long way in one jump, and however long that decode takes is a
      // visible flash of whatever frame it was previously parked on. Priming
      // them at the seam-facing frame continuously — for as long as the user
      // is anywhere in the segment at the other end of the loop, not just at
      // the moment of the wrap — means `cur` has already eased there over
      // many frames by the time a wrap actually fires, so there's nothing
      // left to seek.
      if (i === 0 && ci === NSEG - 1) target = 0;
      if (i === NSEG - 1 && ci === 0) target = 1;
      s.target = target;
      let outside = 0;
      if (y < s.start) outside = s.start - y; else if (y > s.end) outside = y - s.end;
      const op = smooth(1 - outside / fade);
      s.el.style.opacity = op; s.visible = op > 0.001;
      s.el.style.zIndex = (i === ci) ? '120' : String(100 + Math.round(op * 10));
      const sc = reduce ? 1 : 1.03 + local * 0.14;
      const tf = `translateX(${stageX - 2}vw) scale(${sc.toFixed(3)})`;
      if (!s.hasClipDay || !s.readyDay) s.imgDay.style.transform = tf;
      if (s.imgNight && (!s.hasClipNight || !s.readyNight)) s.imgNight.style.transform = tf;
    }

    for (let i = 0; i < N; i++) {
      const seg = SECTIONS[i]._seg;
      const pr = clamp((y - seg.start) / (seg.end - seg.start), 0, 1);
      const before = y < seg.start, after = y > seg.end;
      let cop;
      if (i === 0) cop = after ? 0 : smooth(1 - pr / 0.62);
      else if (i === N - 1) cop = before ? 0 : smooth(pr / 0.4);
      else cop = (before || after) ? 0 : smooth(1 - Math.abs(pr - 0.5) / 0.5);
      const c = copies[i];
      c.style.opacity = cop;
      c.style.transform = reduce ? 'none' : `translateY(${(0.5 - pr) * 4}vh)`;
      c.style.pointerEvents = cop > 0.5 ? 'auto' : 'none';
    }

    const cur = SEGMENTS[ci];
    const near = clamp(cur.kind === 'dive' ? cur.si
      : (((y - cur.start) / (cur.end - cur.start)) > 0.5 ? cur.si + 1 : cur.si), 0, N - 1);
    if (near !== activeIndex) {
      activeIndex = near;
      nav.querySelectorAll('.sw-nav__item').forEach((n, k) => n.classList.toggle('is-active', k === near));
      container.style.setProperty('--sw-accent', SECTIONS[near].accent || '');
      // mirrors the Sanctuary Mandela hero's body.past-hero pattern: once the
      // visitor has scrolled off the first section, the topbar/switch rise to
      // reclaim the vertical space a centered wordmark would otherwise hold.
      document.body.classList.toggle('sw-past-hero', near !== 0);
    }
    scrollbarFill.style.transform = `scaleX(${clamp(y / (totalW * vh))})`;
    hint.style.opacity = clamp(1 - y / (0.5 * vh));
    if (particles) particles.style.transform = `translate3d(0, ${-y * 0.05}px, 0)`;
    ticking = false;
  }

  function raf() {
    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      s.cur += (s.target - s.cur) * (reduce ? 1 : 0.18);
      [['videoDay', 'readyDay'], ['videoNight', 'readyNight']].forEach(([vk, rk]) => {
        const v = s[vk];
        if (!v || !s[rk]) return;
        if (v.seeking) return;
        if (!s.visible && Math.abs(s.cur - s.target) < 0.002) return;
        const dur = v.duration || 1;
        const t = clamp(s.cur, 0, 0.999) * dur;
        if (Math.abs(v.currentTime - t) > SEEK_EPS) { try { v.currentTime = t; } catch (e) {} }
      });
    }
    requestAnimationFrame(raf);
  }

  // Snaps every segment's eased `cur` (and its video currentTime) straight to
  // `target` for the just-set scroll position, instead of leaving raf()'s
  // normal 0.18 lerp to catch up over the next several frames. The seam
  // segments arrive here already primed (see the ci-based override in read()
  // above), so this is normally a no-op seek for them; it still matters for
  // every other segment whose `cur` hadn't caught up to a fast scroll yet.
  function snapSegments() {
    read();
    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      s.cur = s.target;
      [['videoDay', 'readyDay'], ['videoNight', 'readyNight']].forEach(([vk, rk]) => {
        const v = s[vk];
        if (!v || !s[rk]) return;
        const dur = v.duration || 1;
        const t = clamp(s.cur, 0, 0.999) * dur;
        try { v.currentTime = t; } catch (e) {}
      });
    }
  }

  function wrapTo(newY) {
    window.scrollTo(0, newY);
    snapSegments();
  }

  seedParticles(particles, reduce);
  // The last scene's clip now ends on the same frame the first scene starts
  // from, so the world loops seamlessly in both directions: scrolling past
  // the end wraps to the start, and scrolling up past the start wraps to the end.
  window.addEventListener('scroll', () => {
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    if (maxY > 0 && window.scrollY >= maxY - 1) { wrapTo(0); return; }
    if (!ticking) { ticking = true; requestAnimationFrame(read); }
  }, { passive: true });
  window.addEventListener('wheel', (e) => {
    if (window.scrollY <= 0 && e.deltaY < 0) {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      // Land just shy of maxY so this doesn't immediately re-trigger the
      // forward wrap (which fires at maxY - 1) and bounce straight back to 0.
      if (maxY > 0) wrapTo(maxY - 8);
    }
  }, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);
  window.addEventListener('load', layout);
  layout();
  requestAnimationFrame(raf);

  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ctaBtns(cta) {
    let h = '';
    if (cta.primary) h += `<a class="sw-btn sw-btn--primary" href="${esc(cta.primary.href || '#')}">${esc(cta.primary.label)}</a>`;
    if (cta.secondary) h += `<a class="sw-btn sw-btn--ghost" href="${esc(cta.secondary.href || '#')}">${esc(cta.secondary.label)}</a>`;
    return h;
  }
}

function seedParticles(host, reduce) {
  if (!host || reduce) return;
  const kinds = ['dot', 'dot', 'ring'];
  const seeds = [7, 23, 41, 58, 71, 88, 12, 34, 52, 66, 83, 95, 18, 29, 47, 63, 77, 91, 5, 38, 55, 69, 82, 97];
  for (let k = 0; k < 20; k++) {
    const s = document.createElement('span');
    s.className = 'sw-pt sw-pt--' + kinds[k % kinds.length];
    s.style.left = seeds[k % seeds.length] + 'vw';
    s.style.top = ((seeds[(k * 3) % seeds.length] * 1.3) % 100) + 'vh';
    s.style.setProperty('--sw-sc', (0.5 + ((seeds[(k * 5) % seeds.length] % 60) / 60) * 1.1).toFixed(2));
    const dur = 14 + (seeds[(k * 7) % seeds.length] % 22);
    s.style.animationDuration = dur + 's';
    s.style.animationDelay = (-(seeds[(k * 2) % seeds.length] % dur)) + 's';
    host.appendChild(s);
  }
}

function injectCSS() {
  if (document.getElementById('sw-css')) return;
  const css = `
  .sw-root{--sw-bg:#F5EDE0;--sw-ink:#241d2b;--sw-ink-soft:#6a6072;--sw-accent:#8a7bb5;
    --sw-font-display:ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,sans-serif;
    --sw-font-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
    --sw-font-mono:ui-monospace,Menlo,monospace;
    --sw-nav-bg:rgba(27,23,18,0.52);--sw-nav-border:rgba(255,255,255,0.08);
    --sw-nav-text:#FFFFFF;--sw-nav-text-hover:#F1EAD9;
    --sw-nav-active:#AE5A34;
    color:var(--sw-ink);font-family:var(--sw-font-body);}
  html[data-theme="dark"] .sw-root{--sw-nav-bg:rgba(246,241,231,0.55);--sw-nav-border:rgba(27,23,18,0.08);
    --sw-nav-text:#332C22;--sw-nav-text-hover:#1B1712;}
  html,body{margin:0;background:var(--sw-bg,#F5EDE0);overflow-x:hidden;}
  .sw-sky{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:var(--sw-bg);}
  .sw-sky__grad{position:absolute;inset:-10%;background:linear-gradient(178deg,color-mix(in srgb,var(--sw-accent) 12%,var(--sw-bg)) 0%,var(--sw-bg) 55%,color-mix(in srgb,var(--sw-accent) 6%,var(--sw-bg)) 100%);}
  .sw-sky__glow{position:absolute;inset:0;background:radial-gradient(60% 42% at 74% 16%,color-mix(in srgb,var(--sw-accent) 22%,transparent),transparent 70%),radial-gradient(46% 34% at 50% 50%,color-mix(in srgb,#fff 45%,transparent),transparent 70%);}
  .sw-particles{position:absolute;inset:-6% -2%;will-change:transform;}
  .sw-pt{position:absolute;width:13px;height:13px;transform:scale(var(--sw-sc,1));opacity:0;animation:sw-drift linear infinite;}
  .sw-pt::before{content:"";position:absolute;inset:0;border-radius:50%;}
  .sw-pt--dot::before{background:radial-gradient(circle at 34% 30%,color-mix(in srgb,var(--sw-accent) 60%,#000),#000 82%);}
  .sw-pt--ring::before{background:transparent;border:2px solid color-mix(in srgb,var(--sw-accent) 55%,transparent);}
  @keyframes sw-drift{0%{opacity:0;transform:scale(var(--sw-sc)) translate(0,12vh) rotate(0)}12%{opacity:.5}88%{opacity:.45}100%{opacity:0;transform:scale(var(--sw-sc)) translate(4vw,-22vh) rotate(210deg)}}
  .sw-scrollbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;background:color-mix(in srgb,var(--sw-accent) 14%,transparent);}
  .sw-scrollbar span{display:block;height:100%;width:100%;transform-origin:0 50%;transform:scaleX(0);background:var(--sw-accent);}
  .sw-topbar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(14px,2.4vw,26px) clamp(18px,5vw,64px);transition:padding-top .5s cubic-bezier(.16,.8,.24,1);}
  .sw-brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.25);}
  .sw-brand__mark{position:relative;width:26px;height:26px;flex-shrink:0;}
  .sw-brand__mark-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity .3s ease;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.2));}
  .sw-brand__mark-img--dark{opacity:1;} .sw-brand__mark-img--light{opacity:0;}
  html[data-theme="dark"] .sw-brand__mark-img--dark{opacity:0;} html[data-theme="dark"] .sw-brand__mark-img--light{opacity:1;}
  .sw-brand__name{font-family:var(--sw-font-display);font-weight:500;font-size:1.15rem;letter-spacing:-.01em;}
  .sw-nav{position:fixed;top:clamp(14px,2.4vw,26px);left:50%;transform:translateX(-50%);z-index:50;display:flex;gap:2px;padding:5px;background:var(--sw-nav-bg);border:1px solid var(--sw-nav-border);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);border-radius:999px;transition:top .5s cubic-bezier(.16,.8,.24,1);}
  .sw-nav__item{font-family:var(--sw-font-mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--sw-nav-text);border:0;background:transparent;cursor:pointer;padding:8px 14px;border-radius:999px;transition:color .25s,background .25s;}
  .sw-nav__item:hover{color:var(--sw-nav-text-hover);} .sw-nav__item.is-active{color:#fff;background:var(--sw-nav-active);}
  .sw-topcta{font-family:var(--sw-font-mono);text-decoration:none;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--sw-ink);padding:12px 22px;border-radius:999px;white-space:nowrap;transition:background .25s ease;}
  .sw-topcta:hover{background:var(--sw-accent);}
  .sw-stage{position:fixed;inset:0;z-index:10;pointer-events:none;}
  .sw-scene{position:absolute;inset:0;opacity:0;overflow:hidden;will-change:opacity;}
  .sw-scene__video,.sw-scene__still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 42%;transition:opacity 1.6s ease;}
  .sw-scene__still{will-change:transform;} .sw-scene__video{z-index:1;}
  /* day is the default visible layer; night fades in only under data-theme="dark" */
  .sw-variant-day{opacity:1;} .sw-variant-night{opacity:0;}
  html[data-theme="dark"] .sw-variant-day{opacity:0;} html[data-theme="dark"] .sw-variant-night{opacity:1;}
  .sw-scene.has-clip-day .sw-scene__still.sw-variant-day{opacity:0 !important;}
  .sw-scene.has-clip-night .sw-scene__still.sw-variant-night{opacity:0 !important;}
  .sw-copylayer{position:fixed;inset:0;z-index:20;pointer-events:none;}
  .sw-copy{position:absolute;left:clamp(18px,5vw,64px);top:50%;transform:translateY(-50%);width:min(42vw,460px);opacity:0;will-change:opacity,transform;}
  .sw-copy--right{left:auto;right:clamp(18px,5vw,64px);text-align:right;}
  .sw-copy--right .sw-copy__tags,.sw-copy--right .sw-copy__cta{justify-content:flex-end;}
  .sw-copy__eyebrow{display:inline-block;margin-top:18px;font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-weight:500;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,#AE5A34 70%,#000);padding:7px 16px;border-radius:999px;background:color-mix(in srgb,#AE5A34 14%,#fff);border:1px solid color-mix(in srgb,#AE5A34 30%,transparent);}
  html[data-theme="dark"] .sw-copy__eyebrow{color:#fff;background:#2E2E2E;border-color:color-mix(in srgb,#c9704a 45%,transparent);}
  .sw-copy__title{font-family:var(--sw-font-display);font-weight:700;color:#fff;font-size:clamp(2rem,4.4vw,3.5rem);line-height:1.03;margin:12px 0 0;letter-spacing:-.01em;}
  .sw-copy__body{margin-top:18px;font-size:clamp(1rem,1.25vw,1.14rem);line-height:1.55;color:rgba(255,255,255,0.88);max-width:40ch;}
  .sw-copy--dark .sw-copy__title{color:var(--sw-ink);}
  .sw-copy--dark .sw-copy__body{color:color-mix(in srgb,var(--sw-ink) 78%,var(--sw-ink-soft));}
  html[data-theme="dark"] .sw-copy--dark .sw-copy__title{color:#fff;}
  html[data-theme="dark"] .sw-copy--dark .sw-copy__body{color:rgba(255,255,255,0.88);}
  .sw-copy__tags{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 0;padding:0;}
  .sw-copy__tags li{font-size:.82rem;font-weight:600;color:color-mix(in srgb,var(--sw-accent) 70%,#000);padding:7px 14px;border-radius:999px;background:color-mix(in srgb,var(--sw-accent) 14%,#fff);border:1px solid color-mix(in srgb,var(--sw-accent) 30%,transparent);}
  .sw-copy__cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px;pointer-events:auto;}
  .sw-btn{text-decoration:none;font-weight:600;font-size:.95rem;padding:13px 24px;border-radius:999px;transition:transform .2s;}
  .sw-btn--primary{color:#fff;background:var(--sw-ink);} .sw-btn--primary:hover{transform:translateY(-2px);}
  .sw-btn--ghost{color:var(--sw-ink);border:1.5px solid color-mix(in srgb,var(--sw-ink) 25%,transparent);} .sw-btn--ghost:hover{transform:translateY(-2px);}
  .sw-hint{position:fixed;left:50%;bottom:26px;z-index:30;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sw-ink);font-weight:600;transition:opacity .3s;}
  .sw-hint i{width:22px;height:34px;border-radius:12px;border:2px solid color-mix(in srgb,var(--sw-ink) 55%,transparent);position:relative;}
  html[data-theme="dark"] .sw-hint{color:rgba(255,255,255,0.7);}
  html[data-theme="dark"] .sw-hint i{border-color:rgba(255,255,255,0.35);}
  .sw-hint i::after{content:"";position:absolute;left:50%;top:7px;width:4px;height:7px;border-radius:2px;background:var(--sw-accent);transform:translateX(-50%);animation:sw-wheel 1.7s ease-in-out infinite;}
  @keyframes sw-wheel{0%{opacity:0;top:6px}40%{opacity:1}100%{opacity:0;top:17px}}
  .sw-track{position:relative;z-index:1;width:100%;pointer-events:none;}
  @media (max-width:860px){
    .sw-nav{display:none;}
    .sw-copy{left:clamp(18px,5vw,64px);right:clamp(18px,5vw,64px);top:auto;bottom:clamp(64px,14vh,120px);transform:none;width:auto;max-width:560px;}
    .sw-copy{bottom:calc(clamp(56px,12dvh,110px) + env(safe-area-inset-bottom));}
    .sw-copy__title{font-size:clamp(1.9rem,7.5vw,2.7rem);}
    .sw-copy__body{max-width:none;font-size:clamp(.98rem,3.6vw,1.1rem);} .sw-scene__video,.sw-scene__still{object-position:center 46%;}
    .sw-hint{bottom:calc(20px + env(safe-area-inset-bottom));}
  }
  @media (max-width:860px) and (orientation:portrait){
    .sw-scene__video,.sw-scene__still{object-position:center 44%;}
  }
  @media (hover:none) and (pointer:coarse){
    .sw-btn{padding:15px 26px;}
  }
  @media (prefers-reduced-motion:reduce){ .sw-hint i::after{animation:none;} .sw-pt{display:none;} }
  `;
  const style = document.createElement('style'); style.id = 'sw-css';
  style.textContent = '@layer sw {\n' + css + '\n}';
  document.head.appendChild(style);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { mountScrollWorld };
if (typeof window !== 'undefined') window.mountScrollWorld = mountScrollWorld;
