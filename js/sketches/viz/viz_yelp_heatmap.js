// Yelp restaurant review-count vs rating heatmap.
(function () {
    var REVIEW_BINS = [0, 100, 250, 500, 750, 1000];
    var RATING_BINS = [1.0, 2.0, 3.0, 3.5, 4.0, 4.5, 5.01];
    var CLOSED_HEX = '#7e2954';
    var OPEN_HEX = '#94cbec';

    function formatCompactNumber(value) {
        if (value >= 1000) {
            var compact = value / 1000;
            return (compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)) + 'k';
        }
        return String(value);
    }

    function countColor(p, t, baseHex) {
        var stops = [
            { at: 0, color: p.color('#edf6fb') },
            { at: 0.45, color: p.lerpColor(p.color('#edf6fb'), p.color(baseHex), 0.4) },
            { at: 1, color: p.color(baseHex) }
        ];
        var clamped = Math.max(0, Math.min(1, t));

        for (var i = 0; i < stops.length - 1; i++) {
            var start = stops[i];
            var end = stops[i + 1];
            if (clamped >= start.at && clamped <= end.at) {
                var localT = (clamped - start.at) / Math.max(0.0001, end.at - start.at);
                return p.lerpColor(start.color, end.color, localT);
            }
        }

        return stops[stops.length - 1].color;
    }

    function formatReviewBin(index) {
        if (index < 0 || index >= REVIEW_BINS.length - 1) return '';
        return formatCompactNumber(REVIEW_BINS[index]) + '-\n' + formatCompactNumber(REVIEW_BINS[index + 1]);
    }

    function formatRatingBin(index) {
        if (index < 0 || index >= RATING_BINS.length - 1) return '';
        var end = RATING_BINS[index + 1];
        var displayEnd = end > 5 ? 5.0 : end;
        return RATING_BINS[index].toFixed(1) + '-' + displayEnd.toFixed(1);
    }

    window.VizYelpHeatmap = {
        prepareData: function (rows) {
            rows = rows || [];
            var matrix = [];
            var maxOpenCount = 0;
            var maxClosedCount = 0;
            var total = 0;
            var totalOpen = 0;
            var totalClosed = 0;

            for (var r = 0; r < RATING_BINS.length - 1; r++) {
                matrix[r] = [];
                for (var c = 0; c < REVIEW_BINS.length - 1; c++) {
                    matrix[r][c] = { open: 0, closed: 0 };
                }
            }

            rows.forEach(function (row) {
                var rating = +row.stars || 0;
                var reviewCount = +row.review_count || 0;
                if (rating < RATING_BINS[0] || rating > 5 || reviewCount < 0) return;

                var rowIndex = -1;
                var colIndex = -1;
                for (var r = 0; r < RATING_BINS.length - 1; r++) {
                    if (rating >= RATING_BINS[r] && rating < RATING_BINS[r + 1]) {
                        rowIndex = r;
                        break;
                    }
                }
                for (var c = 0; c < REVIEW_BINS.length - 1; c++) {
                    if (reviewCount >= REVIEW_BINS[c] && reviewCount < REVIEW_BINS[c + 1]) {
                        colIndex = c;
                        break;
                    }
                }

                if (rowIndex === -1 && rating === 5) rowIndex = RATING_BINS.length - 2;
                if (rowIndex === -1 || colIndex === -1) return;

                if (+row.is_open === 1) {
                    matrix[rowIndex][colIndex].open += 1;
                    totalOpen += 1;
                } else {
                    matrix[rowIndex][colIndex].closed += 1;
                    totalClosed += 1;
                }
                total += 1;
                if (matrix[rowIndex][colIndex].open > maxOpenCount) maxOpenCount = matrix[rowIndex][colIndex].open;
                if (matrix[rowIndex][colIndex].closed > maxClosedCount) maxClosedCount = matrix[rowIndex][colIndex].closed;
            });

            return {
                matrix: matrix,
                maxOpenCount: maxOpenCount,
                maxClosedCount: maxClosedCount,
                maxCount: Math.max(maxOpenCount, maxClosedCount),
                total: total,
                totalOpen: totalOpen,
                totalClosed: totalClosed
            };
        },

        draw: function (p, manager) {
            var data = manager.yelpHeatmapData || this.prepareData([]);
            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 18;
            var w = (manager.width || 600) + 2;
            var h = (manager.height || 520) - 70;
            var gutter = 44;
            var panelW = (w - gutter) / 2;
            var gridLeft = left + 86;
            var gridTop = top + 62;
            var gridW = panelW - 96;
            var gridH = h - 170;
            var cols = REVIEW_BINS.length - 1;
            var rows = RATING_BINS.length - 1;
            var cellW = gridW / cols;
            var cellH = gridH / rows;
            var leftGridLeft = gridLeft;
            var rightGridLeft = left + panelW + gutter + 80;

            function drawPanel(panelLeft, title, key, baseHex) {
                p.fill(20);
                p.textFont('Spectral');
                p.textStyle(p.BOLD);
                p.textSize(20);
                p.textAlign(p.CENTER, p.TOP);
                p.text(title, panelLeft + gridW / 2, top);

                p.textFont('IBM Plex Mono');
                p.textStyle(p.NORMAL);
                p.textSize(12);
                p.fill('#4f4a45');

                for (var c = 0; c < cols; c++) {
                    var x = panelLeft + c * cellW;
                    p.textAlign(p.CENTER, p.TOP);
                    p.text(formatReviewBin(c), x + cellW / 2, gridTop + gridH + 12);
                }

                for (var rowIndex = 0; rowIndex < rows; rowIndex++) {
                    for (var colIndex = 0; colIndex < cols; colIndex++) {
                        var x0 = panelLeft + colIndex * cellW;
                        var y0 = gridTop + rowIndex * cellH;
                        var dataRow = rows - 1 - rowIndex;
                        var count = data.matrix[dataRow][colIndex][key];
                        var t = data.maxCount > 0 ? count / data.maxCount : 0;

                        p.fill(countColor(p, t, baseHex));
                        p.stroke('#ffffff');
                        p.strokeWeight(2);
                        p.rect(x0, y0, cellW, cellH, 6);

                        if (count > 0) {
                            p.noStroke();
                            p.fill(t > 0.62 ? '#ffffff' : '#1e1b18');
                            p.textAlign(p.CENTER, p.CENTER);
                            p.textStyle(p.BOLD);
                            p.textSize(Math.max(12, Math.min(14, cellW * 0.38)));
                            p.text(String(count), x0 + cellW / 2, y0 + cellH / 2);
                        }
                    }
                }
            }

            p.push();
            p.noStroke();
            p.fill(255);
            p.rect(left - 22, top - 20, w + 44, h + 116);

            p.fill(20);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(20);
            p.textAlign(p.CENTER, p.TOP);
            p.text('number of ratings', left + w / 2, gridTop + gridH + 66);

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.fill('#6d6862');
            p.text('showing restaurants with fewer than 1k ratings', left + w / 2, gridTop + gridH + 92);

            p.push();
            p.translate(left - 50, gridTop + gridH / 2);
            p.rotate(-p.HALF_PI);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(20);
            p.fill(20);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('Restaurant rating', 0, 0);
            p.pop();

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(13);
            p.fill('#4f4a45');

            for (var r = 0; r < rows; r++) {
                var y = gridTop + r * cellH;
                p.textAlign(p.RIGHT, p.CENTER);
                p.text(formatRatingBin(rows - 1 - r), leftGridLeft - 14, y + cellH / 2);
            }

            drawPanel(leftGridLeft, 'Open Restaurants', 'open', OPEN_HEX);
            drawPanel(rightGridLeft, 'Closed Restaurants', 'closed', CLOSED_HEX);

            p.noStroke();
            p.fill('#1e1b18');
            p.textFont('IBM Plex Mono');
            p.textStyle(p.BOLD);
            p.textSize(13);
            p.textAlign(p.CENTER, p.TOP);
            p.text(
                'High ratings and many reviews still appear among closed restaurants.',
                left + w / 2,
                top + 32
            );

            var legendX = left + w / 2 - 92;
            var legendY = top + h + 8;
            p.noStroke();
            p.fill(OPEN_HEX);
            p.circle(legendX, legendY + 5, 9);
            p.fill(CLOSED_HEX);
            p.circle(legendX + 100, legendY + 5, 9);
            p.fill('#4f4a45');
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('Open', legendX + 12, legendY + 5);
            p.text('Closed', legendX + 112, legendY + 5);

            p.textAlign(p.RIGHT, p.CENTER);
            p.textSize(12);
            p.fill(70);
            p.text('Open: ' + data.totalOpen + '  |  Closed: ' + data.totalClosed, left + w, legendY + 5);
            p.pop();
        }
    };
})();
