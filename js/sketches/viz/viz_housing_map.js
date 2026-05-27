// Philadelphia ZIP housing map rendered from Census ZCTA polygons in p5.
(function () {
    var DEFAULT_YEARS = [];

    for (var year = 2011; year <= 2026; year++) DEFAULT_YEARS.push(year);

    function parseCSV(text) {
        var rows = [];
        var row = [];
        var value = '';
        var inQuotes = false;

        for (var i = 0; i < text.length; i++) {
            var ch = text[i];

            if (ch === '"') {
                if (inQuotes && text[i + 1] === '"') {
                    value += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch === ',' && !inQuotes) {
                row.push(value);
                value = '';
                continue;
            }

            if ((ch === '\n' || ch === '\r') && !inQuotes) {
                if (ch === '\r' && text[i + 1] === '\n') i += 1;
                row.push(value);
                value = '';
                if (row.length && row.some(function (cell) { return cell !== ''; })) rows.push(row);
                row = [];
                continue;
            }

            value += ch;
        }

        if (value !== '' || row.length) {
            row.push(value);
            rows.push(row);
        }

        if (rows.length < 2) return [];
        var headers = rows[0].map(function (d) { return (d || '').trim(); });
        return rows.slice(1).map(function (line) {
            var out = {};
            headers.forEach(function (header, index) {
                out[header] = (line[index] || '').trim();
            });
            return out;
        });
    }

    function numericValue(value) {
        var cleaned = String(value || '').replace(/[$,]/g, '').trim();
        var parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    function zipAverage(row) {
        var values = [
            numericValue(row.safmr_0br),
            numericValue(row.safmr_1br),
            numericValue(row.safmr_2br),
            numericValue(row.safmr_3br),
            numericValue(row.safmr_4br)
        ].filter(function (value) { return value > 0; });

        if (!values.length) return 0;
        return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    }

    function colorRamp(p, t) {
        var stops = [
            { at: 0, color: p.color('#C8E4F5') },
            { at: 0.45, color: p.color('#94CBEC') },
            { at: 1, color: p.color('#0072B2') }
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

    function textColorFor(p, colorValue) {
        var luminance = 0.299 * p.red(colorValue) + 0.587 * p.green(colorValue) + 0.114 * p.blue(colorValue);
        return luminance < 150 ? '#ffffff' : '#16354c';
    }

    function fallbackData() {
        var byYear = {};

        DEFAULT_YEARS.forEach(function (year, index) {
            byYear[year] = {
                zipValues: {},
                cityAverage: 950 + index * 35
            };
        });

        return {
            years: DEFAULT_YEARS.slice(),
            byYear: byYear,
            minValue: 950,
            maxValue: 1600,
            defaultYear: DEFAULT_YEARS[DEFAULT_YEARS.length - 1],
            isFallback: true
        };
    }

    function normalizeGeometry(geometry) {
        if (!geometry || !geometry.type || !geometry.coordinates) return [];
        if (geometry.type === 'Polygon') return [geometry.coordinates];
        if (geometry.type === 'MultiPolygon') return geometry.coordinates;
        return [];
    }

    function buildBoundaryData(geojson) {
        if (!geojson || !geojson.features || !geojson.features.length) return null;

        var minLon = Infinity;
        var maxLon = -Infinity;
        var minLat = Infinity;
        var maxLat = -Infinity;

        var features = geojson.features.map(function (feature) {
            var zip = String((feature.properties && (feature.properties.ZCTA5 || feature.properties.GEOID)) || '').trim();
            var polygons = normalizeGeometry(feature.geometry);
            var featureMinLon = Infinity;
            var featureMaxLon = -Infinity;
            var featureMinLat = Infinity;
            var featureMaxLat = -Infinity;

            polygons.forEach(function (polygon) {
                polygon.forEach(function (ring) {
                    ring.forEach(function (point) {
                        var lon = point[0];
                        var lat = point[1];
                        if (lon < minLon) minLon = lon;
                        if (lon > maxLon) maxLon = lon;
                        if (lat < minLat) minLat = lat;
                        if (lat > maxLat) maxLat = lat;
                        if (lon < featureMinLon) featureMinLon = lon;
                        if (lon > featureMaxLon) featureMaxLon = lon;
                        if (lat < featureMinLat) featureMinLat = lat;
                        if (lat > featureMaxLat) featureMaxLat = lat;
                    });
                });
            });

            return {
                zip: zip,
                polygons: polygons,
                labelLon: (featureMinLon + featureMaxLon) / 2,
                labelLat: (featureMinLat + featureMaxLat) / 2,
                lonSpan: featureMaxLon - featureMinLon,
                latSpan: featureMaxLat - featureMinLat
            };
        }).filter(function (feature) {
            return feature.zip && feature.polygons.length;
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

    function buildProjection(bounds, left, top, width, height) {
        var lonSpan = Math.max(0.0001, bounds.maxLon - bounds.minLon);
        var latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
        var padding = 18;
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

            return {
                zip: feature.zip,
                polygons: projectedPolygons,
                labelX: labelPoint.x,
                labelY: labelPoint.y,
                labelScale: Math.max(feature.lonSpan, feature.latSpan)
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
        for (var i = features.length - 1; i >= 0; i--) {
            if (pointInFeature(p.mouseX, p.mouseY, features[i])) return features[i];
        }
        return null;
    }

    function drawFeature(p, feature) {
        feature.polygons.forEach(function (polygon) {
            if (!polygon.length || polygon[0].length < 3) return;
            p.beginShape();
            polygon[0].forEach(function (point) {
                p.vertex(point.x, point.y);
            });
            p.endShape(p.CLOSE);
        });
    }

    window.VizHousingMap = {
        prepareData: function (csvText) {
            var rows = parseCSV(csvText || '');
            if (!rows.length) return fallbackData();

            var grouped = {};
            rows.forEach(function (row) {
                var year = +row.Year || 0;
                var zip = String(row.zip_code || '').trim();
                var avg = zipAverage(row);
                if (!year || !zip || !avg) return;

                if (!grouped[year]) grouped[year] = { zipValues: {}, values: [] };
                grouped[year].zipValues[zip] = avg;
                grouped[year].values.push(avg);
            });

            var years = Object.keys(grouped).map(function (d) { return +d; }).sort(function (a, b) { return a - b; });
            if (!years.length) return fallbackData();

            var allValues = [];
            years.forEach(function (year) {
                grouped[year].cityAverage = grouped[year].values.reduce(function (sum, value) { return sum + value; }, 0) / grouped[year].values.length;
                allValues = allValues.concat(grouped[year].values);
            });

            return {
                years: years,
                byYear: grouped,
                minValue: Math.min.apply(null, allValues),
                maxValue: Math.max.apply(null, allValues),
                defaultYear: years[years.length - 1],
                isFallback: false
            };
        },

        prepareGeoData: function (geojson) {
            return buildBoundaryData(geojson);
        },

        getSelectedYear: function (manager, data) {
            var years = data.years && data.years.length ? data.years : DEFAULT_YEARS;
            var selectedYear = +manager.housingSelectedYear || data.defaultYear;
            if (years.indexOf(selectedYear) === -1) {
                selectedYear = data.defaultYear || years[years.length - 1];
                manager.housingSelectedYear = selectedYear;
            }
            return selectedYear;
        },

        handleSliderInteraction: function (p, manager, data, slider) {
            var years = data.years && data.years.length ? data.years : DEFAULT_YEARS;
            if (!years.length) return;

            var wasPressed = !!manager.housingMouseWasPressed;
            var justPressed = p.mouseIsPressed && !wasPressed;
            var justReleased = !p.mouseIsPressed && wasPressed;

            if (justReleased) manager.housingSliderDragging = false;

            var knobX = slider.x + slider.progress * slider.w;
            var onTrack = p.mouseX >= slider.x - 10 && p.mouseX <= slider.x + slider.w + 10 &&
                p.mouseY >= slider.y - 12 && p.mouseY <= slider.y + 12;
            var onKnob = p.dist(p.mouseX, p.mouseY, knobX, slider.y) <= slider.knobRadius + 4;

            if (justPressed && (onTrack || onKnob)) manager.housingSliderDragging = true;

            if (manager.housingSliderDragging && p.mouseIsPressed) {
                var t = (p.mouseX - slider.x) / slider.w;
                t = Math.max(0, Math.min(1, t));
                var index = Math.round(t * (years.length - 1));
                manager.housingSelectedYear = years[index];
            }

            manager.housingMouseWasPressed = p.mouseIsPressed;
        },

        drawSlider: function (p, manager, data, selectedYear, left, top, w, h) {
            var years = data.years && data.years.length ? data.years : DEFAULT_YEARS;
            var minYear = years[0];
            var maxYear = years[years.length - 1];
            var index = Math.max(0, years.indexOf(selectedYear));
            var progress = years.length > 1 ? index / (years.length - 1) : 1;
            var sliderW = Math.min(300, w * 0.5);
            var sliderX = left + w * 0.34;
            var sliderY = top + h + 62;
            var knobRadius = 9;
            var activeValue = data.byYear[selectedYear] ? data.byYear[selectedYear].cityAverage : 0;
            var slider = { x: sliderX, y: sliderY, w: sliderW, progress: progress, knobRadius: knobRadius };

            this.handleSliderInteraction(p, manager, data, slider);

            selectedYear = this.getSelectedYear(manager, data);
            index = Math.max(0, years.indexOf(selectedYear));
            progress = years.length > 1 ? index / (years.length - 1) : 1;
            activeValue = data.byYear[selectedYear] ? data.byYear[selectedYear].cityAverage : 0;

            p.textAlign(p.CENTER, p.CENTER);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.BOLD);
            p.textSize(12);
            p.fill(54);
            p.text('Year ' + selectedYear, sliderX + sliderW / 2, sliderY - 22);

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

            p.textAlign(p.CENTER, p.TOP);
            p.textSize(11);
            p.text(
                activeValue ? 'Citywide ZIP average: $' + Math.round(activeValue).toLocaleString() : 'No data for selected year',
                sliderX + sliderW / 2,
                sliderY + 28
            );
        },

        drawLegend: function (p, left, top, minValue, maxValue) {
            var legendW = 250;
            var legendX = left + 22;
            var legendY = top + 26;
            var steps = 80;

            p.noStroke();
            for (var i = 0; i < steps; i++) {
                var t = i / (steps - 1);
                p.fill(colorRamp(p, t));
                p.rect(legendX + t * legendW, legendY, legendW / steps + 1, 10);
            }

            p.fill(28);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.BOLD);
            p.textSize(13);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('Lower SAFMR to Higher SAFMR', legendX, legendY - 4);

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.textAlign(p.LEFT, p.TOP);
            p.text('$' + Math.round(minValue).toLocaleString(), legendX, legendY + 14);
            p.textAlign(p.RIGHT, p.TOP);
            p.text('$' + Math.round(maxValue).toLocaleString(), legendX + legendW, legendY + 14);
        },

        draw: function (p, manager) {
            var data = manager.housingMapData || this.prepareData('');
            var boundaryData = manager.housingGeoData;
            var selectedYear = this.getSelectedYear(manager, data);
            var selected = data.byYear[selectedYear] || { zipValues: {}, cityAverage: 0 };
            var previous = data.byYear[selectedYear - 1] || null;
            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 26;
            var w = (manager.width || 600) - 64;
            var h = (manager.height || 520) - 122;
            var mapLeft = left + 10;
            var mapTop = top + 62;
            var mapW = Math.min(560, w * 0.72);
            var mapH = Math.min(640, h * 1.04);
            var infoX = left + w * 0.73;
            var infoY = top + 108;
            var cityDelta = previous ? (selected.cityAverage - previous.cityAverage) : 0;
            var hoveredZip = null;
            var hoveredValue = 0;
            var hoveredPrev = 0;
            var hoveredDelta = 0;
            var projectedFeatures = [];
            var projection = null;
            var range = Math.max(1, data.maxValue - data.minValue);

            p.push();
            p.noStroke();
            p.fill('#f7f8f8');
            p.rect(left - 28, top - 18, w + 56, h + 128);

            p.fill(28);
            p.textFont('Spectral');
            p.textStyle(p.BOLD);
            p.textSize(23);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('HOUSING\nPRICES\nMAP', left + w * 0.63, top + 34);

            p.noFill();
            p.stroke(30);
            p.strokeWeight(1);
            p.ellipse(left + w * 0.63, top + 34, Math.min(w * 0.52, 300), 98);

            p.noStroke();
            p.fill('#eef2f3');
            p.rect(mapLeft - 10, mapTop - 10, mapW + 20, mapH + 20, 18);

            if (boundaryData && boundaryData.features && boundaryData.features.length) {
                projection = buildProjection(boundaryData.bounds, mapLeft, mapTop, mapW, mapH);
                projectedFeatures = projectFeatures(boundaryData, projection);

                var hoveredFeature = findHoveredFeature(p, projectedFeatures);
                hoveredZip = hoveredFeature ? hoveredFeature.zip : null;
                hoveredValue = hoveredZip ? selected.zipValues[hoveredZip] : 0;
                hoveredPrev = hoveredZip && previous ? previous.zipValues[hoveredZip] : 0;
                hoveredDelta = hoveredValue && hoveredPrev ? (hoveredValue - hoveredPrev) : 0;

                projectedFeatures.forEach(function (feature) {
                    var value = selected.zipValues[feature.zip];
                    var fillColor = value
                        ? colorRamp(p, (value - data.minValue) / range)
                        : p.color('#d8dde1');
                    var alpha = hoveredZip === feature.zip ? 250 : (value ? 228 : 190);

                    p.fill(p.red(fillColor), p.green(fillColor), p.blue(fillColor), alpha);
                    p.stroke(hoveredZip === feature.zip ? '#111111' : '#3d6277');
                    p.strokeWeight(hoveredZip === feature.zip ? 2.2 : 1.05);
                    drawFeature(p, feature);
                });

                projectedFeatures.forEach(function (feature) {
                    var value = selected.zipValues[feature.zip];
                    var fillColor = value
                        ? colorRamp(p, (value - data.minValue) / range)
                        : p.color('#d8dde1');
                    var fontSize = feature.labelScale < 0.017 ? 9 : (feature.labelScale < 0.03 ? 10 : 12);

                    p.noStroke();
                    p.fill(textColorFor(p, fillColor));
                    p.textFont('IBM Plex Mono');
                    p.textStyle(hoveredZip === feature.zip ? p.BOLD : p.NORMAL);
                    p.textAlign(p.CENTER, p.CENTER);
                    p.textSize(fontSize);
                    p.text(feature.zip, feature.labelX, feature.labelY);
                });
            } else {
                p.fill('#dfe7eb');
                p.rect(mapLeft, mapTop, mapW, mapH, 18);
                p.fill('#5b5550');
                p.textAlign(p.CENTER, p.CENTER);
                p.textFont('IBM Plex Mono');
                p.textSize(12);
                p.text('ZIP boundary file unavailable', mapLeft + mapW / 2, mapTop + mapH / 2);
            }

            p.fill('#111111');
            p.textAlign(p.LEFT, p.TOP);
            p.textFont('IBM Plex Mono');
            p.textStyle(p.BOLD);
            p.textSize(15);
            p.text(hoveredZip ? 'ZIP ' + hoveredZip : 'Philadelphia ZIP SAFMR', infoX, infoY);

            p.textFont('IBM Plex Mono');
            p.textSize(30);
            p.text(selectedYear, infoX, infoY + 24);

            p.textFont('IBM Plex Mono');
            p.textStyle(p.NORMAL);
            p.textSize(12);
            p.fill('#5b5550');
            p.text(
                hoveredZip
                    ? 'Hovered ZIP average across 0BR to 4BR SAFMR values for the selected year.'
                    : 'Census ZCTA boundaries drawn directly in p5. Drag the slider to see rent changes over time.',
                infoX,
                infoY + 72,
                Math.min(220, w * 0.24),
                78
            );

            var mainValue = hoveredZip ? hoveredValue : selected.cityAverage;
            var deltaValue = hoveredZip ? hoveredDelta : cityDelta;
            p.fill('#111111');
            p.textStyle(p.BOLD);
            p.textSize(28);
            p.text(mainValue ? '$' + Math.round(mainValue).toLocaleString() : 'No data', infoX, infoY + 154);

            p.textStyle(p.NORMAL);
            p.textSize(12);
            p.fill(deltaValue >= 0 ? '#0a5d2c' : '#8a2332');
            p.text(
                previous
                    ? ((deltaValue >= 0 ? '+' : '-') + '$' + Math.round(Math.abs(deltaValue)).toLocaleString() + ' vs previous year')
                    : 'No previous-year comparison',
                infoX,
                infoY + 190
            );

            p.fill(35);
            p.textAlign(p.CENTER, p.TOP);
            p.textSize(12);
            p.text(
                boundaryData && boundaryData.features && boundaryData.features.length
                    ? 'Philadelphia ZCTA boundaries with SAFMR values by year'
                    : 'Philadelphia ZIP housing map',
                mapLeft + mapW / 2,
                mapTop + mapH + 4
            );

            this.drawLegend(p, left, top, data.minValue, data.maxValue);
            this.drawSlider(p, manager, data, selectedYear, left, top, w, h);
            p.pop();
        }
    };
})();
