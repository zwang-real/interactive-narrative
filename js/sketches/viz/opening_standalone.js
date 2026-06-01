// Standalone opening animation: Philadelphia restaurant stars going out.
(function () {
    var COL_BG_RGB = [13, 27, 42];
    var COL_IND = [245, 238, 220];
    var COL_CHAIN = [130, 195, 255];
    var COL_CLOSED = [227, 26, 28];
    var SAMPLE_SIZE = 1200;

    var canvas, ctx, dots = [], boundary = null, garcesDot = null, raf = null;
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
        var mapW = W * 0.78;
        var mapH = H * 0.58;
        var scale = Math.min(mapW / lonSpan, mapH / latSpan);
        var drawW = lonSpan * scale;
        var drawH = latSpan * scale;
        var left = (W - drawW) / 2;
        var top = H * 0.12 + (mapH - drawH) / 2;

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
                var isGarces = /garces trading company/i.test(d.name || '');

                return {
                    lon: +d.longitude,
                    lat: +d.latitude,
                    bounds: bounds,
                    name: d.name || '',
                    baseR: Math.max(0.9, Math.min(3.8, 0.8 + Math.sqrt(reviews) * 0.08 + rating * 0.18)),
                    isChain: (nameCounts[normalized] || 0) > 1,
                    isClosed: +d.is_open === 0,
                    isGarces: isGarces,
                    dieOrder: isGarces ? 0.45 : Math.random(),
                    phase: Math.random() * Math.PI * 2,
                    twinkleSpeed: 0.0008 + Math.random() * 0.0016
                };
            });

            garcesDot = dots.filter(function (dot) { return dot.isGarces; })[0] || {
                lon: -75.1609,
                lat: 39.9489,
                bounds: bounds,
                name: 'Garces Trading Company',
                baseR: 4.8,
                isChain: false,
                isClosed: true,
                isGarces: true,
                dieOrder: 0.45,
                phase: 0,
                twinkleSpeed: 0.001
            };

            if (dots.indexOf(garcesDot) === -1) dots.push(garcesDot);
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
            '<div id="opening-garces">Garces Trading Company<br><span>4.0 stars · ~900 reviews · closed in 2018</span></div>' +
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
        return target * easeOut(clamp01(sceneProgress));
    }

    function setPanel(progress) {
        var panel = document.getElementById('opening-panel');
        var variables = document.getElementById('opening-variables');
        if (!panel || !variables) return;

        var scene2 = clamp01((progress - 0.14) / 0.16);
        var scene3 = clamp01((progress - 0.32) / 0.16);
        var scene4 = clamp01((progress - 0.50) / 0.16);
        var scene5 = clamp01((progress - 0.66) / 0.14);
        var fadeOut;

        if (scene5 > 0) {
            panel.innerHTML = '';
            panel.style.opacity = '0';
            variables.innerHTML =
                '<span>Rating</span><span>Review count</span><span>Delivery</span><span>Parking</span>' +
                '<span>Price tier</span><span>ZIP code</span><span>Rent level</span><span>Open / closed status</span>';
            variables.style.opacity = String((1 - clamp01((progress - 0.82) / 0.08)) * scene5);
            return;
        }

        variables.style.opacity = '0';
        if (scene4 > 0) {
            fadeOut = 1 - clamp01((progress - 0.66) / 0.08);
            panel.innerHTML =
                '<div class="opening-panel-label">Final Dataset</div>' +
                '<strong>' + formatNumber(countUp(stats.phillyRestaurants || 5846, scene4)) + '</strong> Philadelphia restaurants<br>' +
                '<strong>' + formatNumber(countUp(stats.openRestaurants || 3532, scene4)) + '</strong> open<br>' +
                '<strong>' + formatNumber(countUp(stats.closedRestaurants || 2314, scene4)) + '</strong> closed';
            panel.style.opacity = String(scene4 * fadeOut);
        } else if (scene3 > 0) {
            fadeOut = 1 - clamp01((progress - 0.48) / 0.08);
            panel.innerHTML =
                '<div class="opening-panel-label">From millions of Yelp records...</div>' +
                '+ Philadelphia businesses<br>' +
                '+ Restaurants and food businesses<br>' +
                '+ Businesses with open/closed status<br>' +
                '+ Restaurants matched with rent context';
            panel.style.opacity = String(scene3 * fadeOut);
        } else if (scene2 > 0) {
            fadeOut = 1 - clamp01((progress - 0.30) / 0.08);
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

        var whiten = easeInOut(clamp01((progress - 0.85) / 0.15));
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

        if (overlay) overlay.style.opacity = String(1 - clamp01((progress - 0.92) / 0.08));

        var cover = document.getElementById('cover-info');
        if (cover) {
            var coverFade = clamp01((progress - 0.8) / 0.18);
            cover.style.opacity = String(coverFade);
            cover.style.transition = 'none';
        }

        setPanel(progress);

        if (!dataReady || !dots.length) return;

        var t = performance.now();
        var dieWindow = clamp01((progress - 0.1) / 0.7);

        ctx.save();
        drawBoundary(W, H, starDim);
        ctx.globalCompositeOperation = 'lighter';

        dots.forEach(function (dot) {
            var projected = project(dot.lon, dot.lat, dot.bounds, W, H);
            var rgb = dot.isChain ? COL_CHAIN : COL_IND;
            var twinkle = 0.7 + 0.3 * Math.sin(t * dot.twinkleSpeed + dot.phase);
            var intensity = twinkle;

            if (dot.isClosed) {
                var localDie = clamp01((dieWindow - dot.dieOrder * 0.85) / 0.18);
                intensity = twinkle * (1 - easeOut(localDie));
                if (localDie > 0.55) rgb = COL_CLOSED;
            }

            intensity *= starDim;
            if (dot.isGarces) intensity = Math.max(intensity, 0.3 * starDim);
            if (intensity <= 0.01) return;

            var r = dot.isGarces ? dot.baseR + 1.4 * titleProg : dot.baseR;
            var glowR = r * (dot.isGarces ? 4.2 : 2.4);
            var grad = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, glowR);
            grad.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (0.55 * intensity) + ')');
            grad.addColorStop(0.5, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (0.18 * intensity) + ')');
            grad.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, glowR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,250,245,' + (0.95 * intensity) + ')';
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, r * 0.55, 0, Math.PI * 2);
            ctx.fill();

            if (dot.isGarces && titleProg > 0.2) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = 'rgba(227,26,28,' + (0.85 * titleProg * starDim) + ')';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(projected.x, projected.y, 15 + 6 * Math.sin(t * 0.003), 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalCompositeOperation = 'lighter';
            }
        });

        ctx.restore();

        var titleEl = document.getElementById('opening-title');
        var subtitleEl = document.getElementById('opening-subtitle');
        var garcesEl = document.getElementById('opening-garces');
        var hintEl = document.getElementById('opening-hint');
        if (titleEl) titleEl.style.opacity = String(titleProg * starDim);
        if (subtitleEl) subtitleEl.style.opacity = String(titleProg * starDim);
        if (garcesEl) garcesEl.style.opacity = String(easeInOut(clamp01((progress - 0.80) / 0.08)) * starDim);
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
