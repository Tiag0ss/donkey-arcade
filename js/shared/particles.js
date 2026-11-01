export function createParticles() {
  const list = [];

  return {
    burst(x, y, color = '#ffe080', n = 8, speed = 120) {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const sp = speed * (0.5 + Math.random());
        list.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.3 + Math.random() * 0.25,
          max: 0.55,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt;
        if (p.life <= 0) list.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of list) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    },
    clear() {
      list.length = 0;
    },
  };
}
