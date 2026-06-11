// Image 5 — The Report Card (Part 3), interactive
(function () {

    var RESTAURANTS = [
        { name: 'Kanella South' },
        { name: 'Barbuzzo' }
    ];

    var FACTORS = [
        { label: 'Delivery',  bench: '54.5% offer it',  counts: true,
          vals: ['Not offered', 'Offered'], beats: [false, true] },
        { label: 'Takeout',   bench: 'most offer it',    counts: true,
          vals: ['No', 'Yes'], beats: [false, true] },
        { label: 'Cuisine',   bench: 'city 55% survive', counts: true,
          vals: ['Greek \u00B7 47%', 'Pizza \u00B7 62%'], beats: [false, true] },
        { label: 'Rating',    bench: 'city avg 3.58',    counts: false,
          vals: ['4.5\u2605', '4.5\u2605'], beats: [true, true] },
        { label: 'Parking',   bench: '65.3% have it',    counts: false,
          vals: ['Yes', 'Yes'], beats: [true, true] }
    ];

    var COL_GREEN  = '#2E7D4F';
    var COL_TEXT   = '#1A1A18';
    var COL_SUB    = '#6B6A65';
    var COL_CARD   = '#FAF9F7';
    var COL_LINE   = '#E6E2DC';
    var COL_CLOSED = '#A32D2D';
    var COL_EMPTY  = '#C9C5BD';
    var COL_BTN    = '#1A1A18';
    var COL_FLASH  = '#E69F00';

    var judged = [[false,false],[false,false],[false,false],[false,false],[false,false]];
    var outcomeRevealed = false;
    var flash = [0,0,0,0,0];
    var cellHits = [];
    var revealBox = null;

    function clamp01(x){ return Math.max(0, Math.min(1, x)); }
    function allJudged(){
        for (var i=0;i<5;i++) if(!judged[i][0]||!judged[i][1]) return false;
        return true;
    }
    function countingJudged(col){
        for (var i=0;i<FACTORS.length;i++) if(FACTORS[i].counts && !judged[i][col]) return false;
        return true;
    }
    function score(col){
        var s=0;
        for (var i=0;i<FACTORS.length;i++) if(FACTORS[i].counts && FACTORS[i].beats[col]) s++;
        return s;
    }
    function drawMark(p, x, y, on, beats){
        var r=10;
        if(!on){
            p.stroke(COL_EMPTY); p.strokeWeight(2); p.noFill();
            p.drawingContext.setLineDash([3,3]); p.circle(x,y,r*2);
            p.drawingContext.setLineDash([]); p.noStroke();
        } else if(beats){
            p.noStroke(); p.fill(COL_GREEN); p.circle(x,y,r*2);
            p.stroke(255); p.strokeWeight(2.1); p.noFill();
            p.line(x-4,y, x-1.3,y+3.2); p.line(x-1.3,y+3.2, x+4,y-3.2); p.noStroke();
        } else {
            p.noStroke(); p.fill(COL_CLOSED); p.circle(x,y,r*2);
            p.stroke(255); p.strokeWeight(2.1);
            p.line(x-3.5,y-3.5, x+3.5,y+3.5); p.line(x-3.5,y+3.5, x+3.5,y-3.5); p.noStroke();
        }
    }

    window.VizReportCard = {

        resetState: function(){
            judged = [[false,false],[false,false],[false,false],[false,false],[false,false]];
            outcomeRevealed = false;
            flash = [0,0,0,0,0];
        },

        flashRow: function(index){
            if(index>=0 && index<5){ judged[index][0]=true; judged[index][1]=true; flash[index]=performance.now(); }
        },

        draw: function(p, manager, ai, progress){
            var left = manager.offsetX || 80;
            var top  = (manager.offsetY || 0) + 20;
            var w = (manager.width || 600) - 16;
            var h = (manager.height || 560) - 24;
            cellHits = []; revealBox = null;

            p.push();
            p.noStroke(); p.fill(COL_CARD); p.rect(left, top, w, h, 10);

            var pad = 28;
            var labelX = left + pad;
            var colsStart = left + pad + 170;
            var colsW = (left + w - pad) - colsStart;
            var colX = [colsStart + colsW*0.27, colsStart + colsW*0.73];

            p.fill(COL_TEXT); p.textFont('Spectral SC'); p.textStyle(p.BOLD);
            p.textAlign(p.LEFT, p.TOP); p.textSize(22);
            p.text('Two restaurants, one difference', labelX, top + 20);
            p.textFont('IBM Plex Mono'); p.textStyle(p.NORMAL); p.textSize(15); p.fill(COL_SUB);
            p.text('For each row, click to judge: does it beat the city?', labelX, top + 48);

            var headY = top + 88;
            for (var c=0;c<2;c++){
                p.fill(COL_TEXT); p.textFont('Spectral SC'); p.textStyle(p.BOLD); p.textSize(15);
                p.textAlign(p.CENTER, p.TOP); p.text(RESTAURANTS[c].name, colX[c], headY);
            }

            var rowsTop = headY + 26;
            var rowH = Math.min(66, (h - 228) / FACTORS.length);

            for (var i=0;i<FACTORS.length;i++){
                var f = FACTORS[i];
                var rowTop = rowsTop + i*rowH;
                var cy = rowTop + rowH/2;

                var since = flash[i] ? (performance.now()-flash[i]) : Infinity;
                var fa = clamp01(1 - since/900);
                if(fa>0){ var fc=p.color(COL_FLASH); fc.setAlpha(46*fa); p.noStroke(); p.fill(fc);
                          p.rect(left+20, rowTop+2, w-40, rowH-4, 6); }

                if(i>0 && f.counts===false && FACTORS[i-1].counts===true){
                    p.stroke(COL_LINE); p.strokeWeight(1);
                    p.line(left+28, rowTop, left+w-28, rowTop); p.noStroke();
                }

                p.fill(f.counts ? COL_TEXT : COL_SUB);
                p.textFont('IBM Plex Mono'); p.textStyle(f.counts?p.BOLD:p.NORMAL); p.textSize(15);
                p.textAlign(p.LEFT, p.BOTTOM); p.text(f.label, labelX, cy);
                p.fill(COL_SUB); p.textFont('IBM Plex Mono'); p.textStyle(p.NORMAL); p.textSize(15);
                p.textAlign(p.LEFT, p.TOP); p.text('city: ' + f.bench, labelX, cy + 2);

                for (var c2=0;c2<2;c2++){
                    p.fill(COL_TEXT); p.textFont('IBM Plex Mono'); p.textSize(15);
                    p.textAlign(p.CENTER, p.BOTTOM); p.text(f.vals[c2], colX[c2], cy - 2);
                    drawMark(p, colX[c2], cy + 13, judged[i][c2], f.beats[c2]);
                }

                cellHits.push({ x0: left+20, x1: left+w-20, y0: rowTop, y1: rowTop+rowH, row: i });
            }

            var scoreY = rowsTop + FACTORS.length*rowH + 24;
            p.fill(COL_TEXT); p.textFont('IBM Plex Mono'); p.textSize(15);
            p.textAlign(p.LEFT, p.CENTER); p.text('Factors that move survival', labelX, scoreY);
            for (var c3=0;c3<2;c3++){
                p.textAlign(p.CENTER, p.CENTER); p.textSize(15); p.textStyle(p.BOLD);
                if(countingJudged(c3)){
                    p.fill(score(c3)>=2 ? COL_GREEN : COL_CLOSED);
                    p.text(score(c3) + ' / 3', colX[c3], scoreY);
                } else { p.fill(COL_EMPTY); p.text('\u2013 / 3', colX[c3], scoreY); }
                p.textStyle(p.NORMAL);
            }

            var bottomY = scoreY + 42;
            if(!allJudged()){
                p.fill(COL_SUB); p.textFont('IBM Plex Mono'); p.textSize(15);
                p.textAlign(p.CENTER, p.CENTER);
                p.text('Click each row to compare.', left + w/2, bottomY + 8);
            } else if(!outcomeRevealed){
                p.fill(COL_TEXT); p.textFont('Spectral SC'); p.textStyle(p.BOLD); p.textSize(22);
                p.textAlign(p.CENTER, p.CENTER); p.text('Which one is still open?', left + w/2, bottomY);
                p.textStyle(p.NORMAL);
                var bw=200, bh=40, bx=left+w/2-bw/2, by=bottomY+20;
                revealBox = { x:bx, y:by, w:bw, h:bh };
                p.fill(COL_BTN); p.rect(bx,by,bw,bh,6);
                p.fill(255); p.textFont('IBM Plex Mono'); p.textSize(15);
                p.textAlign(p.CENTER, p.CENTER); p.text('Reveal what happened', left+w/2, by+bh/2);
            } else {
                for (var c4=0;c4<2;c4++){
                    var closed = (c4===0);
                    p.fill(closed?COL_CLOSED:COL_GREEN); p.textFont('Spectral SC'); p.textStyle(p.BOLD); p.textSize(22);
                    p.textAlign(p.CENTER, p.CENTER); p.text(closed?'Closed':'Still open', colX[c4], bottomY);
                }
                p.textStyle(p.NORMAL); p.fill(COL_SUB); p.textFont('IBM Plex Mono'); p.textSize(15);
                p.textAlign(p.CENTER, p.TOP);
                p.text('0 of 3 factors: ~33% survive.   3 of 3: ~70%.', left+w/2, bottomY+22);
            }

            p.pop();
        },

        mousePressed: function(p, manager, mx, my){
            if(revealBox && allJudged() && !outcomeRevealed &&
               mx>=revealBox.x && mx<=revealBox.x+revealBox.w &&
               my>=revealBox.y && my<=revealBox.y+revealBox.h){ outcomeRevealed=true; return; }
            for (var i=0;i<cellHits.length;i++){
                var hb=cellHits[i];
                if(mx>=hb.x0 && mx<=hb.x1 && my>=hb.y0 && my<=hb.y1){
                    judged[hb.row][0]=true; judged[hb.row][1]=true; return;
                }
            }
        }
    };
})();
