// sketch_manager.js

function startP5() {

    var localRenderer;
    // localRenderer = window.TemplateRenderer;
    localRenderer = window.Renderer;

    // --- Sketch manager ----------------------------------------------------
    function getVisSize() {
        var isMobile = window.innerWidth <= 700;
        var w, h, margin;
        if (isMobile) {
            w = window.innerWidth - 24;
            margin = { top: 0, left: Math.round(w * 0.07), bottom: 25, right: 8 };
            h = Math.round(w * (520 / 600));
        } else {
            margin = { top: 0, left: 80, bottom: 4, right: 10 };
            var isFullViz = !!(document.querySelector('#graphic.layout-full-viz'));
            var rawW = isFullViz
                ? Math.round(window.innerWidth) - 40
                : Math.round(window.innerWidth * 0.70) - 60;
            var availW = rawW - margin.left - margin.right;
            var wFromHeight = Math.round((window.innerHeight - 120) * (600 / 520)) - margin.left - margin.right;
            w = Math.min(availW, wFromHeight);
            h = Math.round(w * (520 / 600));
        }
        return { width: w, height: h, margin: margin };
    }

    function SketchManager() {
        var size = getVisSize();
        this.width = size.width;
        this.height = size.height;
        this.margin = size.margin;
        this.canvasWidth = this.width + this.margin.left + this.margin.right;
        this.canvasHeight = this.height + this.margin.top + this.margin.bottom;

        // drawing state
        this.state = { activeIndex: 0, progress: 0 };

        // data will be attached by localRenderer.setData(manager, data)
        this.data = [];

        // create the p5 instance bound to this manager
        var self = this;
        var sketch = function (p) {
            p.setup = function () {
                var parent = document.getElementById('vis');
                parent.innerHTML = '';
                p.createCanvas(self.canvasWidth, self.canvasHeight).parent('vis');
                p.noStroke();
                p.frameRate(30);
            };

            p.windowResized = function () {
                var s = getVisSize();
                self.width = s.width;
                self.height = s.height;
                self.margin = s.margin;
                self.canvasWidth = s.width + s.margin.left + s.margin.right;
                self.canvasHeight = s.height + s.margin.top + s.margin.bottom;
                self._randomPoints = null;
                self._barCounts = null;
                p.resizeCanvas(self.canvasWidth, self.canvasHeight);
            };

            p.draw = function () {
                p.background(255);
                self.draw(p);

                // scroll in/out transition using progress
                var pr = self.state.progress || 0;
                var ease = 0.05;
                var travel = 20;
                var tx, op;
                function smoothstep(t) { return t * t * (3 - 2 * t); }
                if (pr < ease) {
                    var t = smoothstep(pr / ease);
                    tx = (1 - t) * travel;
                    op = t;
                } else if (pr > 1 - ease) {
                    var t = smoothstep((pr - (1 - ease)) / ease);
                    tx = -t * travel;
                    op = 1 - t;
                } else {
                    tx = 0;
                    op = 1;
                }
                p.canvas.style.transform = 'translateY(' + tx.toFixed(2) + 'px)';
                p.canvas.style.opacity = op.toFixed(3);

                // mirror transition on the active text step
                var activeStep = document.querySelector('.step[data-active-index="' + (self.state.activeIndex || 0) + '"]');
                if (activeStep) {
                    activeStep.style.transform = 'translateY(' + tx.toFixed(2) + 'px)';
                    activeStep.style.opacity = op.toFixed(3);
                }

                var dbg = document.getElementById('debug-state');
                if (dbg) {
                    dbg.textContent = 'activeIndex: ' + (self.state.activeIndex || 0) + '   progress: ' + pr.toFixed(2);
                }
            };

            // ── Mouse events ──────────────────────────────────────────────
            p.mousePressed = function () {
                var ai = self.state.activeIndex || 0;
                if (ai === 3 && window.VizSurvivalDashboard && window.VizSurvivalDashboard.mousePressed) {
                    window.VizSurvivalDashboard.mousePressed(p, self, p.mouseX, p.mouseY);
                }
            };

            p.mouseMoved = function () {
                var ai = self.state.activeIndex || 0;
                if (ai === 3 && window.VizSurvivalDashboard && window.VizSurvivalDashboard.mouseMoved) {
                    window.VizSurvivalDashboard.mouseMoved(p, self, p.mouseX, p.mouseY);
                }
            };
        };

        this.p5 = new p5(sketch);
    }


    // set visualization state (called by scroll logic)
    SketchManager.prototype.setState = function (s) {
        if (s.activeIndex !== undefined) this.state.activeIndex = s.activeIndex;
        if (s.progress !== undefined) this.state.progress = s.progress;
    };

    // delegate data handling to localRenderer
    SketchManager.prototype.setData = function (newData) {
        return localRenderer.setData(this, newData);
    };

    // simple drawing routine, split into helpers for clarity
    SketchManager.prototype.draw = function (p) {
        var ai = this.state.activeIndex || 0;
        var progress = this.state.progress || 0;
        localRenderer.draw(p, this, ai, progress);
    };

    // create (or replace) singleton manager and expose API
    if (window.__sketchAPI && window.__sketchAPI.p5) {
        try { window.__sketchAPI.p5.remove(); } catch (e) { }
        window.__sketchAPI = null;
    }
    var manager = new SketchManager();
    // initialize data via localRenderer (fail fast if missing)
    if (!localRenderer || typeof localRenderer.setData !== 'function') {
        throw new Error('localRenderer.setData is required at startup.');
    }

    var setDataResult = localRenderer.setData(manager);

    var api = {
        setState: manager.setState.bind(manager),
        setData: manager.setData.bind(manager),
        p5: manager.p5,
        data: manager.data
    };

    // Expose a `ready` promise so callers can wait until data/layout are ready.
    if (setDataResult && typeof setDataResult.then === 'function') {
        api.ready = setDataResult.then(function () { return api; });
    } else {
        api.ready = Promise.resolve(api);
    }

    // Expose the API globally once ready so consumers (like sections) see
    // the populated data without racing the async load.
    api.ready.then(function () {
        try { window.__sketchAPI = api; } catch (e) { }
    }).catch(function () {
        try { window.__sketchAPI = api; } catch (e) { }
    });

    return api;
}