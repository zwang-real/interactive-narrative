// Yelp restaurant review-count vs rating scatter plot.
(function () {
    var MAGENTA_HEX = '#7e2954';
    var LIGHT_BLUE_HEX = '#94cbec';
    var POINT_OPACITY = 150;

    window.VizYelpReviews = {
        prepareData: function (rows) {
            rows = rows || [];
            var points = rows
                .map(function (d) {
                    return {
                        name: d.name || '',
                        rating: +d.stars || 0,
                        reviewCount: +d.review_count || 0,
                        isOpen: +d.is_open === 1
                    };
                })
                .filter(function (d) {
                    return d.rating > 0 && d.reviewCount > 0;
                });

            points.sort(function (a, b) { return b.reviewCount - a.reviewCount; });
            points = points.slice(0, 300);

            var totalRating = 0;
            var totalReviews = 0;
            points.forEach(function (d) {
                totalRating += d.rating;
                totalReviews += d.reviewCount;
            });

            return {
                points: points,
                meanRating: points.length ? totalRating / points.length : 0,
                meanReviews: points.length ? totalReviews / points.length : 0,
                maxReviews: points.length ? points[0].reviewCount : 1
            };
        },

        draw: function (p, manager) {
            var data = manager.yelpReviewData || this.prepareData([]);
            var points = data.points || [];
            var left = manager.offsetX || 80;
            var top = (manager.offsetY || 0) + 28;
            var w = (manager.width || 600) - 48;
            var h = (manager.height || 520) - 104;
            var right = left + w;
            var bottom = top + h;

            p.push();
            p.noStroke();
            p.fill(255);
            p.rect(left - 28, top - 24, w + 52, h + 84);

            p.textFont('Arial');
            p.textStyle(p.NORMAL);
            p.textSize(11);
            p.fill(82);
            p.textAlign(p.RIGHT, p.CENTER);
            for (var ratingTick = 1; ratingTick <= 5; ratingTick++) {
                var tickY = p.map(ratingTick, 1, 5, bottom, top);
                p.text(ratingTick.toFixed(1), left - 10, tickY);
            }

            p.textAlign(p.CENTER, p.TOP);
            var reviewTicks = [100, 1000, 5000];
            reviewTicks.forEach(function (tick) {
                if (tick > data.maxReviews) return;
                var tickX = p.map(Math.sqrt(tick), 0, Math.sqrt(data.maxReviews || 1), left, right);
                p.text(tick.toLocaleString(), tickX, bottom + 8);
            });

            var meanX = p.map(Math.sqrt(data.meanReviews || 0), 0, Math.sqrt(data.maxReviews || 1), left, right);
            var meanY = p.map(data.meanRating || 0, 1, 5, bottom, top);
            p.drawingContext.setLineDash([6, 6]);
            p.stroke(0);
            p.strokeWeight(1.6);
            p.line(meanX, top, meanX, bottom);
            p.line(left, meanY, right, meanY);
            p.strokeWeight(1);
            p.drawingContext.setLineDash([]);

            points.forEach(function (d) {
                var x = p.map(Math.sqrt(d.reviewCount), 0, Math.sqrt(data.maxReviews || 1), left, right);
                var y = p.map(d.rating, 1, 5, bottom, top);
                var size = p.map(Math.sqrt(d.reviewCount), 0, Math.sqrt(data.maxReviews || 1), 5, 30);
                if (d.isOpen) {
                    p.fill(p.color(LIGHT_BLUE_HEX + POINT_OPACITY.toString(16)));
                } else {
                    p.fill(p.color(MAGENTA_HEX + POINT_OPACITY.toString(16)));
                }
                p.noStroke();
                p.ellipse(x, y, size, size);
            });

            p.noStroke();
            p.fill(20);
            p.textFont('Times New Roman');
            p.textStyle(p.BOLD);
            p.textSize(16);
            p.textAlign(p.CENTER, p.TOP);
            p.text('review count', left + w / 2, bottom + 48);
            p.push();
            p.translate(left - 78, top + h / 2);
            p.rotate(-p.HALF_PI);
            p.text('rating', 0, 0);
            p.pop();

            p.textFont('Arial');
            p.textStyle(p.NORMAL);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(13);
            var legendX = right - 140;
            var legendY = top - 18;
            p.fill(MAGENTA_HEX);
            p.ellipse(legendX, legendY + 7, 12, 12);
            p.fill(28);
            p.text('Closed', legendX + 16, legendY);
            p.fill(LIGHT_BLUE_HEX);
            p.ellipse(legendX + 78, legendY + 7, 12, 12);
            p.fill(28);
            p.text('Open', legendX + 94, legendY);

            p.textAlign(p.LEFT, p.BOTTOM);
            p.textSize(13);
            p.textStyle(p.BOLD);
            p.fill(45);
            p.text('Mean rating', left + 8, meanY - 6);
            p.textAlign(p.CENTER, p.TOP);
            p.text('Mean review count', meanX, top + 6);
            p.textStyle(p.NORMAL);

            p.textAlign(p.RIGHT, p.BOTTOM);
            p.textSize(12);
            p.fill(70);
            p.text('Circle size = number of reviews', right, bottom - 6);

            p.pop();
        }
    };
})();
