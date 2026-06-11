// Standalone opening animation: Philadelphia restaurant stars going out.
(function () {
    var COL_BG_RGB = [13, 27, 42];
    var COL_OPEN = [126, 176, 205];
    var COL_IND = [126, 176, 205];
    var COL_CHAIN = [218, 210, 190];
    var COL_CLOSED = [178, 72, 82];
    var SAMPLE_SIZE = 1200;

    var canvas, ctx, dots = [], boundary = null, raf = null;
    var stats = {
        openDatasetReviews: 6990280,
        openDatasetBusinesses: 150346,
        metroAreas: 11,
        phillyRestaurants: 0,
        openRestaurants: 0,
        closedRestaurants: 0
    };
    var dataReady = false;

    function shuffle(a) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
        return a;
    }

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function clamp01(x) { return Math.max(0, Math.min(1, x)); }

    function normalizeName(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9 ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function geometryPolygons(geometry) {
        if (!geometry || !geometry.coordinates) return [];
        if (geometry.type === 'Polygon') return [geometry.coordinates];
        if (geometry.type === 'MultiPolygon') return geometry.coordinates;
        return [];
    }

    function buildBounds(rows, geojson) {
        var bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };

        function add(lon, lat) {
            if (!isFinite(lon) || !isFinite(lat)) return;
            if (lon < bounds.minLon) bounds.minLon = lon;
            if (lon > bounds.maxLon) bounds.maxLon = lon;
            if (lat < bounds.minLat) bounds.minLat = lat;
            if (lat > bounds.maxLat) bounds.maxLat = lat;
        }

        if (geojson && geojson.features) {
            geojson.features.forEach(function (feature) {
                geometryPolygons(feature.geometry).forEach(function (polygon) {
                    polygon.forEach(function (ring) {
                        ring.forEach(function (point) {
                            add(point[0], point[1]);
                        });
                    });
                });
            });
        }

        if (!isFinite(bounds.minLon)) {
            rows.forEach(function (row) {
                add(+row.longitude, +row.latitude);
            });
        }

        return bounds;
    }

    function project(lon, lat, bounds, W, H) {
        var lonSpan = Math.max(0.0001, bounds.maxLon - bounds.minLon);
        var latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
        var isSmall = W < 760;
        var isWide = W / Math.max(1, H) > 1.7;
        var mapW = W * (isSmall ? 0.96 : 0.88);
        var mapH = H * (isSmall ? 0.52 : (isWide ? 0.70 : 0.66));
        var scale = Math.min(mapW / lonSpan, mapH / latSpan);
        var drawW = lonSpan * scale;
        var drawH = latSpan * scale;
        var left = (W - drawW) / 2;
        var topAnchor = isSmall ? H * 0.18 : H * 0.08;
        var top = topAnchor + (mapH - drawH) / 2;

        return {
            x: left + (lon - bounds.minLon) * scale,
            y: top + drawH - (lat - bounds.minLat) * scale
        };
    }

    function loadData() {
        Promise.all([
            fetch('data/yelp_filtered/yelp_restaurants_philadelphia_zips.json')
                .then(function (r) { return r.ok ? r.json() : []; })
                .catch(function () { return []; }),
            fetch('data/philadelphia_zctas.geojson')
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; })
        ]).then(function (results) {
            var rows = results[0] || [];
            var geojson = results[1];
            var nameCounts = {};
            var bounds = buildBounds(rows, geojson);

            rows.forEach(function (row) {
                var normalized = normalizeName(row.name);
                if (!normalized) return;
                nameCounts[normalized] = (nameCounts[normalized] || 0) + 1;
            });

            if (geojson && geojson.features) {
                boundary = { bounds: bounds, polygons: [] };
                geojson.features.forEach(function (feature) {
                    geometryPolygons(feature.geometry).forEach(function (polygon) {
                        boundary.polygons.push(polygon);
                    });
                });
            }

            rows = rows.filter(function (row) {
                return +row.latitude && +row.longitude;
            });
            stats.phillyRestaurants = rows.length;
            stats.openRestaurants = rows.filter(function (row) { return +row.is_open === 1; }).length;
            stats.closedRestaurants = rows.length - stats.openRestaurants;

            dots = shuffle(rows.slice()).slice(0, SAMPLE_SIZE).map(function (d) {
                var reviews = +d.review_count || 0;
                var rating = +d.stars || 0;
                var normalized = normalizeName(d.name);
                return {
                    lon: +d.longitude,
                    lat: +d.latitude,
                    bounds: bounds,
                    name: d.name || '',
                    baseR: Math.max(0.9, Math.min(3.8, 0.8 + Math.sqrt(reviews) * 0.08 + rating * 0.18)),
                    isChain: (nameCounts[normalized] || 0) > 1,
                    isClosed: +d.is_open === 0,
                    dieOrder: Math.random(),
                    phase: Math.random() * Math.PI * 2,
                    twinkleSpeed: 0.0008 + Math.random() * 0.0016
                };
            });
            dataReady = true;
        }).catch(function () {
            dataReady = true;
        });
    }

    function buildDOM() {
        var overlay = document.createElement('div');
        overlay.id = 'opening-overlay';
        overlay.innerHTML =
            '<canvas id="opening-canvas"></canvas>' +
            '<div id="opening-copy"><div id="opening-title">Tracking Restaurant Survival Through Yelp Data</div>' +
            '<div id="opening-subtitle">A Philadelphia restaurant analysis using ratings, reviews, business attributes, location, and rent context.</div></div>' +
            '<div id="opening-panel"></div>' +
            '<div id="opening-variables"></div>' +
            '<div id="opening-map-note"></div>' +
            '<div id="opening-map-legend"><span><i class="open-dot"></i>Open</span><span><i class="closed-dot"></i>Closed</span></div>' +
            '<div id="opening-hint">scroll &#8595;</div>';
        document.body.appendChild(overlay);

        var spacer = document.createElement('div');
        spacer.id = 'opening-spacer';
        document.body.insertBefore(spacer, document.body.firstChild);

        canvas = document.getElementById('opening-canvas');
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        if (!canvas) return;
        var dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBoundary(W, H, starDim) {
        if (!boundary || !boundary.polygons || starDim <= 0.01) return;

        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(245,240,232,' + (0.18 * starDim) + ')';
        ctx.lineWidth = 1;
        boundary.polygons.forEach(function (polygon) {
            if (!polygon.length || !polygon[0].length) return;
            ctx.beginPath();
            polygon[0].forEach(function (point, index) {
                var projected = project(point[0], point[1], boundary.bounds, W, H);
                if (index === 0) ctx.moveTo(projected.x, projected.y);
                else ctx.lineTo(projected.x, projected.y);
            });
            ctx.closePath();
            ctx.stroke();
        });
    }

    function formatNumber(value) {
        return Math.round(value).toLocaleString();
    }

    function countUp(target, sceneProgress) {
        var slowed = Math.pow(clamp01(sceneProgress), 1.8);
        return target * easeOut(slowed);
    }

    function setPanel(progress) {
        var panel = document.getElementById('opening-panel');
        var variables = document.getElementById('opening-variables');
        var mapNote = document.getElementById('opening-map-note');
        var mapLegend = document.getElementById('opening-map-legend');
        if (!panel || !variables || !mapNote || !mapLegend) return;

        var scene2 = clamp01((progress - 0.14) / 0.16);
        var scene4 = clamp01((progress - 0.36) / 0.18);
        var scene5 = clamp01((progress - 0.54) / 0.12);
        var mapScene = clamp01((progress - 0.60) / 0.10);
        var mapLegendScene = scene2;
        var fadeOut;

        mapNote.innerHTML =
            '<strong>Every dot is a Philadelphia restaurant.</strong><br>' +
            '<span class="opening-inline-key opening-open-key"><i></i>Blue dots</span> are still open. ' +
            '<span class="opening-inline-key opening-closed-key"><i></i>Red dots</span> are closed. ' +
            'They are mixed across the city, which means closure is not isolated to one unsafe area. The reason restaurants disappear is deeper than location alone.';
        mapNote.style.opacity = String((1 - clamp01((progress - 0.975) / 0.025)) * mapScene);
        mapLegend.style.opacity = String((1 - clamp01((progress - 0.975) / 0.025)) * mapLegendScene);

        if (scene5 > 0) {
            panel.innerHTML = '';
            panel.style.opacity = '0';
            variables.innerHTML =
                '<div class="opening-variables-title">So we test the signals behind survival:</div>' +
                '<span>Rating</span><span>Review count</span><span>Delivery availability</span><span>Parking</span>' +
                '<span>Price tier</span><span>ZIP code</span><span>Neighborhood rent</span><span>Open / closed status</span>';
            variables.style.opacity = String((1 - clamp01((progress - 0.80) / 0.06)) * scene5);
            return;
        }

        variables.style.opacity = '0';
        if (scene4 > 0) {
            fadeOut = 1 - clamp01((progress - 0.56) / 0.08);
            panel.innerHTML =
                '<div class="opening-panel-label">Final Dataset</div>' +
                '<strong>' + formatNumber(countUp(stats.phillyRestaurants || 5846, scene4)) + '</strong> Philadelphia restaurants<br>' +
                '<strong>' + formatNumber(countUp(stats.openRestaurants || 3532, scene4)) + '</strong> open<br>' +
                '<strong>' + formatNumber(countUp(stats.closedRestaurants || 2314, scene4)) + '</strong> closed';
            panel.style.opacity = String(scene4 * fadeOut);
        } else if (scene2 > 0) {
            fadeOut = 1 - clamp01((progress - 0.34) / 0.08);
            panel.innerHTML =
                '<div class="opening-panel-label">Yelp Open Dataset</div>' +
                '<strong>' + formatNumber(countUp(stats.openDatasetReviews, scene2)) + '</strong> reviews<br>' +
                '<strong>' + formatNumber(countUp(stats.openDatasetBusinesses, scene2)) + '</strong> businesses<br>' +
                '<strong>' + formatNumber(countUp(stats.metroAreas, scene2)) + '</strong> metropolitan areas';
            panel.style.opacity = String(scene2 * fadeOut);
        } else {
            panel.style.opacity = '0';
        }
    }

    function render() {
        raf = requestAnimationFrame(render);
        if (!canvas || !ctx) return;

        var W = window.innerWidth;
        var H = window.innerHeight;
        var spacer = document.getElementById('opening-spacer');
        var spacerH = spacer ? spacer.offsetHeight : H;
        var scrollY = window.scrollY || window.pageYOffset;
        var progress = clamp01(scrollY / (spacerH - H));
        var overlay = document.getElementById('opening-overlay');

        if (progress >= 1) {
            if (overlay) overlay.style.opacity = '0';
            if (overlay) overlay.style.pointerEvents = 'none';
            return;
        }

        if (overlay) overlay.style.pointerEvents = 'none';

        var whiten = easeInOut(clamp01((progress - 0.965) / 0.035));
        var bg = [
            Math.round(COL_BG_RGB[0] + (255 - COL_BG_RGB[0]) * whiten),
            Math.round(COL_BG_RGB[1] + (255 - COL_BG_RGB[1]) * whiten),
            Math.round(COL_BG_RGB[2] + (255 - COL_BG_RGB[2]) * whiten)
        ];
        var starDim = 1 - whiten;
        var titleProg = 1 - clamp01((progress - 0.22) / 0.12);

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgb(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ')';
        ctx.fillRect(0, 0, W, H);

        if (overlay) overlay.style.opacity = String(1 - clamp01((progress - 0.985) / 0.015));

        var cover = document.getElementById('cover-info');
        if (cover) {
            var coverFade = clamp01((progress - 0.94) / 0.05);
            cover.style.opacity = String(coverFade);
            cover.style.transition = 'none';
        }

        setPanel(progress);

        if (!dataReady || !dots.length) return;

        var t = performance.now();
        var dieWindow = clamp01((progress - 0.1) / 0.7);

        ctx.save();
        drawBoundary(W, H, starDim);
        ctx.globalCompositeOperation = 'source-over';

        dots.forEach(function (dot) {
            var projected = project(dot.lon, dot.lat, dot.bounds, W, H);
            var rgb = dot.isClosed ? COL_CLOSED : COL_OPEN;
            var twinkle = 0.7 + 0.3 * Math.sin(t * dot.twinkleSpeed + dot.phase);
            var statusReveal = clamp01((progress - 0.66) / 0.12);
            var intensity = twinkle;

            if (dot.isClosed) {
                var localDie = clamp01((dieWindow - dot.dieOrder * 0.85) / 0.18);
                intensity = Math.max(twinkle * (1 - easeOut(localDie)), 0.62 * statusReveal);
            } else if (statusReveal > 0) {
                intensity = Math.max(intensity, 0.42 * statusReveal);
            }

            intensity *= starDim;
            if (intensity <= 0.01) return;

            var r = dot.baseR + (dot.isClosed ? 1.15 : 0.55) * statusReveal;
            var glowR = r * (dot.isClosed ? 2.15 : 1.9);
            var grad = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, glowR);
            grad.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + ((dot.isClosed ? 0.48 : 0.34) * intensity) + ')');
            grad.addColorStop(0.55, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + ((dot.isClosed ? 0.16 : 0.08) * intensity) + ')');
            grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, glowR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = dot.isClosed
                ? 'rgba(245,120,130,' + (0.82 * intensity) + ')'
                : 'rgba(210,230,238,' + (0.74 * intensity) + ')';
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        var titleEl = document.getElementById('opening-title');
        var subtitleEl = document.getElementById('opening-subtitle');
        var hintEl = document.getElementById('opening-hint');
        if (titleEl) titleEl.style.opacity = String(titleProg * starDim);
        if (subtitleEl) subtitleEl.style.opacity = String(titleProg * starDim);
        if (hintEl) hintEl.style.opacity = String((1 - clamp01(progress / 0.12)) * 0.7);
    }

    function init() {
        buildDOM();
        loadData();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
