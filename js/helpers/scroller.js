// scroller.js
// Small Scroller abstraction (extracted from sections_p5.js) that computes
// active step index and progress and exposes a lightweight .on(action, cb)
(function () {
    function Scroller(containerSelector, stepSelector, trigger) {
        this.container = document.querySelector(containerSelector) || document.body;
        this.steps = Array.prototype.slice.call(document.querySelectorAll(stepSelector));
        // sectionPositions will store absolute page Y positions (window.pageYOffset + element top)
        this.sectionPositions = [];
        this.trigger = trigger || 'top'; // 'top' or 'center'
        this.currentIndex = -1;
        this.onActive = function () { };
        this.onProgress = function () { };

        var self = this;
        this.resize = function () {
            self.sectionPositions = [];
            self.steps.forEach(function (el) {
                // store absolute positions according to trigger type:
                // - 'center' -> element vertical center
                // - otherwise -> element top
                var rect = el.getBoundingClientRect();
                var top = rect.top + window.pageYOffset;
                if (self.trigger === 'center') {
                    if (el.dataset && el.dataset.activateAt === 'enter') {
                        self.sectionPositions.push(top - window.innerHeight * 0.25);
                        return;
                    }
                    var centerY = top + (rect.height / 2);
                    self.sectionPositions.push(centerY + window.innerHeight * 0.06);
                } else {
                    self.sectionPositions.push(top);
                }
            });
        };

        this.position = function () {
            // Determine the Y coordinate (absolute page Y) at which we consider a step "active"
            var triggerY;
            if (self.trigger === 'center') {
                triggerY = window.pageYOffset + (window.innerHeight / 2);
            } else {
                // default to a small offset from top of viewport
                triggerY = window.pageYOffset + 10;
            }

            var sectionIndex = 0;
            for (var i = 0; i < self.sectionPositions.length; i++) {
                if (triggerY >= self.sectionPositions[i]) sectionIndex = i;
                else break;
            }
            sectionIndex = Math.min(self.sectionPositions.length - 1, sectionIndex);

            if (self.currentIndex !== sectionIndex) {
                self.currentIndex = sectionIndex;
                self.onActive(sectionIndex);
            }

            // Compute progress (0..1) through the current section.
            // For center trigger: progress travels 0→1 as the section's center
            // moves through ±40% of the viewport height around the viewport center.
            // For top trigger: progress is fraction through the element's height.
            var elem = self.steps[sectionIndex];
            var rect = elem.getBoundingClientRect();
            var elemTop = rect.top + window.pageYOffset;
            var elemHeight = rect.height || 1;
            var progress;
            if (self.trigger === 'center') {
                var sectionCenter = elemTop + elemHeight / 2;
                var viewportCenter = window.pageYOffset + window.innerHeight / 2;
                var band = window.innerHeight * 0.26;
                progress = Math.max(0, Math.min(1, (viewportCenter - sectionCenter + band) / (2 * band)));
            } else {
                progress = Math.max(0, Math.min(1, (triggerY - elemTop) / elemHeight));
            }
            // console.log('scroller: sectionIndex=', sectionIndex, ' progress=', progress.toFixed(3));
            self.onProgress(sectionIndex, progress);
        };

        window.addEventListener('resize', this.resize);
        window.addEventListener('scroll', this.position);
        setTimeout(function () { self.resize(); self.position(); }, 50);
    }

    Scroller.prototype.on = function (action, cb) {
        if (action === 'active') this.onActive = cb;
        if (action === 'progress') this.onProgress = cb;
        return this;
    };

    window.Scroller = Scroller;
})();
