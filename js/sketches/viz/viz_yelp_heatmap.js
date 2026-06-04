// Yelp restaurant review-count vs rating heatmap, with yearly playback.
(function () {
    var REVIEW_BINS = [0, 100, 250, 500, 750, 1000];
    var RATING_BINS = [1.0, 2.0, 3.0, 3.5, 4.0, 4.5, 5.01];
    var CLOSED_HEX = '#7e2954';
    var OPEN_HEX = '#0b6fa4';
    var CONTROL_TEXT = '#4f4a45';

    function formatCompactNumber(value) {
        if (value >= 1000) {
            var compact = value / 1000;
            return (compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)) + 'k';
        }
        return String(value);
    }

    function paleBaseFor(baseHex) {
        return baseHex === CLOSED_HEX ? '#f5e8ee' : '#edf6fb';
    }

    function countColor(p, t, baseHex) {
        var paleBase = paleBaseFor(baseHex);
        var stops = [
            { at: 0, color: p.color(paleBase) },
            { at: 0.45, color: p.lerpColor(p.color(paleBase), p.color(baseHex), 0.4) },
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

    function clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    function smoothstep(value) {
        var t = clamp01(value);
        return t * t * (3 - 2 * t);
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

    function emptyMatrix() {
        var matrix = [];
        for (var r = 0; r < RATING_BINS.length - 1; r++) {
            matrix[r] = [];
            for (var c = 0; c < REVIEW_BINS.length - 1; c++) {
                matrix[r][c] = { open: 0, closed: 0 };
            }
        }
        return matrix;
    }

    function readUInt16(view, offset) {
        return view.getUint16(offset, true);
    }

    function readUInt32(view, offset) {
        return view.getUint32(offset, true);
    }

    function findEOCD(view) {
        var start = Math.max(0, view.byteLength - 66000);
        for (var i = view.byteLength - 22; i >= start; i--) {
            if (readUInt32(view, i) === 0x06054b50) return i;
        }
        return -1;
    }

    function textFromBytes(bytes) {
        return new TextDecoder('utf-8').decode(bytes);
    }

    function inflateZipEntry(bytes, method) {
        if (method === 0) return Promise.resolve(bytes);
        if (method !== 8 || typeof DecompressionStream === 'undefined') {
            return Promise.reject(new Error('Unsupported ZIP compression'));
        }

        var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).arrayBuffer().then(function (buffer) {
            return new Uint8Array(buffer);
        });
    }

    function extractReviewJSON(zipBuffer) {
        if (!zipBuffer) return Promise.resolve([]);

        var view = new DataView(zipBuffer);
        var eocd = findEOCD(view);
        if (eocd < 0) return Promise.resolve([]);

        var totalEntries = readUInt16(view, eocd + 10);
        var centralDirOffset = readUInt32(view, eocd + 16);
        var ptr = centralDirOffset;
        var target = null;

        for (var i = 0; i < totalEntries; i++) {
            if (readUInt32(view, ptr) !== 0x02014b50) break;
            var method = readUInt16(view, ptr + 10);
            var compressedSize = readUInt32(view, ptr + 20);
            var fileNameLength = readUInt16(view, ptr + 28);
            var extraLength = readUInt16(view, ptr + 30);
            var commentLength = readUInt16(view, ptr + 32);
            var localHeaderOffset = readUInt32(view, ptr + 42);
            var nameBytes = new Uint8Array(zipBuffer, ptr + 46, fileNameLength);
            var fileName = textFromBytes(nameBytes);

            if (fileName === 'yelp_reviews_philadelphia_zips.json') {
                target = {
                    method: method,
                    compressedSize: compressedSize,
                    localHeaderOffset: localHeaderOffset
                };
                break;
            }
            ptr += 46 + fileNameLength + extraLength + commentLength;
        }

        if (!target) return Promise.resolve([]);
        var local = target.localHeaderOffset;
        if (readUInt32(view, local) !== 0x04034b50) return Promise.resolve([]);
        var localNameLength = readUInt16(view, local + 26);
        var localExtraLength = readUInt16(view, local + 28);
        var dataStart = local + 30 + localNameLength + localExtraLength;
        var entryBytes = new Uint8Array(zipBuffer, dataStart, target.compressedSize);

        return inflateZipEntry(entryBytes, target.method)
            .then(function (jsonBytes) {
                return JSON.parse(textFromBytes(jsonBytes));
            })
            .catch(function () {
                return [];
            });
    }

    function binIndex(value, bins, includeLast) {
        for (var i = 0; i < bins.length - 1; i++) {
            if (value >= bins[i] && value < bins[i + 1]) return i;
        }
        if (includeLast && value === bins[bins.length - 2]) return bins.length - 2;
        return -1;
    }

    function summarizeMatrix(matrix) {
        var maxOpenCount = 0;
        var maxClosedCount = 0;
        var totalOpen = 0;
        var totalClosed = 0;

        matrix.forEach(function (row) {
            row.forEach(function (cell) {
                if (cell.open > maxOpenCount) maxOpenCount = cell.open;
                if (cell.closed > maxClosedCount) maxClosedCount = cell.closed;
                totalOpen += cell.open;
                totalClosed += cell.closed;
            });
        });

        return {
            matrix: matrix,
            maxOpenCount: maxOpenCount,
            maxClosedCount: maxClosedCount,
            maxCount: Math.max(maxOpenCount, maxClosedCount),
            totalOpen: totalOpen,
            totalClosed: totalClosed,
            total: totalOpen + totalClosed
        };
    }

    function pointInRect(px, py, rect) {
        return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
    }

    function getSelectedYear(manager, years) {
        if (!years || !years.length) return null;
        var selectedYear = +manager.yelpHeatmapSelectedYear || years[years.length - 1];
        if (years.indexOf(selectedYear) === -1) {
            selectedYear = years[years.length - 1];
            manager.yelpHeatmapSelectedYear = selectedYear;
        }
        return selectedYear;
    }

    function setSelectedYear(manager, years, year) {
        if (!years || !years.length) return;
        var index = years.indexOf(year);
        if (index === -1) index = years.length - 1;
        manager.yelpHeatmapSelectedYear = years[index];
    }

    window.VizYelpHeatmap = {
        prepareData: function (rows) {
            rows = rows || [];
            var matrix = emptyMatrix();

            rows.forEach(function (row) {
                var rating = +row.stars || 0;
                var reviewCount = +row.review_count || 0;
                if (rating < RATING_BINS[0] || rating > 5 || reviewCount < 0) return;

                var rowIndex = binIndex(rating, RATING_BINS, true);
                var colIndex = binIndex(reviewCount, REVIEW_BINS, false);
                if (rowIndex === -1 || colIndex === -1) return;

                if (+row.is_open === 1) {
                    matrix[rowIndex][colIndex].open += 1;
                } else {
                    matrix[rowIndex][colIndex].closed += 1;
                }
            });

            return summarizeMatrix(matrix);
        },

        prepareYearData: function (businessRows, zipBuffer) {
            var businesses = businessRows || [];
            var metaById = {};
            businesses.forEach(function (business) {
                if (!business.business_id) return;
                metaById[business.business_id] = { isOpen: +business.is_open === 1 };
            });

            return extractReviewJSON(zipBuffer).then(function (reviews) {
                var byBusiness = {};
                var yearSet = {};

                reviews.forEach(function (review) {
                    var meta = metaById[review.business_id];
                    if (!meta) return;
                    var year = +String(review.date || '').slice(0, 4);
                    var stars = +review.stars;
                    if (!year || !isFinite(stars)) return;

                    if (!byBusiness[review.business_id]) byBusiness[review.business_id] = [];
                    byBusiness[review.business_id].push({ year: year, stars: stars });
                    yearSet[year] = true;
                });

                var years = Object.keys(yearSet).map(function (year) { return +year; }).sort(function (a, b) { return a - b; });
                if (!years.length) return null;

                var byYear = {};
                years.forEach(function (year) {
                    byYear[year] = {
                        year: year,
                        matrix: emptyMatrix()
                    };
                });

                Object.keys(byBusiness).forEach(function (businessId) {
                    var reviewsForBusiness = byBusiness[businessId].sort(function (a, b) { return a.year - b.year; });
                    var meta = metaById[businessId];
                    var sum = 0;
                    var count = 0;
                    var reviewIndex = 0;

                    years.forEach(function (year) {
                        while (reviewIndex < reviewsForBusiness.length && reviewsForBusiness[reviewIndex].year <= year) {
                            sum += reviewsForBusiness[reviewIndex].stars;
                            count += 1;
                            reviewIndex += 1;
                        }
                        if (count <= 0) return;

                        var ratingIndex = binIndex(sum / count, RATING_BINS, true);
                        var reviewIndexBin = binIndex(count, REVIEW_BINS, false);
                        if (ratingIndex === -1 || reviewIndexBin === -1) return;
                        byYear[year].matrix[ratingIndex][reviewIndexBin][meta.isOpen ? 'open' : 'closed'] += 1;
                    });
                });

                years.forEach(function (year) {
                    byYear[year] = Object.assign({ year: year }, summarizeMatrix(byYear[year].matrix));
                });

                return {
                    years: years,
                    byYear: byYear
                };
            });
        },

        handleControls: function (p, manager, years, slider, buttons) {
            if (!years.length) return;

            var wasPressed = !!manager.yelpHeatmapMouseWasPressed;
            var justPressed = p.mouseIsPressed && !wasPressed;
            var justReleased = !p.mouseIsPressed && wasPressed;

            if (justReleased) manager.yelpHeatmapSliderDragging = false;

            var selectedYear = getSelectedYear(manager, years);
            var selectedIndex = Math.max(0, years.indexOf(selectedYear));
            var progress = years.length > 1 ? selectedIndex / (years.length - 1) : 1;
            var knobX = slider.x + slider.w * progress;
            var onTrack = p.mouseX >= slider.x - 10 && p.mouseX <= slider.x + slider.w + 10 &&
                p.mouseY >= slider.y - 13 && p.mouseY <= slider.y + 13;
            var onKnob = p.dist(p.mouseX, p.mouseY, knobX, slider.y) <= slider.knobRadius + 5;

            if (justPressed) {
                if (pointInRect(p.mouseX, p.mouseY, buttons.play)) {
                    manager.yelpHeatmapAutoplay = !manager.yelpHeatmapAutoplay;
                    manager.yelpHeatmapLastAdvance = p.millis();
                } else if (pointInRect(p.mouseX, p.mouseY, buttons.slow)) {
                    manager.yelpHeatmapSpeed = 'slow';
                    manager.yelpHeatmapAutoplay = true;
                    manager.yelpHeatmapLastAdvance = p.millis();
                } else if (pointInRect(p.mouseX, p.mouseY, buttons.fast)) {
                    manager.yelpHeatmapSpeed = 'fast';
                    manager.yelpHeatmapAutoplay = true;
                    manager.yelpHeatmapLastAdvance = p.millis();
                } else if (onTrack || onKnob) {
                    manager.yelpHeatmapSliderDragging = true;
                    manager.yelpHeatmapAutoplay = false;
                }
            }

            if (manager.yelpHeatmapSliderDragging && p.mouseIsPressed) {
                var t = (p.mouseX - slider.x) / slider.w;
                t = Math.max(0, Math.min(1, t));
                setSelectedYear(manager, years, years[Math.round(t * (years.length - 1))]);
            }

            if (manager.yelpHeatmapAutoplay && !manager.yelpHeatmapSliderDragging) {
                var speed = manager.yelpHeatmapSpeed === 'fast' ? 250 : 600;
                var last = manager.yelpHeatmapLastAdvance || p.millis();
                if (p.millis() - last >= speed) {
                    selectedYear = getSelectedYear(manager, years);
                    selectedIndex = Math.max(0, years.indexOf(selectedYear));
                    manager.yelpHeatmapSelectedYear = years[(selectedIndex + 1) % years.length];
                    manager.yelpHeatmapLastAdvance = p.millis();
                }
            }

            manager.yelpHeatmapMouseWasPressed = p.mouseIsPressed;
        },

        drawControls: function (p, manager, years, selectedYear, left, y, w) {
            if (!years.length) return;
            if (!manager.yelpHeatmapSpeed) manager.yelpHeatmapSpeed = 'slow';

            var sliderW = Math.min(360, w * 0.5);
            var buttonW = 58;
            var gap = 10;
            var totalW = sliderW + gap * 3 + buttonW * 3;
            var startX = left + w / 2 - totalW / 2;
            var slider = {
                x: startX,
                y: y,
                w: sliderW,
                knobRadius: 10
            };
            var buttons = {
                play: { x: startX + sliderW + gap, y: y - 15, w: buttonW, h: 30 },
                slow: { x: startX + sliderW + gap * 2 + buttonW, y: y - 15, w: buttonW, h: 30 },
                fast: { x: startX + sliderW + gap * 3 + buttonW * 2, y: y - 15, w: buttonW, h: 30 }
            };

            this.handleControls(p, manager, years, slider, buttons);
            selectedYear = getSelectedYear(manager, years);
            var index = Math.max(0, years.indexOf(selectedYear));
            var progress = years.length > 1 ? index / (years.length - 1) : 1;

            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(15);
            p.fill('#1e1b18');
            p.textAlign(p.CENTER, p.CENTER);
            p.text(String(selectedYear), slider.x + slider.w / 2, slider.y - 25);

            p.stroke('#d0d9de');
            p.strokeWeight(6);
            p.line(slider.x, slider.y, slider.x + slider.w, slider.y);
            p.stroke(CLOSED_HEX);
            p.line(slider.x, slider.y, slider.x + slider.w * progress, slider.y);

            for (var tickIndex = 0; tickIndex < years.length; tickIndex++) {
                var tickT = years.length > 1 ? tickIndex / (years.length - 1) : 0;
                var tickX = slider.x + slider.w * tickT;
                p.stroke(tickIndex === index ? CLOSED_HEX : '#b9c5cc');
                p.strokeWeight(tickIndex === index ? 2 : 1);
                p.line(tickX, slider.y + 9, tickX, slider.y + 16);
            }

            var knobX = slider.x + slider.w * progress;
            p.noStroke();
            p.fill(CLOSED_HEX);
            p.circle(knobX, slider.y, slider.knobRadius * 2);
            p.fill('#ffffff');
            p.circle(knobX, slider.y, slider.knobRadius);

            p.fill(CONTROL_TEXT);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.textAlign(p.LEFT, p.TOP);
            p.text(String(years[0]), slider.x, slider.y + 17);
            p.textAlign(p.RIGHT, p.TOP);
            p.text(String(years[years.length - 1]), slider.x + slider.w, slider.y + 17);

            this.drawButton(p, buttons.play, manager.yelpHeatmapAutoplay ? 'Pause' : 'Play', false);
            this.drawButton(p, buttons.slow, 'Slow', manager.yelpHeatmapSpeed !== 'fast');
            this.drawButton(p, buttons.fast, 'Fast', manager.yelpHeatmapSpeed === 'fast');

            p.fill(CONTROL_TEXT);
            p.textAlign(p.CENTER, p.TOP);
            p.text('Drag the slider to change year, or autoplay through the review history.', left + w / 2, slider.y + 34);
        },

        drawButton: function (p, rect, label, active) {
            p.noStroke();
            p.fill(active ? '#1e1b18' : '#f1eee8');
            p.rect(rect.x, rect.y, rect.w, rect.h, 6);
            p.fill(active ? '#ffffff' : '#1e1b18');
            p.textFont('IBM Plex Mono');
            p.textStyle(p.BOLD);
            p.textSize(15);
            p.textAlign(p.CENTER, p.CENTER);
            p.text(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
        },

        draw: function (p, manager, progress) {
            var data = manager.yelpHeatmapData || this.prepareData([]);
            var reveal = smoothstep(((progress === undefined ? 1 : progress) - 0.04) / 0.96);

            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 18;
            var w = (manager.width || 600) + 2;
            var h = (manager.height || 520) - 92;
            var gutter = 44;
            var panelW = (w - gutter) / 2;
            var gridLeft = left + 86;
            var gridTop = top + 62;
            var gridW = panelW - 96;
            var minGridH = (manager.width || 600) < 460 ? 118 : 220;
            var gridH = Math.max(minGridH, h - 230);
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
                p.textSize(22);
                p.textAlign(p.CENTER, p.TOP);
                p.text(title, panelLeft + gridW / 2, top);

                p.textFont('IBM Plex Mono');
                p.textStyle(p.NORMAL);
                p.textSize(15);
                p.fill(CONTROL_TEXT);

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

                        var finalColor = countColor(p, t, baseHex);
                        var stagger = (rowIndex + colIndex) * 0.035;
                        var cellReveal = smoothstep((reveal - stagger) / 0.62);
                        if (count > 0) {
                            p.fill(p.lerpColor(p.color(paleBaseFor(baseHex)), finalColor, cellReveal));
                        } else {
                            p.noFill();
                        }
                        p.stroke('#ffffff');
                        p.strokeWeight(2);
                        p.rect(x0, y0, cellW, cellH, 6);

                        if (count > 0 && cellReveal > 0.58) {
                            var countAlpha = clamp01((cellReveal - 0.58) / 0.42);
                            var textColor = p.color(t > 0.62 ? '#ffffff' : '#1e1b18');
                            textColor.setAlpha(255 * countAlpha);
                            p.noStroke();
                            p.fill(textColor);
                            p.textAlign(p.CENTER, p.CENTER);
                            p.textStyle(p.BOLD);
                            p.textSize(Math.max(15, Math.min(16, cellW * 0.38)));
                            p.text(String(count), x0 + cellW / 2, y0 + cellH / 2);
                        }
                    }
                }
            }

            p.push();
            p.noStroke();

            p.fill(20);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(22);
            p.textAlign(p.CENTER, p.TOP);
            p.text('Number of Ratings', left + w / 2, gridTop + gridH + 76);

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.fill('#6d6862');
            var scopeLabel = 'Total reviews across all years; restaurants with fewer than 1k ratings';
            p.text(scopeLabel, left + w / 2, gridTop + gridH + 104);

            p.push();
            p.translate(left - 50, gridTop + gridH / 2);
            p.rotate(-p.HALF_PI);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(22);
            p.fill(20);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('Restaurant Rating', 0, 0);
            p.pop();

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.fill(CONTROL_TEXT);

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
            p.textSize(15);
            p.textAlign(p.CENTER, p.TOP);
            p.text('High Ratings and Many Reviews Still Appear Among Closed Restaurants.', left + w / 2, top + 32);

            var legendX = left + w / 2 - 120;
            var legendY = top + h - 2;
            p.noStroke();
            p.fill(OPEN_HEX);
            p.circle(legendX, legendY + 5, 9);
            p.fill(CLOSED_HEX);
            p.circle(legendX + 118, legendY + 5, 9);
            p.fill(CONTROL_TEXT);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.textAlign(p.LEFT, p.CENTER);
            p.text('Open', legendX + 12, legendY + 5);
            p.text('Closed', legendX + 132, legendY + 5);

            p.textAlign(p.RIGHT, p.CENTER);
            p.textSize(15);
            p.fill(70);
            p.text('Open: ' + data.totalOpen + '  |  Closed: ' + data.totalClosed, left + w, legendY + 5);

            p.pop();
        }
    };
})();
