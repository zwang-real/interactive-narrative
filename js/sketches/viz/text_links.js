// Wire clickable numbers in the article prose to the interactive visualizations.
// A span with data-var switches the survival dashboard to that variable; a span
// with data-row flashes that row of the report card. The spans live in the left
// prose column; the visualizations read the request through their public API.
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    // Dashboard: a clicked number switches the active variable.
    document.querySelectorAll('.data-link[data-var]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (window.VizSurvivalDashboard && window.VizSurvivalDashboard.setVariable) {
          window.VizSurvivalDashboard.setVariable(el.getAttribute('data-var'));
        }
      });
    });

    // Report card: a clicked number flashes the matching row.
    document.querySelectorAll('.data-link[data-row]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (window.VizReportCard && window.VizReportCard.flashRow) {
          window.VizReportCard.flashRow(parseInt(el.getAttribute('data-row'), 10));
        }
      });
    });
  });
})();