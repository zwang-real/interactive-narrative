// Standalone opening animation — an independent full-screen intro.
// A night sky of Philadelphia restaurants. As the reader scrolls, closed
// ones go dark; the title appears; the dark sky fades into the white article.
// This does NOT use the scrollytelling canvas system — it manages its own.
(function () {

    var COL_BG_RGB = [13, 27, 42];     // deep navy #0D1B2A
    var COL_IND    = [240, 150, 100];  // independent — warm orange
    var COL_CHAIN  = [130, 195, 255];  // chain — bright cool blue
    var SAMPLE_SIZE = 420;

    var canvas, ctx, dots = [], raf = null;
    var dataReady = false;

    function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
    function easeOut(t){return 1-Math.pow(1-t,3);}
    function easeInOut(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
    function clamp01(x){return Math.max(0,Math.min(1,x));}

    // ── Load data ───────────────────────────────────────────────────────────
    function loadData() {
        fetch('data/yelp_filtered/restaurants_clean.json')
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (rows) {
                rows = rows || [];
                var sampled = shuffle(rows.slice()).slice(0, SAMPLE_SIZE);
                dots = sampled.map(function (d) {
                    var tier = Math.random();
                    var baseR = tier > 0.9 ? 2.6 + Math.random()*1.4
                              : tier > 0.6 ? 1.4 + Math.random()*0.8
                              : 0.8 + Math.random()*0.6;
                    return {
                        rx: Math.random(),
                        ry: Math.random(),
                        baseR: baseR,
                        isChain:  !!d.is_chain,
                        isClosed: (+d.is_open === 0) || (d.survived === false),
                        dieOrder: Math.random(),
                        phase: Math.random() * Math.PI * 2,
                        twinkleSpeed: 0.0008 + Math.random() * 0.0016,
                    };
                });
                dataReady = true;
            })
            .catch(function () { dataReady = true; });
    }

    // ── Build DOM ───────────────────────────────────────────────────────────
    function buildDOM() {
        // The overlay container fixed over everything
        var overlay = document.createElement('div');
        overlay.id = 'opening-overlay';
        overlay.innerHTML =
            '<canvas id="opening-canvas"></canvas>' +
            '<div id="opening-title">The Stars Don\'t Save You</div>' +
            '<div id="opening-hint">scroll &#8595;</div>';
        document.body.appendChild(overlay);

        // A tall spacer that gives us scroll distance for the intro
        var spacer = document.createElement('div');
        spacer.id = 'opening-spacer';
        document.body.insertBefore(spacer, document.body.firstChild);

        canvas = document.getElementById('opening-canvas');
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) return;
        var dpr = window.devicePixelRatio || 1;
        canvas.width  = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width  = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── Animation loop ──────────────────────────────────────────────────────
    function render() {
        raf = requestAnimationFrame(render);
        if (!canvas || !ctx) return;

        var W = window.innerWidth;
        var H = window.innerHeight;

        // scroll progress across the spacer (0 at top, 1 when intro scrolled away)
        var spacer = document.getElementById('opening-spacer');
        var spacerH = spacer ? spacer.offsetHeight : H;
        var scrollY = window.scrollY || window.pageYOffset;
        var progress = clamp01(scrollY / (spacerH - H));

        var overlay = document.getElementById('opening-overlay');

        // Once fully scrolled past, hide overlay entirely (let article take over)
        if (progress >= 1) {
            if (overlay) overlay.style.opacity = '0';
            if (overlay) overlay.style.pointerEvents = 'none';
            return;
        } else {
            if (overlay) overlay.style.pointerEvents = 'none'; // never block scroll
        }

        // ── fade-to-white in the last 15% of scroll ──
        var whiten = easeInOut(clamp01((progress - 0.85) / 0.15));
        var bg = [
            Math.round(COL_BG_RGB[0] + (255 - COL_BG_RGB[0]) * whiten),
            Math.round(COL_BG_RGB[1] + (255 - COL_BG_RGB[1]) * whiten),
            Math.round(COL_BG_RGB[2] + (255 - COL_BG_RGB[2]) * whiten),
        ];
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
        ctx.fillRect(0, 0, W, H);

        // overall fade of the whole overlay near the very end
        if (overlay) overlay.style.opacity = String(1 - clamp01((progress - 0.92) / 0.08));

        // fade in the cover-info block as the sky whitens
        var cover = document.getElementById('cover-info');
        if (cover) {
            var coverFade = clamp01((progress - 0.8) / 0.18);
            cover.style.opacity = String(coverFade);
            cover.style.transition = 'none';
        }

        if (!dataReady || !dots.length) return;

        var t = performance.now();
        var marginX = W * 0.05, marginY = H * 0.08;
        var fieldW = W - marginX*2, fieldH = H - marginY*2;
        var dieWindow = clamp01((progress - 0.1) / 0.7);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // stars dim overall as we whiten
        var starDim = 1 - whiten;

        dots.forEach(function (dot) {
            var x = marginX + dot.rx * fieldW;
            var y = marginY + dot.ry * fieldH;
            var rgb = dot.isChain ? COL_CHAIN : COL_IND;
            var twinkle = 0.7 + 0.3 * Math.sin(t * dot.twinkleSpeed + dot.phase);
            var intensity = twinkle;
            if (dot.isClosed) {
                var localDie = clamp01((dieWindow - dot.dieOrder * 0.85) / 0.18);
                intensity = twinkle * (1 - easeOut(localDie));
            }
            intensity *= starDim;
            if (intensity <= 0.01) return;

            var r = dot.baseR;
            var glowR = r * 2.4;
            var grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
            grad.addColorStop(0,   'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(0.55*intensity)+')');
            grad.addColorStop(0.5, 'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(0.18*intensity)+')');
            grad.addColorStop(1,   'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, glowR, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,250,245,'+(0.95*intensity)+')';
            ctx.beginPath();
            ctx.arc(x, y, r*0.55, 0, Math.PI*2);
            ctx.fill();
        });

        ctx.restore();

        // ── Title & hint (DOM elements, so font rendering is crisp) ──
        var titleEl = document.getElementById('opening-title');
        var hintEl  = document.getElementById('opening-hint');
        var titleProg = easeInOut(clamp01((progress - 0.4) / 0.4));
        if (titleEl) titleEl.style.opacity = String(titleProg * starDim);
        if (hintEl)  hintEl.style.opacity  = String((1 - clamp01(progress / 0.12)) * 0.7);
    }

    // ── Init ────────────────────────────────────────────────────────────────
    function init() {
        buildDOM();
        loadData();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();