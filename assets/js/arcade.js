(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("gameOverlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayCopy = document.getElementById("overlayCopy");
  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const mobileStartButton = document.getElementById("mobileStartButton");
  const scoreValue = document.getElementById("scoreValue");
  const highScoreValue = document.getElementById("highScoreValue");
  const livesValue = document.getElementById("livesValue");
  const levelValue = document.getElementById("levelValue");
  const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)");

  const W = canvas.width;
  const H = canvas.height;
  const keys = { left: false, right: false, fire: false };

  let running = false;
  let paused = false;
  let animationId = null;
  let lastTime = 0;
  let score = 0;
  let lives = 3;
  let level = 1;
  function loadHighScore() {
    try {
      return Number(window.localStorage.getItem("pbInvadersHighScore") || 0);
    } catch (error) {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      window.localStorage.setItem("pbInvadersHighScore", String(value));
    } catch (error) {
      // Some in-app browsers disable storage; the game still works without persistence.
    }
  }

  let highScore = loadHighScore();
  let player;
  let bullets = [];
  let enemyBullets = [];
  let invaders = [];
  let particles = [];
  let stars = [];
  let formationDirection = 1;
  let formationSpeed = 34;
  let enemyShootTimer = 0;
  let levelClearTimer = 0;
  let canvasPointerId = null;
  let canvasPointerStartX = 0;
  let canvasPointerMoved = false;

  const palette = {
    white: "#f8fbff",
    primary: "#8297ff",
    accent: "#b58cff",
    cyan: "#64e7ff",
    danger: "#ff668f",
    gold: "#ffd36c",
    dark: "#080d20"
  };

  function resizeCanvasDisplay() {
    const ratio = W / H;
    const available = canvas.parentElement.clientWidth;
    canvas.style.width = `${available}px`;
    canvas.style.height = `${available / ratio}px`;
  }

  function updateControlInstructions() {
    if (!running) {
      overlayCopy.textContent = coarsePointer.matches
        ? "Drag across the game area to move and tap it to fire, or use the controls below."
        : "Move with ← → or A D. Fire with Space. Press P to pause.";
    }
  }

  function gameXFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * W;
  }

  function movePlayerToPointer(event) {
    if (!running || paused || !player) return;
    const targetX = gameXFromPointer(event) - player.w / 2;
    player.x = Math.max(18, Math.min(W - player.w - 18, targetX));
  }

  function makeStars() {
    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.7 + 0.35,
      speed: Math.random() * 17 + 7,
      alpha: Math.random() * 0.65 + 0.25
    }));
  }

  function resetPlayer() {
    player = {
      x: W / 2 - 29,
      y: H - 70,
      w: 58,
      h: 30,
      speed: 390,
      cooldown: 0,
      invulnerable: 1.2
    };
  }

  function createInvaders() {
    invaders = [];
    const rows = Math.min(4 + Math.floor((level - 1) / 2), 6);
    const cols = 9;
    const gapX = 72;
    const gapY = 52;
    const totalWidth = (cols - 1) * gapX + 42;
    const startX = (W - totalWidth) / 2;
    const startY = 78;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        invaders.push({
          x: startX + col * gapX,
          y: startY + row * gapY,
          w: 42,
          h: 28,
          row,
          col,
          alive: true,
          phase: Math.random() * Math.PI * 2
        });
      }
    }
    formationDirection = 1;
    formationSpeed = 34 + (level - 1) * 9;
    enemyShootTimer = 0.9;
  }

  function resetGame() {
    score = 0;
    lives = 3;
    level = 1;
    bullets = [];
    enemyBullets = [];
    particles = [];
    levelClearTimer = 0;
    resetPlayer();
    createInvaders();
    updateHud();
  }

  function startGame() {
    if (!running) {
      resetGame();
      running = true;
    }
    paused = false;
    overlay.classList.add("is-hidden");
    if (mobileStartButton) mobileStartButton.hidden = true;
    pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
  }

  function showOverlay(title, copy, buttonLabel) {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startButton.innerHTML = `${buttonLabel} <i class="fa-solid fa-play"></i>`;
    if (mobileStartButton) {
      mobileStartButton.innerHTML = `${buttonLabel} <i class="fa-solid fa-play"></i>`;
      mobileStartButton.hidden = false;
    }
    overlay.classList.remove("is-hidden");
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      cancelAnimationFrame(animationId);
      showOverlay("Paused", "Everything is frozen. Press P or continue whenever you are ready.", "Continue");
      pauseButton.innerHTML = '<i class="fa-solid fa-play"></i> Continue';
    } else {
      overlay.classList.add("is-hidden");
      pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      lastTime = performance.now();
      animationId = requestAnimationFrame(loop);
    }
  }

  function updateHud() {
    scoreValue.textContent = score;
    highScoreValue.textContent = highScore;
    livesValue.textContent = lives;
    levelValue.textContent = level;
  }

  function shoot() {
    if (player.cooldown > 0 || bullets.length >= 4) return;
    bullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 10, w: 4, h: 16, speed: 570 });
    player.cooldown = 0.24;
  }

  function enemyShoot() {
    const alive = invaders.filter(invader => invader.alive);
    if (!alive.length) return;
    const bottomByColumn = new Map();
    alive.forEach(invader => {
      const current = bottomByColumn.get(invader.col);
      if (!current || invader.y > current.y) bottomByColumn.set(invader.col, invader);
    });
    const shooters = [...bottomByColumn.values()];
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2.5, y: shooter.y + shooter.h, w: 5, h: 15, speed: 225 + level * 13 });
  }

  function collide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, color, count = 14) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 150 + 45;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.5 + 0.35,
        maxLife: 0.85,
        color,
        size: Math.random() * 3 + 1
      });
    }
  }

  function loseLife() {
    if (player.invulnerable > 0) return;
    lives -= 1;
    burst(player.x + player.w / 2, player.y + player.h / 2, palette.danger, 28);
    enemyBullets = [];
    if (lives <= 0) {
      finishGame();
      return;
    }
    resetPlayer();
    updateHud();
  }

  function finishGame() {
    running = false;
    cancelAnimationFrame(animationId);
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }
    updateHud();
    showOverlay("Game over", `Final score: ${score}. The fleet slipped through this time.`, "Play again");
  }

  function nextLevel() {
    level += 1;
    score += 250;
    bullets = [];
    enemyBullets = [];
    resetPlayer();
    createInvaders();
    levelClearTimer = 0;
    updateHud();
  }

  function update(dt) {
    stars.forEach(star => {
      star.y += star.speed * dt;
      if (star.y > H) { star.y = -3; star.x = Math.random() * W; }
    });

    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (keys.left) player.x -= player.speed * dt;
    if (keys.right) player.x += player.speed * dt;
    player.x = Math.max(18, Math.min(W - player.w - 18, player.x));
    if (keys.fire) shoot();

    bullets.forEach(bullet => bullet.y -= bullet.speed * dt);
    enemyBullets.forEach(bullet => bullet.y += bullet.speed * dt);
    bullets = bullets.filter(bullet => bullet.y + bullet.h > 0);
    enemyBullets = enemyBullets.filter(bullet => bullet.y < H + 20);

    const aliveInvaders = invaders.filter(invader => invader.alive);
    if (aliveInvaders.length) {
      const minX = Math.min(...aliveInvaders.map(i => i.x));
      const maxX = Math.max(...aliveInvaders.map(i => i.x + i.w));
      const edge = formationDirection > 0 ? maxX >= W - 28 : minX <= 28;
      if (edge) {
        formationDirection *= -1;
        aliveInvaders.forEach(invader => { invader.y += 20; });
      } else {
        aliveInvaders.forEach(invader => {
          invader.x += formationDirection * formationSpeed * dt;
          invader.phase += dt * 5;
        });
      }
      if (aliveInvaders.some(invader => invader.y + invader.h >= player.y - 8)) {
        lives = 0;
        finishGame();
        return;
      }
    }

    enemyShootTimer -= dt;
    if (enemyShootTimer <= 0 && aliveInvaders.length) {
      enemyShoot();
      enemyShootTimer = Math.max(0.28, 1.08 - level * 0.055) * (0.65 + Math.random() * 0.7);
    }

    bullets.forEach(bullet => {
      invaders.forEach(invader => {
        if (invader.alive && collide(bullet, invader)) {
          invader.alive = false;
          bullet.y = -100;
          const points = (invaders.length - invader.row * 9) > 0 ? (5 - Math.min(invader.row, 4)) * 10 : 10;
          score += points;
          burst(invader.x + invader.w / 2, invader.y + invader.h / 2, invader.row % 2 ? palette.accent : palette.cyan);
          if (score > highScore) highScore = score;
          updateHud();
        }
      });
    });

    enemyBullets.forEach(bullet => {
      if (collide(bullet, player)) {
        bullet.y = H + 100;
        loseLife();
      }
    });

    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 70 * dt;
      p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);

    if (!invaders.some(invader => invader.alive)) {
      levelClearTimer += dt;
      if (levelClearTimer >= 0.75) nextLevel();
    }
  }

  function roundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, "#111a42");
    gradient.addColorStop(0.55, "#0c1430");
    gradient.addColorStop(1, "#070b1b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    stars.forEach(star => {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = palette.white;
      ctx.fillRect(star.x, star.y, star.r, star.r);
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(104, 133, 255, 0.12)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, H - 115); ctx.lineTo(W / 2 + (x - W / 2) * 0.15, H); ctx.stroke();
    }
    for (let y = H - 115; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
    const x = player.x, y = player.y;
    ctx.save();
    ctx.shadowColor = palette.cyan;
    ctx.shadowBlur = 18;
    ctx.fillStyle = palette.cyan;
    roundedRect(x + 4, y + 15, player.w - 8, 13, 5); ctx.fill();
    ctx.fillStyle = palette.primary;
    roundedRect(x + 18, y + 5, player.w - 36, 17, 6); ctx.fill();
    ctx.fillStyle = palette.white;
    ctx.fillRect(x + player.w / 2 - 3, y, 6, 10);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + 11, y + 27, 8, 5);
    ctx.fillRect(x + player.w - 19, y + 27, 8, 5);
    ctx.restore();
  }

  function drawInvader(invader) {
    if (!invader.alive) return;
    const bob = Math.sin(invader.phase) * 1.5;
    const x = invader.x, y = invader.y + bob;
    const color = invader.row % 3 === 0 ? palette.cyan : invader.row % 3 === 1 ? palette.primary : palette.accent;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 13;
    ctx.fillStyle = color;
    roundedRect(x + 4, y + 5, invader.w - 8, invader.h - 8, 8); ctx.fill();
    ctx.fillRect(x, y + 10, 7, 10);
    ctx.fillRect(x + invader.w - 7, y + 10, 7, 10);
    ctx.fillRect(x + 8, y + invader.h - 5, 7, 7);
    ctx.fillRect(x + invader.w - 15, y + invader.h - 5, 7, 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = palette.dark;
    ctx.fillRect(x + 12, y + 11, 5, 5);
    ctx.fillRect(x + invader.w - 17, y + 11, 5, 5);
    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    bullets.forEach(bullet => {
      ctx.shadowColor = palette.gold;
      ctx.shadowBlur = 12;
      ctx.fillStyle = palette.gold;
      roundedRect(bullet.x, bullet.y, bullet.w, bullet.h, 3); ctx.fill();
    });
    enemyBullets.forEach(bullet => {
      ctx.shadowColor = palette.danger;
      ctx.shadowBlur = 10;
      ctx.fillStyle = palette.danger;
      roundedRect(bullet.x, bullet.y, bullet.w, bullet.h, 3); ctx.fill();
    });
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    invaders.forEach(drawInvader);
    drawBullets();
    drawParticles();
    drawPlayer();
  }

  function loop(now) {
    if (!running || paused) return;
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    update(dt);
    draw();
    if (running && !paused) animationId = requestAnimationFrame(loop);
  }

  function setKey(event, value) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "a"].includes(key)) keys.left = value;
    if (["arrowright", "d"].includes(key)) keys.right = value;
    if (key === " " || key === "spacebar") keys.fire = value;
    if (["arrowleft", "arrowright", " "].includes(event.key)) event.preventDefault();
  }

  window.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "p" && !event.repeat) {
      event.preventDefault();
      togglePause();
      return;
    }
    setKey(event, true);
  });
  window.addEventListener("keyup", event => setKey(event, false));
  window.addEventListener("blur", () => {
    keys.left = keys.right = keys.fire = false;
    if (running && !paused) togglePause();
  });
  window.addEventListener("resize", resizeCanvasDisplay);

  document.querySelectorAll("[data-control]").forEach(button => {
    const control = button.dataset.control;
    const press = event => {
      event.preventDefault();
      try { button.setPointerCapture?.(event.pointerId); } catch (error) {}
      keys[control] = true;
      if (control === "fire" && running && !paused) shoot();
    };
    const release = event => {
      event.preventDefault();
      keys[control] = false;
      try { if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId); } catch (error) {}
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("click", event => {
      event.preventDefault();
      if (!running || paused || !player) return;
      if (control === "left") player.x = Math.max(18, player.x - 70);
      if (control === "right") player.x = Math.min(W - player.w - 18, player.x + 70);
      if (control === "fire") shoot();
    });
  });

  canvas.addEventListener("pointerdown", event => {
    if (!running || paused) return;
    event.preventDefault();
    canvasPointerId = event.pointerId;
    canvasPointerStartX = event.clientX;
    canvasPointerMoved = false;
    try { canvas.setPointerCapture?.(event.pointerId); } catch (error) {}
    movePlayerToPointer(event);
  });

  canvas.addEventListener("pointermove", event => {
    if (event.pointerId !== canvasPointerId || !running || paused) return;
    event.preventDefault();
    if (Math.abs(event.clientX - canvasPointerStartX) > 8) canvasPointerMoved = true;
    movePlayerToPointer(event);
  });

  const finishCanvasPointer = event => {
    if (event.pointerId !== canvasPointerId) return;
    event.preventDefault();
    if (!canvasPointerMoved && running && !paused) shoot();
    try { if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch (error) {}
    canvasPointerId = null;
  };
  canvas.addEventListener("pointerup", finishCanvasPointer);
  canvas.addEventListener("pointercancel", finishCanvasPointer);

  function handleStartOrContinue() {
    if (running && paused) {
      paused = false;
      overlay.classList.add("is-hidden");
      if (mobileStartButton) mobileStartButton.hidden = true;
      pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
      lastTime = performance.now();
      animationId = requestAnimationFrame(loop);
    } else {
      startGame();
    }
  }

  startButton.addEventListener("click", handleStartOrContinue);
  mobileStartButton?.addEventListener("click", handleStartOrContinue);
  pauseButton.addEventListener("click", togglePause);

  coarsePointer.addEventListener?.("change", updateControlInstructions);
  makeStars();
  resetPlayer();
  createInvaders();
  highScoreValue.textContent = highScore;
  resizeCanvasDisplay();
  updateControlInstructions();
  draw();
})();
