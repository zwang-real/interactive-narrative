// Survival rate by variable — interactive dashboard
(function () {

    var COL_HIGH   = '#E69F00';
    var COL_LOW    = '#0072B2';
    var COL_BG     = '#ffffff';
    var COL_BTN    = '#f0ede8';
    var COL_BTN_A  = '#e6e2dc';
    var COL_TEXT   = '#1a1a18';
    var COL_MUTED  = '#5f5e5a';
    var COL_BORDER = '#e6e2dc';
    var FONT_TITLE = 22;
    var FONT_LABEL = 15;
    var FONT_SMALL = 15;

    var VARIABLES = [
        { key: 'delivery',    label: 'Delivery'  },
        { key: 'takeout',     label: 'Takeout'   },
        { key: 'price_range', label: 'Price'     },
        { key: 'parking',     label: 'Parking'   },
        { key: 'cuisine',     label: 'Cuisine'   },
    ];

    var survivalData  = null;
    var activeVar     = 'delivery';
    var buttons       = [];
    var bars          = [];
    var hoveredBar    = -1;
    var animProgress  = {};
    var lastFrameTime = 0;

    function pct(rate) { return (rate * 100).toFixed(1) + '%'; }
    function lerp(a, b, t) { return a + (b - a) * Math.min(t, 1); }

    var isCuisine = function() { return activeVar === 'cuisine'; };

    function buildLayout(p, manager) {
        var W = manager.width  || p.width;
        var H = manager.height || p.height;

        var panelW = 142;
        var panelX = (manager.offsetX || 0) + 16;
        var panelY = (manager.offsetY || 0) + 76;
        var btnH   = 42;
        var btnGap = 10;

        buttons = VARIABLES.map(function (v, i) {
            return {
                x: panelX, y: panelY + i * (btnH + btnGap),
                w: panelW, h: btnH,
                key: v.key, label: v.label,
            };
        });

        var chartX = panelX + panelW + 20;
        var chartY = (manager.offsetY || 0) + 52;
        var chartW = W - chartX + (manager.offsetX || 0) - 88;
        var chartH = H - chartY - (manager.offsetY || 0) - 56;

        buildBars(chartX, chartY, chartW, chartH);
    }

    function buildBars(chartX, chartY, chartW, chartH) {
        if (!survivalData) return;
        var rows = survivalData[activeVar] || [];
        var n    = rows.length;
        var gap  = n <= 2 ? 64 : (n > 10 ? 4 : (n > 6 ? 8 : 18));
        var barW = n ? Math.min(40, (chartW - gap * (n + 1)) / n) : 40;
        var totalW = n * barW + (n - 1) * gap;
        var startX = chartX + (chartW - totalW) / 2;

        // cuisine: leave more room at bottom for angled labels
        var labelAreaH = isCuisine() ? 76 : 34;
        var maxH = chartH - labelAreaH - 24;

        bars = rows.map(function (d, i) {
            var key = activeVar + '_' + i;
            if (animProgress[key] === undefined) animProgress[key] = 0;
            return {
                x: startX + i * (barW + gap), y: chartY,
                w: barW, maxH: maxH,
                chartBottom: chartY + maxH,
                rate: d.survival_rate, label: d.label, count: d.count, key: key,
            };
        });
    }

    function drawButtons(p) {
        buttons.forEach(function (btn) {
            var active = btn.key === activeVar;
            p.noStroke();
            p.fill(active ? COL_BTN_A : COL_BTN);
            p.rect(btn.x, btn.y, btn.w, btn.h, 6);
            if (active) { p.fill(COL_HIGH); p.rect(btn.x, btn.y, 3, btn.h, 3); }
            p.fill(active ? COL_TEXT : COL_MUTED);
            p.textFont('IBM Plex Mono');
            p.textSize(FONT_LABEL);
            p.textAlign(p.LEFT, p.CENTER);
            p.noStroke();
            p.text(btn.label, btn.x + 14, btn.y + btn.h / 2);
        });
    }

    function drawBars(p, dt, manager) {
        if (!bars.length) return;
        var cuisine = isCuisine();

        // 50% reference line
        var refY = bars[0].chartBottom - bars[0].maxH * 0.5;
        p.stroke(COL_BORDER);
        p.strokeWeight(1);
        p.drawingContext.setLineDash([4, 4]);
        p.line(bars[0].x - 8, refY, bars[bars.length-1].x + bars[bars.length-1].w + 8, refY);
        p.drawingContext.setLineDash([]);
        p.noStroke();
        p.fill(COL_MUTED);
        p.textFont('IBM Plex Mono');
        p.textSize(11);
        p.textAlign(p.LEFT, p.CENTER);
        p.text('50%', bars[bars.length-1].x + bars[bars.length-1].w + 8, refY);

        bars.forEach(function (bar, i) {
            animProgress[bar.key] = lerp(animProgress[bar.key], 1, dt * 4);
            var barH   = bar.maxH * bar.rate * animProgress[bar.key];
            var barTop = bar.chartBottom - barH;

            var col = p.color(bar.rate >= 0.5 ? COL_HIGH : COL_LOW);
            col.setAlpha(i === hoveredBar ? 255 : 200);
            p.noStroke();
            p.fill(col);
            p.rect(bar.x, barTop, bar.w, barH, 3, 3, 0, 0);

            if (cuisine) {
                // Angled label only, no percentage above bar
                p.push();
                p.translate(bar.x + bar.w / 2, bar.chartBottom + 8);
                p.rotate(p.PI / 4);   // +45 degrees (toward right)
                p.fill(COL_MUTED);
                p.textFont('IBM Plex Mono');
                p.textSize(FONT_SMALL);
                p.textAlign(p.LEFT, p.CENTER);
                p.noStroke();
                // show full label — angled so it fits diagonally
                var displayLabel = bar.label;
                p.text(displayLabel, 0, 0);
                p.pop();
            } else {
                // Normal: percentage above, horizontal label below
                p.fill(COL_TEXT);
                p.textFont('IBM Plex Mono');
                p.textSize(FONT_LABEL);
                p.textAlign(p.CENTER, p.BOTTOM);
                p.noStroke();
                p.text(pct(bar.rate), bar.x + bar.w / 2, barTop - 2);

                p.fill(COL_MUTED);
                p.textSize(FONT_SMALL);
                p.textAlign(p.CENTER, p.TOP);
                var labelLines = wrapLabel(bar.label, 10);
                labelLines.forEach(function (line, li) {
                    p.text(line, bar.x + bar.w / 2, bar.chartBottom + 5 + li * 15);
                });
            }

            if (i === hoveredBar) drawTooltip(p, bar, manager);
        });
    }

    function wrapLabel(label, maxLen) {
        if (label.length <= maxLen) return [label];
        var words = label.split(/[\s&]+/);
        var lines = [], current = '';
        words.forEach(function (w) {
            if ((current + ' ' + w).trim().length > maxLen) {
                if (current) lines.push(current.trim());
                current = w;
            } else {
                current = (current + ' ' + w).trim();
            }
        });
        if (current) lines.push(current.trim());
        return lines;
    }

    function drawTooltip(p, bar, manager) {
        var tx = bar.x + bar.w / 2;
        var ty = bar.chartBottom - bar.maxH * bar.rate - 28;
        var tw = 160, th = 42;
        // clamp tooltip horizontally within canvas width
        var canvasW = p.width;
        tx = Math.min(tx, canvasW - tw / 2 - 8);
        tx = Math.max(tx, tw / 2 + 8);
        // clamp tooltip vertically so it doesn't go above canvas
        if (ty - th < 4) ty = th + 4;

        p.noStroke();
        p.fill(40);
        p.rect(tx - tw / 2, ty - th, tw, th, 4);
        p.fill(255);
        p.textFont('IBM Plex Mono');
        p.textSize(FONT_SMALL);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(bar.label + ': ' + pct(bar.rate), tx, ty - th * 0.65);
        p.fill(180);
        p.textSize(FONT_SMALL);
        p.text('n = ' + bar.count.toLocaleString(), tx, ty - th * 0.25);
    }

    function drawTitle(p, manager) {
        var labels = { delivery: 'Delivery', takeout: 'Takeout', price_range: 'Price Range', parking: 'Parking', cuisine: 'Cuisine Type' };
        var oX = manager.offsetX || 0, oY = manager.offsetY || 0;
        p.noStroke();
        p.fill(COL_TEXT);
        p.textFont('Spectral');
        p.textSize(FONT_TITLE);
        p.textAlign(p.LEFT, p.TOP);
        p.text('Survival Rate by ' + (labels[activeVar] || activeVar), oX + 16, oY + 16);
        p.fill(COL_MUTED);
        p.textFont('IBM Plex Mono');
        p.textSize(FONT_SMALL);
        p.text('Philadelphia restaurants \u00b7 Yelp dataset through Jan 2022', oX + 16, oY + 36);
    }

    function drawLegend(p, manager) {
        var oX = manager.offsetX || 0, oY = manager.offsetY || 0;
        var lx = oX + 16, ly = oY + (manager.height || p.height) - 22;
        p.noStroke();
        p.fill(COL_HIGH); p.rect(lx, ly, 10, 10, 2);
        p.fill(COL_MUTED); p.textFont('IBM Plex Mono'); p.textSize(FONT_SMALL); p.textAlign(p.LEFT, p.CENTER);
        p.text('\u2265 50% survival', lx + 14, ly + 5);
        p.fill(COL_LOW); p.rect(lx + 154, ly, 10, 10, 2);
        p.fill(COL_MUTED); p.text('< 50% survival', lx + 168, ly + 5);
    }

    function checkButtonClick(mx, my, p, manager) {
        for (var i = 0; i < buttons.length; i++) {
            var b = buttons[i];
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
                if (activeVar !== b.key) {
                    activeVar = b.key;
                    var rows = (survivalData || {})[activeVar] || [];
                    rows.forEach(function (_, j) { animProgress[activeVar + '_' + j] = 0; });
                    buildLayout(p, manager);
                }
                return true;
            }
        }
        return false;
    }

    function checkBarHover(mx, my) {
        hoveredBar = -1;
        for (var i = 0; i < bars.length; i++) {
            var b = bars[i];
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.chartBottom) { hoveredBar = i; break; }
        }
    }

    window.VizSurvivalDashboard = {
        prepareData: function (raw) {
            survivalData = raw || null;
            animProgress = {};
            return survivalData;
        },
        // Switch the active variable from outside the canvas (a clicked number in
        // the prose). draw() rebuilds the bars from activeVar every frame, so we
        // only set the variable and reset its bars so they grow in again.
        setVariable: function (key) {
            var valid = VARIABLES.some(function (v) { return v.key === key; });
            if (!valid || activeVar === key) return;
            activeVar = key;
            var rows = (survivalData || {})[activeVar] || [];
            rows.forEach(function (_, j) { animProgress[activeVar + '_' + j] = 0; });
        },
        draw: function (p, manager) {
            var now = p.millis();
            var dt  = Math.min((now - lastFrameTime) / 1000, 0.1);
            lastFrameTime = now;

            p.noStroke();
            p.fill(COL_BG);
            p.rect(manager.offsetX || 0, manager.offsetY || 0, manager.width || p.width, manager.height || p.height);

            if (!survivalData) {
                p.fill(COL_MUTED); p.textFont('IBM Plex Mono'); p.textSize(FONT_LABEL);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('Loading data\u2026', (manager.width || p.width) / 2, (manager.height || p.height) / 2);
                return;
            }

            buildLayout(p, manager);
            drawTitle(p, manager);
            drawButtons(p);
            drawBars(p, dt, manager);
            drawLegend(p, manager);
        },

        mousePressed: function (p, manager, mx, my) { checkButtonClick(mx, my, p, manager); },
        mouseMoved:   function (p, manager, mx, my) { checkBarHover(mx, my); },
    };
})();
