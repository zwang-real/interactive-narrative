// sketch_renderer.js

// Responsible for rendering the main visualization based on the current active index
(function () {
    window.Renderer = {

        setData: function (manager) {
            var self = this;

            manager.offsetX = (manager.margin && manager.margin.left) || 20;
            manager.offsetY = (manager.margin && manager.margin.top) || 0;

            function computeLayout(data) {
                manager.data = data;
            }

            var yelpDataRequest = fetch('data/yelp_filtered/yelp_restaurants_philadelphia_zips.json')
                .then(function (response) { return response.json(); })
                .catch(function () { return []; });
            var housingDataRequest = fetch('data/philadelphia_safmr_master.csv')
                .then(function (response) {
                    if (!response.ok) return '';
                    return response.text();
                })
                .catch(function () { return ''; });
            var housingGeoRequest = fetch('data/philadelphia_zctas.geojson')
                .then(function (response) {
                    if (!response.ok) return null;
                    return response.json();
                })
                .catch(function () { return null; });
            var yelpYearSummaryRequest = fetch('data/yelp_filtered/yelp_zip_year_summary.json')
                .then(function (response) {
                    if (!response.ok) return null;
                    return response.json();
                })
                .catch(function () { return null; });
            var survivalDataRequest = fetch('data/yelp_filtered/image3_survival_by_variable.json')
                .then(function (response) {
                    if (!response.ok) return null;
                    return response.json();
                })
                .catch(function () { return null; });

            return Promise.all([yelpDataRequest, housingDataRequest, housingGeoRequest, yelpYearSummaryRequest, survivalDataRequest])
                .then(function (results) {
                    var yelpData       = results[0];
                    var housingData    = results[1];
                    var housingGeo     = results[2];
                    var yelpYearSummary = results[3];
                    var survivalData   = results[4];
                    computeLayout(yelpData);
                    manager.yelpReviewData        = window.VizYelpReviews.prepareData(yelpData);
                    manager.housingMapData         = window.VizHousingMap.prepareData(housingData);
                    manager.housingGeoData         = window.VizHousingMap.prepareGeoData(housingGeo);
                    manager.yelpZipYearData        = window.VizZipCompare.prepareYelpData(yelpYearSummary);
                    manager.survivalDashboardData  = window.VizSurvivalDashboard.prepareData(survivalData);
                    return manager.data;
                })
                .catch(function () {
                    computeLayout([]);
                    manager.yelpReviewData        = window.VizYelpReviews.prepareData([]);
                    manager.housingMapData         = window.VizHousingMap.prepareData('');
                    manager.housingGeoData         = window.VizHousingMap.prepareGeoData(null);
                    manager.yelpZipYearData        = window.VizZipCompare.prepareYelpData(null);
                    manager.survivalDashboardData  = window.VizSurvivalDashboard.prepareData(null);
                    return manager.data;
                });
        },

        draw: function (p, manager, ai, progress) {
            if (ai === 0 || ai === 1) {
                window.VizTitle.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 2) {
                window.VizYelpReviews.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 3) {
                window.VizSurvivalDashboard.draw(p, manager);
                return;
            }

            if (ai === 4) {
                window.VizHousingMap.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 5) {
                window.VizZipCompare.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 6 || ai === 9) {
                window.VizProgressColor.draw(p, manager, ai, progress);
                return;
            }

            if (ai === 7) {
                window.VizBar.draw(p, manager, ai, progress);
                return;
            }
        }
    };
})();