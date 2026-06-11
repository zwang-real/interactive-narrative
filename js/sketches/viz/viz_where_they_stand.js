// Image 1: restaurant rating and survival map for the "Where They Stand" section.
(function () {
    var OPEN_HEX = '#7eb0cd';
    var LOW_RATING_HEX = '#94CBEC';
    var HIGH_RATING_HEX = '#0072B2';
    var CLOSED_HEX = '#b24852';
    var PANEL_STROKE = '#4f4a45';
    var DEFAULT_YEARS = [];
    var CENTER_CITY_LON = -75.1638;
    var CENTER_CITY_LAT = 39.9526;
    var FOCUS_ZIPS = ['19104', '19130', '19103', '19102', '19123', '19107', '19106', '19146', '19147', '19132', '19133', '19125', '19121', '19122'];
    var FOCUS_ZIP_SET = FOCUS_ZIPS.reduce(function (set, zip) {
        set[zip] = true;
        return set;
    }, {});

    for (var year = 2005; year <= 2022; year++) DEFAULT_YEARS.push(year);

    function normalizeName(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9 ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function buildProjection(points, left, top, width, height) {
        var minLon = Infinity;
        var maxLon = -Infinity;
        var minLat = Infinity;
        var maxLat = -Infinity;

        points.forEach(function (point) {
            if (point.longitude < minLon) minLon = point.longitude;
            if (point.longitude > maxLon) maxLon = point.longitude;
            if (point.latitude < minLat) minLat = point.latitude;
            if (point.latitude > maxLat) maxLat = point.latitude;
        });

        var lonSpan = Math.max(0.0001, maxLon - minLon);
        var latSpan = Math.max(0.0001, maxLat - minLat);
        var padding = 0;
        var innerW = Math.max(40, width - padding * 2);
        var innerH = Math.max(40, height - padding * 2);
        var scale = Math.min(innerW / lonSpan, innerH / latSpan);
        var drawW = lonSpan * scale;
        var drawH = latSpan * scale;

        return {
            minLon: minLon,
            minLat: minLat,
            scale: scale,
            x: left + (width - drawW) / 2,
            y: top + (height - drawH) / 2,
            drawH: drawH
        };
    }

    function buildBoundsProjection(bounds, left, top, width, height) {
        var lonSpan = Math.max(0.0001, bounds.maxLon - bounds.minLon);
        var latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
        var padding = 0;
        var innerW = Math.max(40, width - padding * 2);
        var innerH = Math.max(40, height - padding * 2);
        var scale = Math.min(innerW / lonSpan, innerH / latSpan);
        var drawW = lonSpan * scale;
        var drawH = latSpan * scale;

        return {
            minLon: bounds.minLon,
            minLat: bounds.minLat,
            scale: scale,
            x: left + (width - drawW) / 2,
            y: top + (height - drawH) / 2,
            drawH: drawH
        };
    }

    function projectPoint(point, projection) {
        return {
            x: projection.x + (point.longitude - projection.minLon) * projection.scale,
            y: projection.y + projection.drawH - (point.latitude - projection.minLat) * projection.scale
        };
    }

    function projectLonLat(lon, lat, projection) {
        return {
            x: projection.x + (lon - projection.minLon) * projection.scale,
            y: projection.y + projection.drawH - (lat - projection.minLat) * projection.scale
        };
    }

    function applyZoomProjection(projection, mapX, mapY, mapW, mapH, zoom) {
        zoom = Math.max(1, Math.min(2.6, zoom || 1));
        if (zoom === 1) return projection;

        var focus = projectLonLat(CENTER_CITY_LON, CENTER_CITY_LAT, projection);
        var targetX = mapX + mapW * 0.46;
        var targetY = mapY + mapH * 0.54;

        return {
            minLon: projection.minLon,
            minLat: projection.minLat,
            scale: projection.scale * zoom,
            x: targetX - (focus.x - projection.x) * zoom,
            y: targetY - (focus.y - projection.y) * zoom,
            drawH: projection.drawH * zoom
        };
    }

    function drawZipBoundaries(p, geoData, projection) {
        if (!geoData || !geoData.features || !geoData.features.length) return;

        p.fill('#f4f8fa');
        p.stroke('#b9cbd5');
        p.strokeWeight(0.9);

        geoData.features.forEach(function (feature) {
            feature.polygons.forEach(function (polygon) {
                if (!polygon.length || polygon[0].length < 3) return;

                p.beginShape();
                polygon[0].forEach(function (point) {
                    var projected = projectLonLat(point[0], point[1], projection);
                    p.vertex(projected.x, projected.y);
                });

                for (var i = 1; i < polygon.length; i++) {
                    var hole = polygon[i];
                    if (hole.length < 3) continue;
                    p.beginContour();
                    hole.forEach(function (point) {
                        var projected = projectLonLat(point[0], point[1], projection);
                        p.vertex(projected.x, projected.y);
                    });
                    p.endContour();
                }

                p.endShape(p.CLOSE);
            });
        });
    }

    function pointInRing(lon, lat, ring) {
        var inside = false;

        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var xi = ring[i][0];
            var yi = ring[i][1];
            var xj = ring[j][0];
            var yj = ring[j][1];
            var intersects = ((yi > lat) !== (yj > lat)) &&
                (lon < ((xj - xi) * (lat - yi)) / Math.max(0.0000001, yj - yi) + xi);

            if (intersects) inside = !inside;
        }

        return inside;
    }

    function pointInFeature(lon, lat, feature) {
        for (var i = 0; i < feature.polygons.length; i++) {
            var polygon = feature.polygons[i];
            if (!polygon.length || !pointInRing(lon, lat, polygon[0])) continue;

            var inHole = false;
            for (var j = 1; j < polygon.length; j++) {
                if (pointInRing(lon, lat, polygon[j])) {
                    inHole = true;
                    break;
                }
            }

            if (!inHole) return true;
        }

        return false;
    }

    function pointInGeoData(point, geoData) {
        if (!geoData || !geoData.features || !geoData.features.length) return true;
        if (point.longitude < geoData.bounds.minLon || point.longitude > geoData.bounds.maxLon ||
            point.latitude < geoData.bounds.minLat || point.latitude > geoData.bounds.maxLat) {
            return false;
        }

        for (var i = 0; i < geoData.features.length; i++) {
            if (pointInFeature(point.longitude, point.latitude, geoData.features[i])) return true;
        }

        return false;
    }

    function ratingColor(p, rating) {
        var t = Math.max(0, Math.min(1, ((rating || 0) - 1) / 4));
        return p.lerpColor(p.color(LOW_RATING_HEX), p.color(HIGH_RATING_HEX), t);
    }

    function formatPercent(value) {
        return (value * 100).toFixed(1) + '%';
    }

    function formatSigned(value) {
        value = Math.round(value || 0);
        if (value > 0) return '+' + value.toLocaleString();
        if (value < 0) return value.toLocaleString();
        return '0';
    }

    function formatCompactCount(value) {
        return Math.round(value || 0).toLocaleString();
    }

    function drawWrappedText(p, text, x, y, w, h) {
        p.text(String(text || ''), x, y, w, h);
    }

    function filterGeoData(boundaryData) {
        if (!boundaryData || !boundaryData.features || !boundaryData.features.length) return boundaryData;

        var features = boundaryData.features.filter(function (feature) {
            return FOCUS_ZIP_SET[feature.zip];
        });
        if (!features.length) return boundaryData;

        var minLon = Infinity;
        var maxLon = -Infinity;
        var minLat = Infinity;
        var maxLat = -Infinity;

        features.forEach(function (feature) {
            feature.polygons.forEach(function (polygon) {
                polygon.forEach(function (ring) {
                    ring.forEach(function (point) {
                        if (point[0] < minLon) minLon = point[0];
                        if (point[0] > maxLon) maxLon = point[0];
                        if (point[1] < minLat) minLat = point[1];
                        if (point[1] > maxLat) maxLat = point[1];
                    });
                });
            });
        });

        return {
            features: features,
            bounds: {
                minLon: minLon,
                maxLon: maxLon,
                minLat: minLat,
                maxLat: maxLat
            }
        };
    }

    function drawRestaurantTooltip(p, focus, x, y, maxX) {
        if (!focus) return;

        var point = focus.point || focus;
        var status = point.isOpen ? 'Open' : 'Closed';
        var lines = [
            point.name || 'Restaurant',
            status + ' | ' + point.rating.toFixed(1) + ' stars | ' + point.reviewCount + ' reviews'
        ];
        var boxW = Math.min(300, Math.max(210, (point.name || '').length * 7 + 28));
        var boxH = 58;
        var boxX = Math.min(x + 14, maxX - boxW - 8);
        var boxY = Math.max(10, y - boxH - 12);

        p.noStroke();
        p.fill(255, 248);
        p.rect(boxX, boxY, boxW, boxH, 6);
        p.stroke(point.isOpen ? OPEN_HEX : CLOSED_HEX);
        p.strokeWeight(2);
        p.noFill();
        p.rect(boxX, boxY, boxW, boxH, 6);

        p.noStroke();
        p.fill('#111111');
        p.textFont('IBM Plex Mono');
        p.textAlign(p.LEFT, p.TOP);
        p.textStyle(p.BOLD);
        p.textSize(12);
        p.text(lines[0], boxX + 10, boxY + 9, boxW - 20, 18);
        p.textStyle(p.NORMAL);
        p.fill('#4f4a45');
        p.text(lines[1], boxX + 10, boxY + 32, boxW - 20, 18);
    }

    window.VizWhereTheyStand = {
        prepareData: function (rows) {
            rows = rows || [];
            var nameCounts = {};

            rows.forEach(function (row) {
                var normalized = normalizeName(row.name);
                if (!normalized) return;
                nameCounts[normalized] = (nameCounts[normalized] || 0) + 1;
            });

            var points = rows.map(function (row, index) {
                var latitude = +row.latitude;
                var longitude = +row.longitude;
                var normalized = normalizeName(row.name);
                if (!latitude || !longitude || !normalized) return null;

                return {
                    id: row.business_id || String(index),
                    name: row.name || '',
                    zip: String(row.postal_code || '').trim().split('-', 1)[0],
                    latitude: latitude,
                    longitude: longitude,
                    rating: +row.stars || 0,
                    reviewCount: +row.review_count || 0,
                    isOpen: +row.is_open === 1,
                    isChain: (nameCounts[normalized] || 0) > 1
                };
            }).filter(function (point) {
                return point && point.rating > 0;
            });

            var openCount = 0;
            var ratingTotal = 0;
            points.forEach(function (point) {
                if (point.isOpen) openCount += 1;
                ratingTotal += point.rating;
            });

            return {
                years: DEFAULT_YEARS.slice(),
                points: points,
                openCount: openCount,
                closedCount: points.length - openCount,
                survivalRate: points.length ? openCount / points.length : 0,
                averageRating: points.length ? ratingTotal / points.length : 0
            };
        },

        getSelectedYear: function (manager, years) {
            var selectedYear = +manager.whereTheyStandSelectedYear || years[years.length - 1];
            if (years.indexOf(selectedYear) === -1) {
                selectedYear = years[years.length - 1];
                manager.whereTheyStandSelectedYear = selectedYear;
            }
            return selectedYear;
        },

        handleControls: function (p, manager, years, slider) {
            var wasPressed = !!manager.whereTheyStandMouseWasPressed;
            var justPressed = p.mouseIsPressed && !wasPressed;
            var justReleased = !p.mouseIsPressed && wasPressed;
            var knobX = slider.x + slider.progress * slider.w;
            var onTrack = p.mouseX >= slider.x - 10 && p.mouseX <= slider.x + slider.w + 10 &&
                p.mouseY >= slider.y - 12 && p.mouseY <= slider.y + 12;
            var onKnob = p.dist(p.mouseX, p.mouseY, knobX, slider.y) <= slider.knobRadius + 4;
            var onPlay = p.mouseX >= slider.playX && p.mouseX <= slider.playX + slider.playSize &&
                p.mouseY >= slider.playY && p.mouseY <= slider.playY + slider.playSize;
            var onSlow = p.mouseX >= slider.speedX && p.mouseX <= slider.speedX + slider.speedW / 2 &&
                p.mouseY >= slider.speedY && p.mouseY <= slider.speedY + slider.speedH;
            var onFast = p.mouseX >= slider.speedX + slider.speedW / 2 && p.mouseX <= slider.speedX + slider.speedW &&
                p.mouseY >= slider.speedY && p.mouseY <= slider.speedY + slider.speedH;
            var onTicks = p.mouseX >= slider.x - 8 && p.mouseX <= slider.x + slider.w + 8 &&
                p.mouseY >= slider.y + 8 && p.mouseY <= slider.y + 32;
            var onZoomOut = p.mouseX >= slider.zoomOutX && p.mouseX <= slider.zoomOutX + slider.zoomSize &&
                p.mouseY >= slider.zoomY && p.mouseY <= slider.zoomY + slider.zoomSize;
            var onZoomIn = p.mouseX >= slider.zoomInX && p.mouseX <= slider.zoomInX + slider.zoomSize &&
                p.mouseY >= slider.zoomY && p.mouseY <= slider.zoomY + slider.zoomSize;
            var onReset = p.mouseX >= slider.resetX && p.mouseX <= slider.resetX + slider.resetW &&
                p.mouseY >= slider.zoomY && p.mouseY <= slider.zoomY + slider.zoomSize;

            if (justReleased) manager.whereTheyStandSliderDragging = false;
            if (justPressed && onPlay) manager.whereTheyStandPlaying = !manager.whereTheyStandPlaying;
            if (justPressed && onSlow) manager.whereTheyStandSpeed = 'slow';
            if (justPressed && onFast) manager.whereTheyStandSpeed = 'fast';
            if (!manager.whereTheyStandZoom) manager.whereTheyStandZoom = 1;
            if (justPressed && onZoomOut) manager.whereTheyStandZoom = Math.max(1, manager.whereTheyStandZoom - 0.4);
            if (justPressed && onZoomIn) manager.whereTheyStandZoom = Math.min(2.6, manager.whereTheyStandZoom + 0.4);
            if (justPressed && onReset) manager.whereTheyStandZoom = 1;
            if (justPressed && (onTrack || onKnob)) manager.whereTheyStandSliderDragging = true;
            if (justPressed && onTicks) {
                var tickT = (p.mouseX - slider.x) / slider.w;
                var tickIndex = Math.round(Math.max(0, Math.min(1, tickT)) * (years.length - 1));
                manager.whereTheyStandSelectedYear = years[tickIndex];
                manager.whereTheyStandPlaying = false;
            }

            if (manager.whereTheyStandSliderDragging && p.mouseIsPressed) {
                var t = (p.mouseX - slider.x) / slider.w;
                var index = Math.round(Math.max(0, Math.min(1, t)) * (years.length - 1));
                manager.whereTheyStandSelectedYear = years[index];
                manager.whereTheyStandPlaying = false;
            } else if (manager.whereTheyStandPlaying && p.frameCount % (manager.whereTheyStandSpeed === 'fast' ? 3 : 6) === 0) {
                var selectedYear = this.getSelectedYear(manager, years);
                var currentIndex = Math.max(0, years.indexOf(selectedYear));
                manager.whereTheyStandSelectedYear = years[(currentIndex + 1) % years.length];
            }

            manager.whereTheyStandMouseWasPressed = p.mouseIsPressed;
            return justPressed;
        },

        drawSlider: function (p, manager, years, selectedYear, x, y, w) {
            var index = Math.max(0, years.indexOf(selectedYear));
            var progress = years.length > 1 ? index / (years.length - 1) : 1;
            var slider = {
                x: x + 160,
                y: y + 16,
                w: w - 180,
                progress: progress,
                knobRadius: 8,
                playX: x,
                playY: y,
                playSize: 28,
                speedX: x + 52,
                speedY: y,
                speedW: 96,
                speedH: 28,
                zoomOutX: x,
                zoomInX: x + 34,
                resetX: x + 68,
                zoomY: y - 40,
                zoomSize: 28,
                resetW: 54
            };

            this.handleControls(p, manager, years, slider);
            selectedYear = this.getSelectedYear(manager, years);
            index = Math.max(0, years.indexOf(selectedYear));
            progress = years.length > 1 ? index / (years.length - 1) : 1;

            p.noStroke();
            p.fill('#ffffff');
            p.rect(slider.playX, slider.playY, slider.playSize, slider.playSize);
            p.stroke('#111111');
            p.strokeWeight(1.2);
            p.rect(slider.playX, slider.playY, slider.playSize, slider.playSize);
            p.noStroke();
            p.fill('#111111');
            if (manager.whereTheyStandPlaying) {
                p.rect(slider.playX + 9, slider.playY + 8, 4, 12);
                p.rect(slider.playX + 16, slider.playY + 8, 4, 12);
            } else {
                p.triangle(slider.playX + 10, slider.playY + 7, slider.playX + 10, slider.playY + 21, slider.playX + 21, slider.playY + 14);
            }

            if (!manager.whereTheyStandSpeed) manager.whereTheyStandSpeed = 'slow';
            p.stroke('#111111');
            p.strokeWeight(1);
            p.fill(manager.whereTheyStandSpeed === 'slow' ? '#111111' : '#ffffff');
            p.rect(slider.speedX, slider.speedY, slider.speedW / 2, slider.speedH);
            p.fill(manager.whereTheyStandSpeed === 'fast' ? '#111111' : '#ffffff');
            p.rect(slider.speedX + slider.speedW / 2, slider.speedY, slider.speedW / 2, slider.speedH);
            p.noStroke();
            p.textFont('IBM Plex Mono');
            p.textStyle(p.BOLD);
            p.textSize(15);
            p.textAlign(p.CENTER, p.CENTER);
            p.fill(manager.whereTheyStandSpeed === 'slow' ? '#ffffff' : '#111111');
            p.text('slow', slider.speedX + slider.speedW / 4, slider.speedY + slider.speedH / 2);
            p.fill(manager.whereTheyStandSpeed === 'fast' ? '#ffffff' : '#111111');
            p.text('fast', slider.speedX + slider.speedW * 0.75, slider.speedY + slider.speedH / 2);

            p.stroke('#d0d9de');
            p.strokeWeight(5);
            p.line(slider.x, slider.y, slider.x + slider.w, slider.y);
            p.stroke(HIGH_RATING_HEX);
            p.line(slider.x, slider.y, slider.x + slider.w * progress, slider.y);

            p.stroke('#9aa9b1');
            p.strokeWeight(1);
            years.forEach(function (year, yearIndex) {
                var tickX = slider.x + slider.w * (years.length > 1 ? yearIndex / (years.length - 1) : 0);
                var isEndpoint = yearIndex === 0 || yearIndex === years.length - 1;
                var isSelected = year === selectedYear;
                p.line(tickX, slider.y + 7, tickX, slider.y + (isSelected || isEndpoint ? 15 : 11));
            });

            var knobX = slider.x + slider.w * progress;
            p.noStroke();
            p.fill(HIGH_RATING_HEX);
            p.circle(knobX, slider.y, slider.knobRadius * 2);
            p.fill('#ffffff');
            p.circle(knobX, slider.y, slider.knobRadius);

            p.fill('#4f4a45');
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.textAlign(p.LEFT, p.TOP);
            p.text(String(years[0]), slider.x, slider.y + 18);
            p.textAlign(p.RIGHT, p.TOP);
            p.text(String(years[years.length - 1]), slider.x + slider.w, slider.y + 18);

            p.fill('#111111');
            p.textAlign(p.CENTER, p.BOTTOM);
            p.textStyle(p.BOLD);
            p.textSize(15);
            p.text(String(selectedYear), slider.x + slider.w / 2, slider.y - 8);

            if (!manager.whereTheyStandZoom) manager.whereTheyStandZoom = 1;
            p.textFont('IBM Plex Mono');
            p.textSize(15);
            p.textAlign(p.CENTER, p.CENTER);
            p.stroke('#111111');
            p.strokeWeight(1.1);
            p.fill(manager.whereTheyStandZoom <= 1 ? '#f2f0eb' : '#ffffff');
            p.rect(slider.zoomOutX, slider.zoomY, slider.zoomSize, slider.zoomSize);
            p.fill('#ffffff');
            p.rect(slider.zoomInX, slider.zoomY, slider.zoomSize, slider.zoomSize);
            p.rect(slider.resetX, slider.zoomY, slider.resetW, slider.zoomSize);
            p.noStroke();
            p.fill(manager.whereTheyStandZoom <= 1 ? '#9b958e' : '#111111');
            p.text('-', slider.zoomOutX + slider.zoomSize / 2, slider.zoomY + slider.zoomSize / 2 - 1);
            p.fill('#111111');
            p.text('+', slider.zoomInX + slider.zoomSize / 2, slider.zoomY + slider.zoomSize / 2 - 1);
            p.textSize(12);
            p.text('reset', slider.resetX + slider.resetW / 2, slider.zoomY + slider.zoomSize / 2);
        },

        getYearData: function (manager, selectedYear) {
            var yearData = manager.yelpZipYearData || {};
            return (yearData.byYear && yearData.byYear[selectedYear]) || { zipValues: {}, cityAverage: 0 };
        },

        getYears: function (manager, fallbackYears) {
            var yearData = manager.yelpZipYearData || {};
            return yearData.years && yearData.years.length ? yearData.years : fallbackYears;
        },

        getYearStats: function (manager, selectedYear) {
            var current = this.getYearData(manager, selectedYear);
            var years = this.getYears(manager, DEFAULT_YEARS);
            var yearIndex = years.indexOf(selectedYear);
            var previousYear = yearIndex > 0 ? years[yearIndex - 1] : null;
            var previous = previousYear ? this.getYearData(manager, previousYear) : null;

            function totals(yearData) {
                var values = yearData && yearData.zipValues ? yearData.zipValues : {};
                var activeRestaurants = 0;
                var reviews = 0;
                var activeZips = 0;

                Object.keys(values).forEach(function (zip) {
                    var metric = values[zip];
                    if (!metric) return;
                    activeRestaurants += +metric.businessCount || 0;
                    reviews += +metric.reviewCount || 0;
                    activeZips += 1;
                });

                return {
                    activeRestaurants: activeRestaurants,
                    reviews: reviews,
                    activeZips: activeZips
                };
            }

            var currentTotals = totals(current);
            var previousTotals = previous ? totals(previous) : null;

            return {
                activeRestaurants: currentTotals.activeRestaurants,
                reviews: currentTotals.reviews,
                activeZips: currentTotals.activeZips,
                restaurantChange: previousTotals ? currentTotals.activeRestaurants - previousTotals.activeRestaurants : 0,
                reviewChange: previousTotals ? currentTotals.reviews - previousTotals.reviews : 0,
                previousYear: previousYear
            };
        },

        draw: function (p, manager) {
            var data = manager.whereTheyStandData || this.prepareData([]);
            var geoData = manager.housingGeoData;
            var points = (data.points || []).filter(function (point) {
                return pointInGeoData(point, geoData);
            });
            var years = this.getYears(manager, data.years || DEFAULT_YEARS);
            if (!points.length) return;

            var selectedYear = this.getSelectedYear(manager, years);
            var selectedYearData = this.getYearData(manager, selectedYear);
            var selectedZipValues = selectedYearData.zipValues || {};
            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 18;
            var w = (manager.width || 600) - 34;
            var h = (manager.height || 520) - 56;
            var mapX = left - 20;
            var mapY = top + 2;
            var mapW = w + 40;
            var mapH = h - 78;
            var sliderY = mapY + mapH + 16;
            var baseProjection = geoData && geoData.bounds
                ? buildBoundsProjection(geoData.bounds, mapX, mapY, mapW, mapH)
                : buildProjection(points, mapX, mapY, mapW, mapH);
            var projection = applyZoomProjection(baseProjection, mapX, mapY, mapW, mapH, manager.whereTheyStandZoom || 1);
            var hovered = null;
            var justPressed;

            p.push();
            p.noStroke();
            p.fill('#fbfaf7');
            p.rect(left - 24, top - 18, w + 48, h + 46);

            justPressed = p.mouseIsPressed && !manager.whereTheyStandMouseWasPressed;

            drawZipBoundaries(p, geoData, projection);

            points.forEach(function (point) {
                var xy = projectPoint(point, projection);
                var zipMetric = selectedZipValues[point.zip];
                var currentRating = zipMetric ? zipMetric.avgRating : point.rating;
                var currentReviews = zipMetric ? zipMetric.reviewCount : 0;
                var pointSize = zipMetric
                    ? p.map(Math.sqrt(currentReviews), 1, 120, 3.4, 8.6, true)
                    : 2.9;
                var color = point.isOpen ? p.color(OPEN_HEX) : p.color(CLOSED_HEX);
                var alpha = zipMetric ? (point.isOpen ? 156 : 190) : (point.isOpen ? 92 : 126);

                p.noStroke();
                p.fill(p.red(color), p.green(color), p.blue(color), alpha);
                p.circle(xy.x, xy.y, pointSize);

                if (p.dist(p.mouseX, p.mouseY, xy.x, xy.y) <= Math.max(6, pointSize)) {
                    hovered = { point: point, x: xy.x, y: xy.y };
                }
            });

            if (hovered) {
                var focus = hovered;
                var focusXY = hovered;
                p.noFill();
                p.stroke('#111111');
                p.strokeWeight(1.8);
                p.circle(focusXY.x, focusXY.y, 18);
                drawRestaurantTooltip(p, focus, focusXY.x, focusXY.y, mapX + mapW);
            }

            this.drawSlider(p, manager, years, selectedYear, mapX, sliderY, mapW);
            selectedYear = this.getSelectedYear(manager, years);

            this.drawSummary(
                p,
                hovered && hovered.point,
                data,
                selectedYearData,
                this.getYearStats(manager, selectedYear),
                selectedYear,
                mapX + mapW - 260,
                mapY + mapH - 300,
                242
            );
            this.drawLegend(p, mapX + mapW / 2 - 98, sliderY + 56);
            p.pop();
        },

        drawSummary: function (p, selected, data, selectedYearData, yearStats, selectedYear, x, y, w) {
            var survival = formatPercent(data.survivalRate || 0);
            var rating = (selectedYearData.cityAverage || data.averageRating || 0).toFixed(2);
            var selectedZipMetric = selected && selectedYearData.zipValues
                ? selectedYearData.zipValues[selected.zip]
                : null;

            p.textFont('IBM Plex Mono');
            p.textAlign(p.LEFT, p.TOP);
            p.noStroke();

            p.fill('#111111');
            p.textStyle(p.BOLD);
            p.textSize(15);
            p.text(selected ? selected.name : 'Philadelphia restaurant summary', x, y, w, 44);

            p.fill('#4f4a45');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.text(
                'Press play to autoplay, drag the slider or click a tick mark on the slider to choose a year.',
                x,
                y + 48,
                w,
                96
            );

            p.textStyle(p.BOLD);
            p.textSize(15);
            if (selected) {
                p.text(
                    selectedYear + ' status: ' + (selected.isOpen ? 'Open' : 'Closed') +
                        '\nZIP avg rating: ' + (selectedZipMetric ? selectedZipMetric.avgRating.toFixed(2) : 'No reviews'),
                    x,
                    y + 152,
                    w,
                    64
                );
                p.fill('#1e1b18');
                p.textStyle(p.BOLD);
                p.textSize(15);
                p.text(selectedYear + ' review activity', x, y + 224, w, 22);
                p.fill('#4f4a45');
                p.textStyle(p.NORMAL);
                p.textSize(13);
                p.text(
                    formatCompactCount(yearStats.activeRestaurants) + ' restaurants, ' +
                        formatCompactCount(yearStats.reviews) + ' reviews\n' +
                        'Change: ' + formatSigned(yearStats.restaurantChange) +
                        ' restaurants, ' + formatSigned(yearStats.reviewChange) + ' reviews',
                    x,
                    y + 246,
                    w,
                    52
                );
            } else {
                p.fill('#1e1b18');
                p.text('Survival rate', x, y + 150, w, 22);
                p.fill(HIGH_RATING_HEX);
                p.textSize(24);
                p.text(survival, x, y + 171, w, 32);
                p.fill('#4f4a45');
                p.textSize(15);
                p.text('Avg. rating: ' + rating, x, y + 204, w, 24);

                p.fill('#1e1b18');
                p.textStyle(p.BOLD);
                p.textSize(15);
                p.text(selectedYear + ' review activity', x, y + 238, w, 22);
                p.fill('#4f4a45');
                p.textStyle(p.NORMAL);
                p.textSize(13);
                p.text(
                    formatCompactCount(yearStats.activeRestaurants) + ' restaurants, ' +
                        formatCompactCount(yearStats.reviews) + ' reviews\n' +
                        'Change vs. prior year: ' + formatSigned(yearStats.restaurantChange) +
                        ' restaurants, ' + formatSigned(yearStats.reviewChange) + ' reviews',
                    x,
                    y + 260,
                    w,
                    52
                );
            }
        },

        drawLegend: function (p, x, y) {
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(15);
            p.textAlign(p.LEFT, p.CENTER);
            p.noStroke();
            p.fill(OPEN_HEX);
            p.circle(x, y, 8);
            p.fill(OPEN_HEX);
            p.text('Open', x + 13, y);
            p.fill(CLOSED_HEX);
            p.circle(x + 72, y, 8);
            p.fill(CLOSED_HEX);
            p.text('Closed', x + 85, y);
        }
    };
})();
