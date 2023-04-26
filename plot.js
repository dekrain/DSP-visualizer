/** @summary A helper library for plotting graphs */

(function() {

function Plotter(canvas) {
    this.cnv = canvas;
    this.ctx = canvas.getContext('2d');
}

window.Plotter = Plotter;

Plotter.prototype.PlotFunction = function(func, opts) {
    const width = this.cnv.width;
    const height = this.cnv.height;
    if (opts === undefined)
        opts = Object.create(null);
    if ('color' in opts)
        this.ctx.strokeStyle = opts.color;
    this.ctx.beginPath();
    for (let i = 0; i < width; i++) {
        let v = func(i/width) / 20;
        let x = i;
        let y = height/2 - v * height/2;
        if (i == 0)
            this.ctx.moveTo(x, y);
        else
            this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
}

Plotter.prototype.PlotBuffer = function(buf, opts) {
    let s = 0, i = 1, l = buf.length, ss = 1;
    if (opts === undefined)
        opts = Object.create(null);
    if ('start' in opts)
        s = opts.start;
    if ('incr' in opts)
        i = opts.incr;
    if ('size' in opts)
        l = opts.size;
    if ('scale' in opts)
        ss = opts.scale;
    return this.PlotFunction(x => ss*buf[s + i * Math.floor(x*l)], opts);
}

Plotter.prototype.CreateLegend = function() {
    return {labels: [], colors: []};
}

Plotter.prototype.RegisterLegendLabel = function(legend, name, color) {
    legend.labels.push(name);
    const i = legend.colors.length;
    legend.colors.push(color);
    return i;
}

Plotter.prototype.DrawLegend = function(legend, pos) {
    let p = {x: pos.x, y: pos.y};
    const l = legend.labels;
    const c = legend.colors;
    this.ctx.font = "18px Arial";
    for (let i = 0; i < l.length; i++) {
        this.ctx.fillStyle = c[i];
        this.ctx.fillText(l[i], p.x, p.y);
        p.y += 20;
    }
}

})();
