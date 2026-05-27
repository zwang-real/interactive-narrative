// Housing price ZIP map for the SAFMR data.
(function () {
    var ZIP_LAYOUT = [
        ['19116', '19115', '19114', null, null, null, null, null],
        ['19154', '19152', '19111', '19149', null, null, null, null],
        ['19150', '19138', '19141', '19120', '19124', '19135', '19136', '19137'],
        ['19119', '19144', '19140', '19134', '19125', '19122', '19123', null],
        ['19128', '19127', '19129', '19132', '19121', '19130', '19107', '19106'],
        [null, '19131', '19104', '19103', '19102', '19109', '19108', '19147'],
        [null, '19139', '19143', '19146', '19145', '19148', '19112', null],
        [null, null, '19142', '19153', '19151', '19110', '19105', null],
        [null, null, null, null, '19101', '19160', '19176', '19190']
    ];

    function parseCSV(text) {
        var lines = (text || '').trim().split(/\r?\n/);
        if (lines.length < 2) return [];

        var headers = lines[0].split(',').map(function (d) { return d.trim(); });
        return lines.slice(1).map(function (line) {
            var values = line.split(',');
            var row = {};
            headers.forEach(function (header, i) {
                row[header] = values[i];
            });
            return row;
        });
    }

    function colorRamp(p, t) {
        var low = p.color('#7e2954');
        var high = p.color('#94cbec');
        return p.lerpColor(low, high, Math.max(0, Math.min(1, t)));
    }

    function fallbackPoints() {
        var points = [];
        ZIP_LAYOUT.forEach(function (layoutRow, y) {
            layoutRow.forEach(function (zip, x) {
                if (!zip) return;
                var centerPull = 1 - Math.min(1, Math.abs(x - 4.4) / 4.4);
                var northPull = 1 - Math.min(1, y / 8);
                var zipSignal = ((+zip.slice(-2) || 0) % 11) / 11;
                var value = 950 + Math.round((centerPull * 0.48 + northPull * 0.28 + zipSignal * 0.24) * 980);
                points.push({ zip: zip, x: x, y: y, value: value });
            });
        });
        return points;
    }

    window.VizHousingMap = {
        prepareData: function (csvText) {
            var rows = parseCSV(csvText);
            if (!rows.length) {
                var fallback = fallbackPoints();
                var fallbackValues = fallback.map(function (d) { return d.value; });
                return {
                    points: fallback,
                    minValue: Math.min.apply(null, fallbackValues),
                    maxValue: Math.max.apply(null, fallbackValues),
                    year: 'example',
                    isFallback: true
                };
            }

            var latestYear = rows.reduce(function (latest, row) {
                return Math.max(latest, +row.Year || 0);
            }, 0);

            var byZip = {};
            rows.forEach(function (row) {
                if ((+row.Year || 0) !== latestYear) return;
                var zip = row.zip_code;
                var value = +(row.safmr_2br || row.safmr_1br || row.safmr_0br || 0);
                if (zip && value) byZip[zip] = value;
            });

            var points = [];
            ZIP_LAYOUT.forEach(function (layoutRow, y) {
                layoutRow.forEach(function (zip, x) {
                    if (!zip || !byZip[zip]) return;
                    points.push({ zip: zip, x: x, y: y, value: byZip[zip] });
                });
            });

            var values = points.map(function (d) { return d.value; });
            return {
                points: points,
                minValue: Math.min.apply(null, values),
                maxValue: Math.max.apply(null, values),
                year: latestYear,
                isFallback: false
            };
        },

        draw: function (p, manager) {
            var data = manager.housingMapData || this.prepareData('');
            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 42;
            var w = (manager.width || 600) - 64;
            var h = (manager.height || 520) - 112;
            var cx = left + w / 2;

            p.push();
            p.noStroke();
            p.fill(255);
            p.rect(left - 28, top - 36, w + 56, h + 110);

            p.fill(28);
            p.textFont('Times New Roman');
            p.textStyle(p.BOLD);
            p.textSize(23);
            p.textAlign(p.CENTER, p.CENTER);
            p.text('HOUSING\nPRICES\nMAP', cx, top + 62);

            p.noFill();
            p.stroke(30);
            p.strokeWeight(1);
            p.ellipse(cx, top + 62, Math.min(w * 0.62, 320), 108);

            var cell = Math.min(w / 9.5, h / 10.5, 38);
            var mapW = 8 * cell;
            var mapH = 9 * cell;
            var mapLeft = cx - mapW / 2;
            var mapTop = top + 138;
            var range = Math.max(1, data.maxValue - data.minValue);

            data.points.forEach(function (d) {
                var x = mapLeft + d.x * cell + cell / 2;
                var y = mapTop + d.y * cell + cell / 2;
                var t = (d.value - data.minValue) / range;
                p.fill(colorRamp(p, t));
                p.noStroke();
                p.ellipse(x, y, cell * 0.82, cell * 0.82);

                p.fill(25);
                p.textFont('Arial');
                p.textStyle(p.NORMAL);
                p.textSize(8);
                p.textAlign(p.CENTER, p.CENTER);
                p.text(d.zip.slice(2), x, y);
            });

            p.fill(35);
            p.textFont('Arial');
            p.textStyle(p.NORMAL);
            p.textSize(12);
            p.textAlign(p.CENTER, p.TOP);
            var caption = data.isFallback
                ? 'Philadelphia ZIP codes, example housing-price scale'
                : 'Philadelphia ZIP codes, 2BR SAFMR, ' + data.year;
            p.text(caption, cx, mapTop + mapH + 10);

            this.drawLegend(p, left, top, w, h, data.minValue, data.maxValue);
            p.pop();
        },

        drawLegend: function (p, left, top, w, h, minValue, maxValue) {
            var legendW = Math.min(240, w * 0.48);
            var legendX = left + 18;
            var legendY = top + h + 42;
            var steps = 80;

            p.noStroke();
            for (var i = 0; i < steps; i++) {
                var t = i / (steps - 1);
                p.fill(colorRamp(p, t));
                p.rect(legendX + t * legendW, legendY, legendW / steps + 1, 10);
            }

            p.fill(28);
            p.textFont('Times New Roman');
            p.textStyle(p.BOLD);
            p.textSize(13);
            p.textAlign(p.LEFT, p.BOTTOM);
            p.text('Rent price', legendX, legendY - 4);

            p.textFont('Arial');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.textAlign(p.LEFT, p.TOP);
            p.text(minValue ? '$' + Math.round(minValue).toLocaleString() : 'Low', legendX, legendY + 14);
            p.textAlign(p.RIGHT, p.TOP);
            p.text(maxValue ? '$' + Math.round(maxValue).toLocaleString() : 'High', legendX + legendW, legendY + 14);
        }
    };
})();
