(function(){
  const reactive = document.querySelectorAll('.reactive');
  const hero = document.querySelector('.hero');
  const stackScene = document.getElementById('stackScene');
  const stackStage = document.getElementById('stackStage');
  const stackCards = Array.from(document.querySelectorAll('.stack-card'));
  const returnTriggers = document.querySelectorAll('[data-target]');

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t){ return a + (b - a) * t; }

  function smoothstep(t){
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function setXY(el, x, y){
    const r = el.getBoundingClientRect();
    const mx = ((x - r.left) / r.width) * 100;
    const my = ((y - r.top) / r.height) * 100;
    el.style.setProperty('--mx', mx + '%');
    el.style.setProperty('--my', my + '%');
  }

  reactive.forEach(el=>{
    el.addEventListener('mouseenter', e=>{
      el.classList.add('is-active');
      setXY(el, e.clientX, e.clientY);
    });
    el.addEventListener('mousemove', e=>{
      el.classList.add('is-active');
      setXY(el, e.clientX, e.clientY);
    });
    el.addEventListener('mouseleave', ()=>{
      el.classList.remove('is-active');
    });
  });

  if(hero){
    hero.addEventListener('mousemove', e=>{
      const r = hero.getBoundingClientRect();
      const hx = ((e.clientX - r.left) / r.width) * 100;
      const hy = ((e.clientY - r.top) / r.height) * 100;
      hero.style.setProperty('--hero-x', hx + '%');
      hero.style.setProperty('--hero-y', hy + '%');
    });
  }

  if(stackStage){
    stackStage.addEventListener('mousemove', e=>{
      const r = stackStage.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * 100;
      const sy = ((e.clientY - r.top) / r.height) * 100;
      stackStage.style.setProperty('--stack-x', sx + '%');
      stackStage.style.setProperty('--stack-y', sy + '%');
    });
  }

  // --- Fast, premium tilt (damped) ---
  const tilt = {
    targetX: 0, targetY: 0,
    curX: 0, curY: 0,
    raf: 0,
    activeEl: null,
    follow: 0.24,
    stopEps: 0.02
  };

  function applyTilt(){
    const el = tilt.activeEl;
    if(!el){
      tilt.raf = 0;
      return;
    }

    tilt.curX = lerp(tilt.curX, tilt.targetX, tilt.follow);
    tilt.curY = lerp(tilt.curY, tilt.targetY, tilt.follow);

    el.style.setProperty('--ry', tilt.curX.toFixed(3) + 'deg');
    el.style.setProperty('--rx', tilt.curY.toFixed(3) + 'deg');

    const done =
      (Math.abs(tilt.curX - tilt.targetX) < tilt.stopEps) &&
      (Math.abs(tilt.curY - tilt.targetY) < tilt.stopEps);

    if(done){
      tilt.raf = 0;
      return;
    }
    tilt.raf = requestAnimationFrame(applyTilt);
  }

  function setTiltTarget(el, xDeg, yDeg){
    if(tilt.activeEl !== el){
      if(tilt.activeEl){
        tilt.activeEl.style.setProperty('--rx','0deg');
        tilt.activeEl.style.setProperty('--ry','0deg');
      }
      tilt.activeEl = el;
      tilt.curX = 0;
      tilt.curY = 0;
    }
    tilt.targetX = xDeg;
    tilt.targetY = yDeg;
    if(!tilt.raf) tilt.raf = requestAnimationFrame(applyTilt);
  }

  function clearTilt(el){
    if(!el) return;
    if(tilt.activeEl === el){
      tilt.targetX = 0;
      tilt.targetY = 0;
      if(!tilt.raf) tilt.raf = requestAnimationFrame(applyTilt);
    } else {
      el.style.setProperty('--rx','0deg');
      el.style.setProperty('--ry','0deg');
    }
  }

  // compute target from last mousemove per frame
  let mouseQueued = false;
  let lastMouse = null;

  function queueMouse(card, e){
    lastMouse = { card, x: e.clientX, y: e.clientY };
    if(mouseQueued) return;
    mouseQueued = true;
    requestAnimationFrame(()=>{
      mouseQueued = false;
      if(!lastMouse) return;
      const { card: c, x, y } = lastMouse;
      lastMouse = null;
      if(!c.classList.contains('active-top')) return;

      const r = c.getBoundingClientRect();
      const px = ((x - r.left) / r.width) - 0.5;
      const py = ((y - r.top) / r.height) - 0.5;

      const ry = px * 6.2;
      const rx = -py * 4.4;

      setTiltTarget(c, ry, rx);
    });
  }

  stackCards.forEach(card=>{
    card.addEventListener('mousemove', e=>{
      if(!card.classList.contains('active-top')) return;
      queueMouse(card, e);
    });
    card.addEventListener('mouseleave', ()=>{
      clearTilt(card);
    });
  });

  // --- Stack motion: rAF throttled ---
  let needsUpdate = true;
  let ticking = false;

  function requestUpdate(){
    needsUpdate = true;
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      ticking = false;
      if(needsUpdate) updateStack();
      needsUpdate = false;
    });
  }

  function updateStack(){
    if(!stackScene || !stackCards.length) return;

    if(window.innerWidth <= 1100){
      stackCards.forEach((card, i)=>{
        card.style.opacity = '1';
        card.style.filter = 'none';
        card.style.zIndex = String(10 + i);
        card.style.setProperty('--tx', '0px');
        card.style.setProperty('--ty', '0px');
        card.style.setProperty('--rz', '0deg');
        card.style.setProperty('--sc', '1');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.classList.toggle('active-top', i === 0);
        const veil = card.querySelector('.stack-veil');
        if(veil) veil.style.opacity = '0';
      });
      return;
    }

    const rect = stackScene.getBoundingClientRect();
    const total = Math.max(stackScene.offsetHeight - window.innerHeight, 1);
    const passed = clamp(-rect.top, 0, total);
    const progress = passed / total;

    const n = stackCards.length;
    const raw = progress * (n - 1);

    const base = Math.floor(raw);
    const frac = raw - base;

    const topIndex = (base < n - 1 && frac > 0.0005) ? (base + 1) : clamp(base, 0, n - 1);

    const stageH = stackStage ? stackStage.clientHeight : Math.min(window.innerHeight * 0.8, 760);
    const offY = Math.round(stageH * 0.92 + 140);
    const coverLift = 14;

    stackCards.forEach(card => card.classList.remove('active-top'));

    stackCards.forEach((card, i)=>{
      const baseRot = parseFloat(card.dataset.baseRot || 0);
      const baseX = parseFloat(card.dataset.baseX || 0);
      const veil = card.querySelector('.stack-veil');

      const enterRaw = raw - (i - 1);
      const enter = smoothstep(clamp(enterRaw, 0, 1));

      const exitRaw = raw - i;
      const exit = smoothstep(clamp(exitRaw, 0, 1));

      if(enter <= 0.0001){
        card.style.opacity = '0';
        card.style.filter = 'blur(0px)';
        card.style.zIndex = String(200 + i);
        card.style.setProperty('--tx', baseX + 'px');
        card.style.setProperty('--ty', offY + 'px');
        card.style.setProperty('--rz', baseRot + 'deg');
        card.style.setProperty('--sc', '0.94');
        if(veil) veil.style.opacity = '0';
        card.style.setProperty('--rx','0deg');
        card.style.setProperty('--ry','0deg');
        return;
      }

      const y = lerp(offY, 0, enter) + (-coverLift * exit);
      const x = lerp(baseX, 0, enter) * (1 - 0.22 * exit);
      const sc = lerp(0.965, 1.0, enter) - (0.030 * exit);
      const rz = lerp(baseRot, 0, enter) * (1 - 0.18 * exit);

      const blur = (1 - enter) * 2.2 + (exit * 0.85);
      const veilOpacity = (1 - enter) * 0.08 + (exit * 0.16);
      const opacity = smoothstep(enter);

      card.style.opacity = String(opacity);
      card.style.zIndex = String(200 + i);
      card.style.setProperty('--tx', x.toFixed(2) + 'px');
      card.style.setProperty('--ty', y.toFixed(2) + 'px');
      card.style.setProperty('--rz', rz.toFixed(3) + 'deg');
      card.style.setProperty('--sc', sc.toFixed(4));
      card.style.filter = `blur(${blur.toFixed(2)}px)`;

      if(veil) veil.style.opacity = String(veilOpacity);
    });

    if(stackCards[topIndex]){
      stackCards[topIndex].classList.add('active-top');

      stackCards.forEach((c, idx)=>{
        if(idx !== topIndex){
          c.style.setProperty('--rx','0deg');
          c.style.setProperty('--ry','0deg');
        }
      });
      if(tilt.activeEl && tilt.activeEl !== stackCards[topIndex]){
        tilt.activeEl = null;
      }
    }
  }

  function focusPhase(targetId){
    if(!stackScene || !stackCards.length) return;
    const idx = stackCards.findIndex(c => c.id === targetId);
    if(idx < 0) return;

    const n = stackCards.length;
    const total = Math.max(stackScene.offsetHeight - window.innerHeight, 1);
    const targetRaw = clamp(idx, 0, n - 1);
    const targetProgress = (n === 1) ? 0 : (targetRaw / (n - 1));

    const sceneTop = stackScene.getBoundingClientRect().top + window.scrollY;
    const y = sceneTop + (targetProgress * total);
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  returnTriggers.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      focusPhase(btn.getAttribute('data-target'));
    });
  });

  requestUpdate();
  window.addEventListener('scroll', requestUpdate, { passive:true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('load', requestUpdate);
})();