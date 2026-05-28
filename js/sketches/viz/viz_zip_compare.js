// Side-by-side ZIP comparison: housing prices vs restaurant ratings by year.
(function () {
    var SHARED_BINS = [
        '#C8E4F5',
        '#56B4E9',
        '#0072B2',
        '#F0E442',
        '#E69F00',
        '#CC79A7'
    ];

    function quantizeT(t, bins) {
        var clamped = Math.max(0, Math.min(1, t));
        if (bins <= 1) return clamped;
        return Math.round(clamped * (bins - 1)) / (bins - 1);
    }

    function sharedBinColor(p, t) {
        var clamped = quantizeT(t, SHARED_BINS.length);
        var index = Math.round(clamped * (SHARED_BINS.length - 1));
        return p.color(SHARED_BINS[index]);
    }

    function ratingColorRamp(p, t) {
        return sharedBinColor(p, t);
    }

    function housingColorRamp(p, t) {
        return sharedBinColor(p, t);
    }

    function textColorFor(p, colorValue) {
        var luminance = 0.299 * p.red(colorValue) + 0.587 * p.green(colorValue) + 0.114 * p.blue(colorValue);
        return luminance < 150 ? '#ffffff' : '#16354c';
    }

    function ringArea(ring) {
        var area = 0;

        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            area += (ring[j].x * ring[i].y) - (ring[i].x * ring[j].y);
        }

        return area / 2;
    }

    function buildProjection(bounds, left, top, width, height) {
        var lonSpan = Math.max(0.0001, bounds.maxLon - bounds.minLon);
        var latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
        var padding = 16;
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
            drawW: drawW,
            drawH: drawH
        };
    }

    function projectPoint(lon, lat, projection) {
        return {
            x: projection.x + (lon - projection.minLon) * projection.scale,
            y: projection.y + projection.drawH - (lat - projection.minLat) * projection.scale
        };
    }

    function projectFeatures(boundaryData, projection) {
        return boundaryData.features.map(function (feature) {
            var projectedPolygons = feature.polygons.map(function (polygon) {
                return polygon.map(function (ring) {
                    return ring.map(function (point) {
                        return projectPoint(point[0], point[1], projection);
                    });
                });
            });
            var labelPoint = projectPoint(feature.labelLon, feature.labelLat, projection);
            var minX = Infinity;
            var maxX = -Infinity;
            var minY = Infinity;
            var maxY = -Infinity;
            var area = 0;

            projectedPolygons.forEach(function (polygon) {
                polygon.forEach(function (ring, ringIndex) {
                    ring.forEach(function (point) {
                        if (point.x < minX) minX = point.x;
                        if (point.x > maxX) maxX = point.x;
                        if (point.y < minY) minY = point.y;
                        if (point.y > maxY) maxY = point.y;
                    });

                    var currentArea = Math.abs(ringArea(ring));
                    area += ringIndex === 0 ? currentArea : -currentArea;
                });
            });

            return {
                zip: feature.zip,
                polygons: projectedPolygons,
                labelX: labelPoint.x,
                labelY: labelPoint.y,
                labelScale: Math.max(feature.lonSpan, feature.latSpan),
                bbox: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },
                area: Math.max(1, area)
            };
        });
    }

    function pointInRing(x, y, ring) {
        var inside = false;

        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var xi = ring[i].x;
            var yi = ring[i].y;
            var xj = ring[j].x;
            var yj = ring[j].y;
            var intersects = ((yi > y) !== (yj > y)) &&
                (x < ((xj - xi) * (y - yi)) / Math.max(0.0000001, (yj - yi)) + xi);

            if (intersects) inside = !inside;
        }

        return inside;
    }

    function pointInFeature(x, y, feature) {
        for (var i = 0; i < feature.polygons.length; i++) {
            var polygon = feature.polygons[i];
            if (!polygon.length || !pointInRing(x, y, polygon[0])) continue;

            var inHole = false;
            for (var j = 1; j < polygon.length; j++) {
                if (pointInRing(x, y, polygon[j])) {
                    inHole = true;
                    break;
                }
            }

            if (!inHole) return true;
        }

        return false;
    }

    function findHoveredFeature(p, features) {
        var hovered = null;

        for (var i = 0; i < features.length; i++) {
            var feature = features[i];
            var box = feature.bbox;
            if (!box) continue;
            if (p.mouseX < box.minX || p.mouseX > box.maxX || p.mouseY < box.minY || p.mouseY > box.maxY) continue;
            if (!pointInFeature(p.mouseX, p.mouseY, feature)) continue;

            if (!hovered || feature.area < hovered.area) hovered = feature;
        }

        return hovered;
    }

    function drawFeature(p, feature) {
        feature.polygons.forEach(function (polygon) {
            if (!polygon.length || polygon[0].length < 3) return;
            p.beginShape();
            polygon[0].forEach(function (point) {
                p.vertex(point.x, point.y);
            });
            for (var i = 1; i < polygon.length; i++) {
                var hole = polygon[i];
                if (hole.length < 3) continue;
                p.beginContour();
                hole.forEach(function (point) {
                    p.vertex(point.x, point.y);
                });
                p.endContour();
            }
            p.endShape(p.CLOSE);
        });
    }

    function formatCurrency(value) {
        return '$' + Math.round(value).toLocaleString();
    }

    function formatRating(value) {
        return value.toFixed(2) + ' avg';
    }

    function drawInfoBlock(p, x, y, headerText, detailText, maxWidth) {
        p.noStroke();
        p.fill('#1e1b18');
        p.textAlign(p.LEFT, p.TOP);
        p.textFont('IBM Plex Mono');
        p.textStyle(p.BOLD);
        p.textSize(11);
        p.text(headerText, x, y);

        p.textStyle(p.NORMAL);
        p.textSize(11);
        p.fill('#4f4a45');
        p.text(detailText, x, y + 20, maxWidth, 28);
    }

    function buildSharedYears(housingData, yelpData) {
        var housingYears = housingData && housingData.years ? housingData.years : [];
        var yelpYears = yelpData && yelpData.years ? yelpData.years : [];
        var yelpSet = {};
        var shared = [];

        yelpYears.forEach(function (year) {
            yelpSet[year] = true;
        });
        housingYears.forEach(function (year) {
            if (yelpSet[year]) shared.push(year);
        });

        return shared;
    }

    window.VizZipCompare = {
        prepareYelpData: function (payload) {
            payload = payload || {};
            var rows = payload.rows || [];
            var byYear = {};
            var minValue = Infinity;
            var maxValue = -Infinity;

            rows.forEach(function (row) {
                var year = +row.year || 0;
                var zip = String(row.zip_code || '').trim();
                var avg = +row.avg_rating || 0;
                var reviewCount = +row.review_count || 0;
                var businessCount = +row.business_count || 0;
                if (!year || !zip || !avg) return;

                if (!byYear[year]) byYear[year] = { zipValues: {}, values: [] };
                byYear[year].zipValues[zip] = {
                    avgRating: avg,
                    reviewCount: reviewCount,
                    businessCount: businessCount
                };
                byYear[year].values.push(avg);
                if (avg < minValue) minValue = avg;
                if (avg > maxValue) maxValue = avg;
            });

            var years = Object.keys(byYear).map(function (year) { return +year; }).sort(function (a, b) { return a - b; });
            years.forEach(function (year) {
                var values = byYear[year].values;
                byYear[year].cityAverage = values.reduce(function (sum, value) { return sum + value; }, 0) / Math.max(1, values.length);
            });

            if (!years.length) {
                return {
                    years: [],
                    byYear: {},
                    minValue: 0,
                    maxValue: 5
                };
            }

            return {
                years: years,
                byYear: byYear,
                minValue: minValue,
                maxValue: maxValue
            };
        },

        getSelectedYear: function (manager, years) {
            if (!years.length) return null;
            var selectedYear = +manager.zipCompareSelectedYear || years[years.length - 1];
            if (years.indexOf(selectedYear) === -1) {
                selectedYear = years[years.length - 1];
                manager.zipCompareSelectedYear = selectedYear;
            }
            return selectedYear;
        },

        handleSliderInteraction: function (p, manager, years, slider) {
            if (!years.length) return;

            var wasPressed = !!manager.zipCompareMouseWasPressed;
            var justPressed = p.mouseIsPressed && !wasPressed;
            var justReleased = !p.mouseIsPressed && wasPressed;

            if (justReleased) manager.zipCompareSliderDragging = false;

            var knobX = slider.x + slider.progress * slider.w;
            var onTrack = p.mouseX >= slider.x - 10 && p.mouseX <= slider.x + slider.w + 10 &&
                p.mouseY >= slider.y - 12 && p.mouseY <= slider.y + 12;
            var onKnob = p.dist(p.mouseX, p.mouseY, knobX, slider.y) <= slider.knobRadius + 4;

            if (justPressed && (onTrack || onKnob)) manager.zipCompareSliderDragging = true;

            if (manager.zipCompareSliderDragging && p.mouseIsPressed) {
                var t = (p.mouseX - slider.x) / slider.w;
                t = Math.max(0, Math.min(1, t));
                var index = Math.round(t * (years.length - 1));
                manager.zipCompareSelectedYear = years[index];
            }

            manager.zipCompareMouseWasPressed = p.mouseIsPressed;
        },

        drawBottomSlider: function (p, manager, years, selectedYear, left, top, w, h) {
            if (!years.length) return;

            var minYear = years[0];
            var maxYear = years[years.length - 1];
            var index = Math.max(0, years.indexOf(selectedYear));
            var progress = years.length > 1 ? index / (years.length - 1) : 1;
            var sliderW = Math.min(360, w * 0.55);
            var sliderX = left + w / 2 - sliderW / 2;
            var sliderY = top + h - 10;
            var knobRadius = 10;
            var slider = { x: sliderX, y: sliderY, w: sliderW, progress: progress, knobRadius: knobRadius };

            this.handleSliderInteraction(p, manager, years, slider);

            selectedYear = this.getSelectedYear(manager, years);
            index = Math.max(0, years.indexOf(selectedYear));
            progress = years.length > 1 ? index / (years.length - 1) : 1;

            p.textAlign(p.CENTER, p.CENTER);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(13);
            p.fill(45);
            p.text('Year ' + selectedYear, sliderX + sliderW / 2, sliderY - 24);

            p.stroke('#d0d9de');
            p.strokeWeight(6);
            p.line(sliderX, sliderY, sliderX + sliderW, sliderY);

            p.stroke('#0072B2');
            p.line(sliderX, sliderY, sliderX + sliderW * progress, sliderY);

            var knobX = sliderX + sliderW * progress;
            p.noStroke();
            p.fill('#0072B2');
            p.circle(knobX, sliderY, knobRadius * 2);
            p.fill('#ffffff');
            p.circle(knobX, sliderY, knobRadius);

            p.fill('#5b5550');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.textAlign(p.LEFT, p.TOP);
            p.text(String(minYear), sliderX, sliderY + 12);
            p.textAlign(p.RIGHT, p.TOP);
            p.text(String(maxYear), sliderX + sliderW, sliderY + 12);

            p.fill('#4f4a45');
            p.textAlign(p.CENTER, p.TOP);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.text('Drag the slider to change the year and visualize the maps for that year.', sliderX + sliderW / 2, sliderY + 30);
        },

        drawLegendBlock: function (p, x, y, w, title, rangeLabelLeft, rangeLabelRight, rampFn) {
            var legendX = x;
            var legendY = y;
            var legendW = w;
            var steps = 60;

            p.fill(30);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text(title, legendX, legendY - 4);

            p.noStroke();
            for (var i = 0; i < steps; i++) {
                var t = i / (steps - 1);
                p.fill(rampFn(p, t));
                p.rect(legendX + t * legendW, legendY, legendW / steps + 1, 8);
            }

            p.fill('#4f4a45');
            p.textStyle(p.NORMAL);
            p.textSize(10);
            p.textAlign(p.LEFT, p.TOP);
            p.text(rangeLabelLeft, legendX, legendY + 10);
            p.textAlign(p.RIGHT, p.TOP);
            p.text(rangeLabelRight, legendX + legendW, legendY + 10);
        },

        drawPanel: function (p, manager, panel, config) {
            var projectedFeatures = projectFeatures(config.geoData, buildProjection(config.geoData.bounds, panel.mapX, panel.mapY, panel.mapW, panel.mapH));
            var selectedZip = manager[config.selectionKey] || null;
            var justPressed = p.mouseIsPressed && !manager.zipCompareMouseWasPressed;
            var clickedInMap = justPressed &&
                p.mouseX >= panel.mapX &&
                p.mouseX <= panel.mapX + panel.mapW &&
                p.mouseY >= panel.mapY &&
                p.mouseY <= panel.mapY + panel.mapH;

            if (clickedInMap) {
                var clickedFeature = findHoveredFeature(p, projectedFeatures);
                selectedZip = clickedFeature ? clickedFeature.zip : null;
                manager[config.selectionKey] = selectedZip;
            }

            var range = Math.max(0.0001, config.maxValue - config.minValue);

            p.noStroke();
            p.fill('#111111');
            p.textAlign(p.CENTER, p.TOP);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(16);
            p.text(config.title, panel.x + panel.w / 2, panel.y + 14);

            projectedFeatures.forEach(function (feature) {
                var metric = config.values[feature.zip];
                var metricValue = config.valueAccessor(metric);
                var fillColor = metricValue !== null && metricValue !== undefined
                    ? config.rampFn(p, (metricValue - config.minValue) / range)
                    : p.color('#d8dde1');
                var alpha = selectedZip
                    ? (selectedZip === feature.zip ? 255 : (metric ? 105 : 64))
                    : (metric ? 248 : 196);

                p.fill(p.red(fillColor), p.green(fillColor), p.blue(fillColor), alpha);
                p.stroke(selectedZip === feature.zip ? '#111111' : (selectedZip ? '#9aabb8' : '#3d6277'));
                p.strokeWeight(selectedZip === feature.zip ? 2.6 : 1);
                drawFeature(p, feature);
            });

            projectedFeatures.forEach(function (feature) {
                var fontSize = feature.labelScale < 0.017 ? 7 : (feature.labelScale < 0.03 ? 8 : 10);
                var showLabel = selectedZip === feature.zip;

                if (!showLabel) return;

                p.stroke(255, 235);
                p.strokeWeight(3);
                p.fill('#111111');
                p.textFont('IBM Plex Mono');
                p.textStyle(p.BOLD);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(fontSize + 1);
                p.text(feature.zip, feature.labelX, feature.labelY);
            });

            var selectedMetric = selectedZip ? config.values[selectedZip] : null;
            var headerText = selectedZip ? 'ZIP ' + selectedZip : config.defaultHeader;
            var detailText = selectedMetric ? config.hoverDetail(selectedMetric) : config.defaultDetail;
            drawInfoBlock(p, panel.x + 20, panel.y + panel.h - 94, headerText, detailText, panel.w - 40);

            return selectedMetric;
        },

        draw: function (p, manager) {
            var housingData = manager.housingMapData;
            var yelpData = manager.yelpZipYearData;
            var geoData = manager.housingGeoData;
            if (!housingData || !yelpData || !geoData) return;

            var years = buildSharedYears(housingData, yelpData);
            var selectedYear = this.getSelectedYear(manager, years);
            if (!selectedYear) return;

            var housingYear = housingData.byYear[selectedYear] || { zipValues: {}, cityAverage: 0 };
            var yelpYear = yelpData.byYear[selectedYear] || { zipValues: {}, cityAverage: 0 };
            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 16;
            var w = (manager.width || 600) - 40;
            var h = ((manager.height || 520) - 22) * 0.9;
            var gap = 16;
            var panelW = (w - gap) / 2;
            var panelH = h - 110;
            var leftPanel = {
                x: left,
                y: top,
                w: panelW,
                h: panelH,
                mapX: left + 10,
                mapY: top + 46,
                mapW: panelW - 20,
                mapH: panelH - 92
            };
            var rightPanel = {
                x: left + panelW + gap,
                y: top,
                w: panelW,
                h: panelH,
                mapX: left + panelW + gap + 10,
                mapY: top + 46,
                mapW: panelW - 20,
                mapH: panelH - 92
            };

            p.push();
            this.drawPanel(p, manager, leftPanel, {
                title: 'Rent Prices by Year',
                geoData: geoData,
                values: housingYear.zipValues,
                minValue: housingData.minValue,
                maxValue: housingData.maxValue,
                selectionKey: 'zipCompareHousingSelectedZip',
                rampFn: housingColorRamp,
                valueAccessor: function (value) { return typeof value === 'number' ? value : null; },
                defaultHeader: 'Philadelphia overall',
                defaultDetail: formatCurrency(housingYear.cityAverage || 0) + ' average SAFMR',
                hoverDetail: function (metric) {
                    return formatCurrency(metric) + ' average SAFMR';
                },
                legendTitle: 'Rent prices',
                rangeLabelLeft: 'low',
                rangeLabelRight: 'high'
            });

            this.drawPanel(p, manager, rightPanel, {
                title: 'Restaurant Ratings by Year',
                geoData: geoData,
                values: yelpYear.zipValues,
                minValue: yelpData.minValue,
                maxValue: yelpData.maxValue,
                selectionKey: 'zipCompareRatingSelectedZip',
                rampFn: ratingColorRamp,
                valueAccessor: function (value) { return value ? value.avgRating : null; },
                defaultHeader: 'Philadelphia overall',
                defaultDetail: yelpYear.cityAverage ? (yelpYear.cityAverage.toFixed(2) + ' average restaurant rating') : 'No ratings for this year',
                hoverDetail: function (metric) {
                    return metric.avgRating.toFixed(2) + ' average rating';
                },
                legendTitle: 'Restaurant ratings',
                rangeLabelLeft: 'low',
                rangeLabelRight: 'high'
            });

            p.noStroke();
            p.fill('#4f4a45');
            p.textAlign(p.CENTER, p.TOP);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.text('Click any ZIP code area to view its average rent or restaurant rating.', left + w / 2, top + 42);

            this.drawLegendBlock(
                p,
                leftPanel.x + 20,
                leftPanel.y + leftPanel.h + 18,
                leftPanel.w - 40,
                'Rent prices',
                'low',
                'high',
                housingColorRamp
            );

            this.drawLegendBlock(
                p,
                rightPanel.x + 20,
                rightPanel.y + rightPanel.h + 18,
                rightPanel.w - 40,
                'Restaurant ratings',
                'low',
                'high',
                ratingColorRamp
            );

            this.drawBottomSlider(p, manager, years, selectedYear, left, top, w, h);
            p.pop();
        }
    };
})();
