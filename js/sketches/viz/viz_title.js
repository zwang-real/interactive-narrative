// viz_title.js
(function () {
    window.VizTitle = {
        draw: function (p, manager, ai, progress) {
            var cx = (manager.offsetX || 0) + (manager.width || 600) / 2;
            var cy = (manager.offsetY || 0) + (manager.height || 520) / 3;
            p.push();
            p.noStroke();
            p.fill(255);
            var w = 420;
            var h = 120;
            p.rect(cx - w / 2, cy - h / 2, w, h, 6);
            p.fill(0);
            p.textAlign(p.CENTER, p.CENTER);
            p.textFont('Spectral');
            p.textSize(48);
            p.text(ai === 0 ? 'IMT 561' : 'Final Project', cx, cy);
            p.pop();
        }
    };
})();
