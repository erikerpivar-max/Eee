/* ── The House — Particle Background ────────────────────────
   Subtle floating particles + warm gradient overlay.
   Matches the warm beige/gold palette of The House.        */

(function () {
  'use strict';

  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ── Config ─────────────────────────────────────────── */
  const CFG = {
    count: 60,            // number of particles
    minR: 1,              // min radius
    maxR: 2.8,            // max radius
    speed: 0.15,          // base drift speed
    lineAlpha: 0.06,      // connection line opacity
    lineDist: 140,        // max distance to draw a line
    particleColor: [200, 136, 42],   // --primary #C8882A
    particleAlpha: 0.18,
    mouse: { x: -9999, y: -9999, radius: 160 },
  };

  let W, H, particles = [], dpr = 1, animId;

  /* ── Resize ─────────────────────────────────────────── */
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Particle class ─────────────────────────────────── */
  class Particle {
    constructor() { this.reset(true); }

    reset(init) {
      this.r = CFG.minR + Math.random() * (CFG.maxR - CFG.minR);
      this.x = init ? Math.random() * (W || window.innerWidth) : -this.r;
      this.y = Math.random() * (H || window.innerHeight);
      this.vx = (Math.random() - 0.3) * CFG.speed;
      this.vy = (Math.random() - 0.5) * CFG.speed;
      this.alpha = 0.08 + Math.random() * CFG.particleAlpha;
      this.pulse = Math.random() * Math.PI * 2;
      this.pulseSpeed = 0.005 + Math.random() * 0.01;
    }

    update() {
      this.pulse += this.pulseSpeed;
      const breathe = 0.6 + 0.4 * Math.sin(this.pulse);

      /* gentle mouse repulsion */
      const dx = this.x - CFG.mouse.x;
      const dy = this.y - CFG.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CFG.mouse.radius && dist > 0) {
        const force = (CFG.mouse.radius - dist) / CFG.mouse.radius * 0.4;
        this.x += (dx / dist) * force;
        this.y += (dy / dist) * force;
      }

      this.x += this.vx;
      this.y += this.vy;
      this.currentAlpha = this.alpha * breathe;

      /* wrap around edges */
      if (this.x < -10) this.x = W + 10;
      if (this.x > W + 10) this.x = -10;
      if (this.y < -10) this.y = H + 10;
      if (this.y > H + 10) this.y = -10;
    }

    draw() {
      const [r, g, b] = CFG.particleColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${this.currentAlpha})`;
      ctx.fill();
    }
  }

  /* ── Draw connections ───────────────────────────────── */
  function drawLines() {
    const [r, g, b] = CFG.particleColor;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < CFG.lineDist) {
          const a = CFG.lineAlpha * (1 - d / CFG.lineDist);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  /* ── Animation loop ─────────────────────────────────── */
  function loop() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) { p.update(); p.draw(); }
    drawLines();
    animId = requestAnimationFrame(loop);
  }

  /* ── Init ────────────────────────────────────────────── */
  function init() {
    resize();
    particles = [];
    for (let i = 0; i < CFG.count; i++) particles.push(new Particle());
    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  /* ── Events ──────────────────────────────────────────── */
  window.addEventListener('resize', () => { resize(); });

  document.addEventListener('mousemove', (e) => {
    CFG.mouse.x = e.clientX;
    CFG.mouse.y = e.clientY;
  });
  document.addEventListener('mouseleave', () => {
    CFG.mouse.x = -9999;
    CFG.mouse.y = -9999;
  });

  /* start when DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
