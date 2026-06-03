// sketch_manager.js

function startP5() {

    var localRenderer = window.Renderer;

    function getVisSize() {
        var isMobile = window.innerWidth <= 700;
        var w, h, margin;
        if (isMobile) {
            w = window.innerWidth - 24;
            margin = { top: 0, left: Math.round(w * 0.07), bottom: 96, right: 8 };
            h = Math.round(w * (520 / 600));
        } else {
            margin = { top: 0, left: 80, bottom: 96, right: 10 };
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

        this.state = { activeIndex: 0, progress: 0 };
        this.data = [];

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
                p.clear();
                self.draw(p);

                var pr = self.state.progress || 0;
                var activeIdx = self.state.activeIndex || 0;
                var ease = 0.05;
                var travel = 20;
                var tx, op;
                function smoothstep(t) { return t * t * (3 - 2 * t); }
                if (pr < ease) {
                    var t1 = smoothstep(pr / ease);
                    tx = (1 - t1) * travel; op = t1;
                } else if (pr > 1 - ease) {
                    var t2 = smoothstep((pr - (1 - ease)) / ease);
                    tx = -t2 * travel; op = 1 - t2;
                } else {
                    tx = 0; op = 1;
                }

                // canvas transition
                p.canvas.style.transform = 'translateY(' + tx.toFixed(2) + 'px)';
                p.canvas.style.opacity = op.toFixed(3);

                var isFullText = !!(document.querySelector('#graphic.layout-full-text'));

                // ── KEY FIX: reset EVERY step each frame, so no step keeps a
                // stale opacity/transform from a previous scroll position. ──
                // All text steps stay fully visible. Only the canvas fades/transitions.
                var allSteps = document.querySelectorAll('#sections .step');
                allSteps.forEach(function (step) {
                    step.style.opacity = '1';
                    step.style.transform = 'none';
                });

                var dbg = document.getElementById('debug-state');
                if (dbg) {
                    dbg.textContent = 'activeIndex: ' + activeIdx + '   progress: ' + pr.toFixed(2);
                }
            };

            p.mousePressed = function () {
                var ai = self.state.activeIndex || 0;
                if (ai === 5 && window.VizSurvivalDashboard && window.VizSurvivalDashboard.mousePressed) {
                    window.VizSurvivalDashboard.mousePressed(p, self, p.mouseX, p.mouseY);
                }
                if (ai === 8 && window.VizReportCard && window.VizReportCard.mousePressed) {
                    window.VizReportCard.mousePressed(p, self, p.mouseX, p.mouseY);
                }
            };
            p.mouseMoved = function () {
                var ai = self.state.activeIndex || 0;
                if (ai === 5 && window.VizSurvivalDashboard && window.VizSurvivalDashboard.mouseMoved) {
                    window.VizSurvivalDashboard.mouseMoved(p, self, p.mouseX, p.mouseY);
                }
            };
        };

        this.p5 = new p5(sketch);
    }

    SketchManager.prototype.setState = function (s) {
        if (s.activeIndex !== undefined) this.state.activeIndex = s.activeIndex;
        if (s.progress !== undefined) this.state.progress = s.progress;
    };
    SketchManager.prototype.setData = function (newData) {
        return localRenderer.setData(this, newData);
    };
    SketchManager.prototype.draw = function (p) {
        var ai = this.state.activeIndex || 0;
        var progress = this.state.progress || 0;
        localRenderer.draw(p, this, ai, progress);
    };

    if (window.__sketchAPI && window.__sketchAPI.p5) {
        try { window.__sketchAPI.p5.remove(); } catch (e) { }
        window.__sketchAPI = null;
    }
    var manager = new SketchManager();
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
    if (setDataResult && typeof setDataResult.then === 'function') {
        api.ready = setDataResult.then(function () { return api; });
    } else {
        api.ready = Promise.resolve(api);
    }
    api.ready.then(function () {
        try { window.__sketchAPI = api; } catch (e) { }
    }).catch(function () {
        try { window.__sketchAPI = api; } catch (e) { }
    });

    return api;
}
