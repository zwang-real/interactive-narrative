// Image 5 — The Report Card (Part 3), interactive
// The reader grades Garces Trading Company line by line. Click the last
// column of each row to mark whether it beats the city average (it always
// does — every light turns green). Once all rows are graded, a "Reveal the
// outcome" button appears. Clicking it shows that the restaurant closed.
(function () {

    var ROWS = [
        { label: 'Delivery', value: 'Offered',    avg: '54.5% offer it' },
        { label: 'Rating',   value: '4.0 stars',  avg: '3.58 city average' },
        { label: 'Reviews',  value: '~900',       avg: '33 median' },
        { label: 'Parking',  value: 'Yes',        avg: '65.3% have it' },
        { label: 'Price',    value: '$$',         avg: 'most common tier' },
    ];

    var COL_GREEN  = '#2E7D4F';
    var COL_TEXT   = '#1A1A18';
    var COL_SUB    = '#6B6A65';
    var COL_CARD   = '#FAF9F7';
    var COL_LINE   = '#E6E2DC';
    var COL_CLOSED = '#A32D2D';
    var COL_EMPTY  = '#C9C5BD';   // empty grey circle
    var COL_BTN    = '#1A1A18';

    // interaction state lives on the module
    var graded = [false, false, false, false, false];
    var revealed = false;
    // store clickable hit-boxes computed during draw, used by mousePressed
    var hitboxes = [];     // { x, y, r, rowIndex }
    var revealBox = null;  // { x, y, w, h }

    function clamp01(x){ return Math.max(0, Math.min(1, x)); }

    function allGraded() {
        for (var i = 0; i < graded.length; i++) if (!graded[i]) return false;
        return true;
    }

    window.VizReportCard = {

        // reset state each time we (re)enter the section from the top
        resetState: function () {
            graded = [false, false, false, false, false];
            revealed = false;
        },

        draw: function (p, manager, ai, progress) {
            var left = manager.offsetX || 80;
            var top  = (manager.offsetY || 0) + 24;
            var w = (manager.width || 600) - 20;
            var h = (manager.height || 520) - 30;

            hitboxes = [];
            revealBox = null;

            p.push();

            // card
            p.noStroke();
            p.fill(COL_CARD);
            p.rect(left, top, w, h, 10);

            // heading
            p.fill(COL_TEXT);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(19);
            p.text('Garces Trading Company', left + 30, top + 24);

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(10);
            p.fill(COL_SUB);
            p.text('2010 \u2013 2018  \u00B7  independent  \u00B7  Philadelphia', left + 30, top + 52);

            // column headers
            var colCat = left + 30;
            var colVal = left + 150;
            var colAvg = left + 300;
            var colMark = left + w - 70;
            var headY = top + 84;
            p.textFont('IBM Plex Mono');
            p.textSize(10);
            p.fill(COL_SUB);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('CATEGORY',      colCat, headY);
            p.text('THIS RESTAURANT', colVal, headY);
            p.text('CITY AVERAGE',  colAvg, headY);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('BEATS AVG?',    colMark, headY);

            // rows
            var rowsTop = headY + 24;
            var rowH = Math.min(54, (h - 230) / ROWS.length);

            for (var i = 0; i < ROWS.length; i++) {
                var row = ROWS[i];
                var cy = rowsTop + i * rowH + rowH / 2;

                // divider
                p.stroke(COL_LINE);
                p.strokeWeight(1);
                p.line(left + 30, rowsTop + i * rowH, left + w - 30, rowsTop + i * rowH);
                p.noStroke();

                // category
                p.fill(COL_TEXT);
                p.textFont('Spectral');
                p.textStyle(p.BOLD);
                p.textSize(15);
                p.textAlign(p.LEFT, p.CENTER);
                p.text(row.label, colCat, cy);

                // value
                p.textStyle(p.NORMAL);
                p.textSize(14);
                p.text(row.value, colVal, cy);

                // average
                p.fill(COL_SUB);
                p.textFont('IBM Plex Mono');
                p.textSize(11);
                p.text(row.avg, colAvg, cy);

                // clickable mark circle
                var mx = colMark, my = cy, mr = 13;
                hitboxes.push({ x: mx, y: my, r: mr + 4, rowIndex: i });

                if (graded[i]) {
                    var gc = p.color(COL_GREEN);
                    p.fill(gc);
                    p.circle(mx, my, mr * 2);
                    p.stroke(255); p.strokeWeight(2.2); p.noFill();
                    p.line(mx - 5, my, mx - 1.5, my + 4);
                    p.line(mx - 1.5, my + 4, mx + 5, my - 4);
                    p.noStroke();
                } else {
                    // empty grey circle (clickable)
                    p.stroke(COL_EMPTY); p.strokeWeight(2); p.noFill();
                    p.circle(mx, my, mr * 2);
                    p.noStroke();
                }
            }

            // bottom area: prompt + reveal button OR the outcome
            var bottomY = rowsTop + ROWS.length * rowH + 30;

            if (!revealed) {
                if (allGraded()) {
                    // prompt
                    p.fill(COL_TEXT);
                    p.textFont('Spectral');
                    p.textStyle(p.BOLD);
                    p.textSize(18);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text('Every box checked. Did it survive?', left + w / 2, bottomY);

                    // reveal button
                    var bw = 200, bh = 42;
                    var bx = left + w / 2 - bw / 2;
                    var by = bottomY + 26;
                    revealBox = { x: bx, y: by, w: bw, h: bh };
                    p.fill(COL_BTN);
                    p.rect(bx, by, bw, bh, 6);
                    p.fill(255);
                    p.textFont('IBM Plex Mono');
                    p.textStyle(p.NORMAL);
                    p.textSize(13);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text('Reveal the outcome', left + w / 2, by + bh / 2);
                } else {
                    // hint to grade
                    p.fill(COL_SUB);
                    p.textFont('IBM Plex Mono');
                    p.textSize(12);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.text('Click each circle to grade this restaurant against the city.', left + w / 2, bottomY);
                }
            } else {
                // outcome revealed — single red line
                p.textAlign(p.CENTER, p.CENTER);
                p.fill(COL_CLOSED);
                p.textFont('Spectral');
                p.textStyle(p.BOLD);
                p.textSize(24);
                p.text('No. It closed in 2018.', left + w / 2, bottomY + 16);
            }

            p.pop();
        },

        mousePressed: function (p, manager, mx, my) {
            // grade a row?
            for (var i = 0; i < hitboxes.length; i++) {
                var hb = hitboxes[i];
                var d = Math.sqrt((mx - hb.x) * (mx - hb.x) + (my - hb.y) * (my - hb.y));
                if (d <= hb.r) {
                    graded[hb.rowIndex] = true;
                    return;
                }
            }
            // click reveal button?
            if (revealBox && allGraded() && !revealed) {
                if (mx >= revealBox.x && mx <= revealBox.x + revealBox.w &&
                    my >= revealBox.y && my <= revealBox.y + revealBox.h) {
                    revealed = true;
                }
            }
        }
    };
})();