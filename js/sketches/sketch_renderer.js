// sketch_renderer.js

// Responsible for rendering the main visualization based on the current active index
//
// Index map (keep in sync with index.html data-active-index):
//   0  Intro            full-text, no viz
//   1  Part 1 title     full-text, no viz
//   2  Image 1 Map      VizWhereTheyStand
//   3  Image 2 Heatmap  VizYelpHeatmap
//   4  Part 2 title     full-text, no viz
//   5  Image 3 Dashboard VizSurvivalDashboard
//   6  Image 4 Housing  VizHousingMap
//   7  Part 3 title     full-text, no viz
//   8  Image 5 Report   VizReportCard
//   9  Authors          full-text, no viz
(function () {
    window.Renderer = {

        setData: function (manager) {
            manager.offsetX = (manager.margin && manager.margin.left) || 20;
            manager.offsetY = (manager.margin && manager.margin.top) || 0;

            function computeLayout(data) { manager.data = data; }

            var yelpDataRequest = fetch('data/yelp_filtered/yelp_restaurants_philadelphia_zips.json')
                .then(function (r) { return r.json(); })
                .catch(function () { return []; });
            var housingDataRequest = fetch('data/philadelphia_safmr_master.csv')
                .then(function (r) { return r.ok ? r.text() : ''; })
                .catch(function () { return ''; });
            var housingGeoRequest = fetch('data/philadelphia_zctas.geojson')
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; });
            var yelpYearSummaryRequest = fetch('data/yelp_filtered/yelp_zip_year_summary.json')
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; });
            var yelpReviewsZipRequest = fetch('data/yelp_filtered/yelp_reviews_philadelphia_zips.zip')
                .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
                .catch(function () { return null; });
            var survivalDataRequest = fetch('data/yelp_filtered/image3_survival_by_variable.json')
                .then(function (r) { return r.ok ? r.json() : null; })
                .catch(function () { return null; });

            return Promise.all([yelpDataRequest, housingDataRequest, housingGeoRequest, yelpYearSummaryRequest, yelpReviewsZipRequest, survivalDataRequest])
                .then(function (results) {
                    var yelpData        = results[0];
                    var housingData     = results[1];
                    var housingGeo      = results[2];
                    var yelpYearSummary = results[3];
                    var yelpReviewsZip  = results[4];
                    var survivalData    = results[5];
                    computeLayout(yelpData);
                    manager.yelpReviewData        = window.VizYelpReviews.prepareData(yelpData);
                    manager.whereTheyStandData    = window.VizWhereTheyStand.prepareData(yelpData);
                    manager.housingMapData        = window.VizHousingMap.prepareData(housingData);
                    manager.housingGeoData        = window.VizHousingMap.prepareGeoData(housingGeo);
                    manager.yelpZipYearData       = window.VizZipCompare.prepareYelpData(yelpYearSummary);
                    manager.survivalDashboardData = window.VizSurvivalDashboard.prepareData(survivalData);
                    manager.yelpHeatmapData = window.VizYelpHeatmap.prepareData(yelpData);
                    if (window.VizYelpHeatmap.prepareYearData) {
                        return window.VizYelpHeatmap.prepareYearData(yelpData, yelpReviewsZip).then(function (yearData) {
                            manager.yelpHeatmapYearData = yearData;
                            return manager.data;
                        });
                    }
                    return manager.data;
                })
                .catch(function () {
                    computeLayout([]);
                    manager.yelpReviewData        = window.VizYelpReviews.prepareData([]);
                    manager.whereTheyStandData    = window.VizWhereTheyStand.prepareData([]);
                    manager.housingMapData        = window.VizHousingMap.prepareData('');
                    manager.housingGeoData        = window.VizHousingMap.prepareGeoData(null);
                    manager.yelpZipYearData       = window.VizZipCompare.prepareYelpData(null);
                    manager.survivalDashboardData = window.VizSurvivalDashboard.prepareData(null);
                    manager.yelpHeatmapData = window.VizYelpHeatmap.prepareData([]);
                    return manager.data;
                });
        },

        draw: function (p, manager, ai, progress) {
            // Image 1 — same restaurant survival map language as the opening.
            if (ai === 2) {
                window.VizWhereTheyStand.draw(p, manager, ai, progress);
                return;
            }
            // Image 2 — Heatmap: reviews vs ratings, open vs closed
            if (ai === 3) {
                window.VizYelpHeatmap.draw(p, manager);
                return;
            }
            // Image 3 — Survival dashboard (interactive)
            if (ai === 5) {
                window.VizSurvivalDashboard.draw(p, manager);
                return;
            }
            // Image 4 — Housing / rent map
            if (ai === 6) {
                window.VizZipCompare.draw(p, manager, ai, progress);
                return;
            }
            // Image 5 — The Report Card (Part 3, interactive)
            if (ai === 8) {
                window.VizReportCard.draw(p, manager, ai, progress);
                return;
            }
            // All other indices are full-text sections (Intro, Part titles,
            // Authors): draw nothing.
            // p.background(255) in the manager already cleared the canvas.
        }
    };
})();
