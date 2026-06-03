// Closing epilogue — a full-screen dark starfield that bookends the opening.
// Same fixed-overlay idea as opening_standalone.js, but the scroll distance is
// reserved by a real empty step (#closing-step) in the document, NOT a bare
// spacer. A real step keeps the scroller from flickering between the report
// card and the authors section.
//
// The reveal is driven by a clock that takes the MAX of elapsed time and scroll
// progress: stop and it plays on its own; scroll and you fast-forward it, so a
// fast scroll can never skip past an unrevealed screen. Scrolling out at the end
// fades the overlay away to reveal the authors page.
(function () {
  var COL_BG_RGB = [13, 27, 42];   // same navy as the opening sky, for a bookend
  var STAR_COUNT = 180;
  var SCROLL_TO_SECONDS = 4.5;     // full scroll through the step maps to this many seconds

  var overlay = null, canvas = null, ctx = null, step = null;
  var stars = [];
  var raf = null;
  var enterTime = null;            // timestamp when the closing first filled the screen

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function buildDOM() {
    overlay = document.createElement('div');
    overlay.id = 'closing-overlay';
    overlay.innerHTML =
      '<canvas id="closing-canvas"></canvas>' +
      '<div id="closing-copy">' +
        '<div id="closing-line">The stars don\'t save you.</div>' +
        '<div id="closing-sub">The game was uneven from the start.</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // The empty full-text step in the HTML reserves the scroll distance and is
    // our scroll reference. No spacer is created here anymore.
    step = document.getElementById('closing-step');

    canvas = document.getElementById('closing-canvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function makeStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        r: 0.5 + Math.random() * 1.6,
        base: 0.45 + Math.random() * 0.4,
        twinkleSpeed: 0.0006 + Math.random() * 0.0018,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function resize() {
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function render() {
    raf = requestAnimationFrame(render);
    if (!canvas || !ctx || !step || !overlay) return;

    var W = window.innerWidth;
    var H = window.innerHeight;
    var rect = step.getBoundingClientRect();
    var entryOffset = H * 0.5;  // start overlay when step top is at mid-viewport
    var inZone = rect.top <= entryOffset && rect.bottom >= H;
    var total = Math.max(1, step.offsetHeight - entryOffset);
    var progress = clamp01((-rect.top + entryOffset) / total);

    // Outside the closing: hide the overlay and reset, so the animation replays
    // cleanly if the reader scrolls back up and returns.
    if (!inZone) {
      overlay.style.opacity = '0';
      overlay.style.visibility = 'hidden';
      enterTime = null;
      return;
    }
    overlay.style.visibility = 'visible';
    if (enterTime === null) enterTime = performance.now();

    // Reveal clock: max of real elapsed time and scroll-mapped time. Idle -> plays
    // on its own; scrolling -> fast-forwards it, so scroll can never outrun it.
    var byTime = (performance.now() - enterTime) / 1000;
    var byScroll = progress * SCROLL_TO_SECONDS;
    var elapsed = Math.max(byTime, byScroll);

    var skyIn   = clamp01(elapsed / 0.5);                       // navy sky dissolves in
    var starsIn = clamp01((elapsed - 0.3) / 1.4);               // stars rise
    var line1In = easeInOut(clamp01((elapsed - 1.3) / 1.0));    // first line
    var line2In = easeInOut(clamp01((elapsed - 2.2) / 1.0));    // second line

    // Scroll out at the very end fades the whole overlay to reveal authors.
    // Starts after the reveal has finished (byScroll ~3.5s at progress 0.78).
    var exitFade = 1 - clamp01((progress - 0.78) / 0.22);
    overlay.style.opacity = String(skyIn * exitFade);

    // Background sky.
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgb(' + COL_BG_RGB[0] + ',' + COL_BG_RGB[1] + ',' + COL_BG_RGB[2] + ')';
    ctx.fillRect(0, 0, W, H);

    // Stars: twinkle with a sine wave, faded in over time, soft glow like the opening.
    var t = performance.now();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var twinkle = (s.base + 0.35 * Math.sin(t * s.twinkleSpeed + s.phase)) * starsIn;
      if (twinkle < 0) twinkle = 0;
      var x = s.x * W, y = s.y * H;
      var glowR = s.r * 3.2;
      var grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      grad.addColorStop(0, 'rgba(245,240,232,' + (0.5 * twinkle) + ')');
      grad.addColorStop(0.5, 'rgba(245,240,232,' + (0.16 * twinkle) + ')');
      grad.addColorStop(1, 'rgba(245,240,232,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,250,245,' + (0.95 * twinkle) + ')';
      ctx.beginPath();
      ctx.arc(x, y, s.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Two lines fade in on the timeline; the overlay carries them out at the end.
    var lineEl = document.getElementById('closing-line');
    var subEl = document.getElementById('closing-sub');
    if (lineEl) lineEl.style.opacity = String(line1In);
    if (subEl) subEl.style.opacity = String(line2In);
  }

  function init() {
    buildDOM();
    makeStars();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();