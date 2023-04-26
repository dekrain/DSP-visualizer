Playfield.register_experiment('EQ', function(_module) {

const tau = 2*Math.PI;

/** @typedef {number} FilterType */

const NODE_LPF = 0;
const NODE_HPF = 1;

/** @typedef {{ type: FilterType, cutoff: number, order: number, color?: Color, color_dim?: Color, color_light?: Color }} ParametricNode */

/** @type {Plotter} */
let plot;
/** @type {{ samres: number, nodes: ParametricNode[], legend: Legend }} */
let ctx;

function Color(r, g, b) {
    if (new.target == null)
        throw new Error('Color is a constructor');

    this.r = r;
    this.g = g;
    this.b = b;
}

Color.Random = function RandomColor() {
    return new Color(
        Math.floor(Math.random()*255),
        Math.floor(Math.random()*255),
        Math.floor(Math.random()*255));
};

Color.prototype.Dim = function DimColor() {
    let r = this.r;
    let g = this.g;
    let b = this.b;

    r = Math.floor(r*0.8);
    g = Math.floor(g*0.6);
    b = Math.floor(b*0.8);
    return new Color(r, g, b);
};

Color.prototype.Lighten = function DimColor() {
    let r = this.r;
    let g = this.g;
    let b = this.b;

    r = Math.min(Math.floor(r*1.2), 0xFF);
    g = Math.min(Math.floor(g*1.5), 0xFF);
    b = Math.min(Math.floor(b*1.2), 0xFF);
    return new Color(r, g, b);
};

Color.prototype.toString = function() {
    const r = this.r.toString(16).padStart(2, '0');
    const g = this.g.toString(16).padStart(2, '0');
    const b = this.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
};


// Complex Float32Buffer subarray wrapper
function CSubarray(buf, start, stride, size) {
    this.buf = buf;
    this.start = start;
    this.stride = stride;
    this.size = size;
}

CSubarray.prototype.get = function(i) {
    return _cmp_buf(this.buf, this.start + i*this.stride);
};

CSubarray.prototype.set = function(i, v) {
    this.buf[2*(this.start + i*this.stride)+0] = v.re;
    this.buf[2*(this.start + i*this.stride)+1] = v.im;
};

CSubarray.prototype.sub = function(offset, stride, size) {
    return new CSubarray(this.buf, this.start + offset*this.stride, this.stride*stride, size);
};

/** @summary One chunk of FFT: computes FFT of a subarray; Implements Cooley-Turkey algorithm.
 * @param {CSubarray} buf Given source buffer
 * @param {CSubarray} out Output buffer
 */
function FFT(buf, out) {
    if (buf.size !== out.size)
        throw new Error("Somethin's gon' wrong >:[");
    const N = out.size;
    if (N === 1) {
        // out[0] := buf[0]
        out.set(0, buf.get(0));
    } else {
        const n = N/2;
        FFT(buf.sub(0, 2, n), out.sub(0, 1, n));
        FFT(buf.sub(1, 2, n), out.sub(n, 1, n));
        for (let k = 0; k < n; k++) {
            // t := out[idx + k*s]
            let t = out.get(k);
            // c := expi(-tau k/N) * out[idx + (k+n)*s]
            let c = _cmp_mul(_exp_i(-tau*k/N), out.get(k+n));
            // out[idx + k*s] := t + exp(-i tau*k/N) * out[idx + (k+n)*s] = t + c;
            out.set(k, _cmp_add(t, c));
            // out[idx + (k+n)*s] := t - exp(-i tau*k/N) * out[idx + (k+n)*s] = t - c;
            out.set(k+n, _cmp_sub(t, c));
        }
    }
}

/** @summary Computes FFT of a given chunk
 * @param {Float32Array} buf Target buffer
 * @param {number} offset Offset of the buffer (in samples)
 * @param {number} size Number of samples to processs
 * @returns {Float32Array} The FFT of `buf`
 */
function PerformFFT(buf, offset, size) {
    // Is size a power of 2?
    if (((size - 1) & size) !== 0)
        throw new RangeError('Size must be a power of 2!');
    let out = new Float32Array(2*size);
    FFT(new CSubarray(buf.subarray(2*offset), 0, 1, size), new CSubarray(out, 0, 1, size));
    // Scale the output
    let s = 1 / Math.sqrt(size);
    for (let i = 0; i < 2*size; i++) {
        out[i] *= s;
    }
    return out;
}

function ConvertComplex2Polar(buf) {
    const l = Math.floor(buf.length/2);
    let out = new Float32Array(2*l);
    for (let n = 0; n < l; n++) {
        let r = buf[2*n+0], i = buf[2*n+1];
        let mag = out[2*n+0] = Math.sqrt(r*r + i*i);
        if (mag < Number.EPSILON)
            out[2*n+1] = 0;
        else
            out[2*n+1] = Math.atan2(i, r);
    }
    return out;
}

function sinc(x) {
    return x === 0 ? 1 : Math.sin(x) / x;
}

/*
F{LPF} ~= rect(s, cutoff)
F{HPF} ~= s - rect(s, cutoff) = s - F{LPF}
T{HPF} = l*ð - T{LPF}
*/

function ComputeFilter(node) {
    if (node.type !== NODE_LPF && node.type !== NODE_HPF)
        throw new Error('Unknown filter type');

    const buffer = new Float32Array(2*ctx.samres);
    // Use rectangular window
    switch (node.type) {
        case NODE_LPF:
        buffer[0] = node.cutoff / ctx.samres;
        for (let i = 1; i < node.order; ++i) {
            buffer[2*(ctx.samres - i)] =
            buffer[2*i] = Math.sin(i*Math.PI*node.cutoff/ctx.samres) / (i*Math.PI);
        }
        break;

        case NODE_HPF:
        buffer[0] = 1-node.cutoff / ctx.samres;
        for (let i = 1; i < node.order; ++i) {
            buffer[2*(ctx.samres - i)] =
            buffer[2*i] = -Math.sin(i*Math.PI*node.cutoff/ctx.samres) / (i*Math.PI);
        }
        break;
    }
    /*for (let i = node.order; i <= ctx.samres - node.order; ++i)
        buffer[2*i] = 1;*/
    return buffer;
}

function ConvolveFilters(nodes) {
    /** @todo */
}

function ComputeFunctions() {
    ctx.impres = ComputeFilter(ctx.nodes[0]);
    ctx.impres_polar = ConvertComplex2Polar(ctx.impres);
    ctx.trans = PerformFFT(ctx.impres, 0, ctx.samres);
    ctx.trans_polar = ConvertComplex2Polar(ctx.trans);

    let peak = 0;
    for (let idx = 0; idx < ctx.samres/2; ++idx) {
        const sam = ctx.trans_polar[2*idx];
        if (sam > peak)
            peak = sam;
    }
    ctx.trans_peak = peak;
    //console.log(ctx.trans_polar);
}

_module.init = function init() {
    plot = new Plotter(_module.canvas);
    ctx = {
        samres: 1024, // Sample resolution
        nodes: [],
        legend: plot.CreateLegend(),
        mouse: { target: null, dragging: false },
    };

    ctx.nodes.push({
        type: NODE_LPF,
        cutoff: 700,
        order: 200,
    });

    ctx.color = plot.RegisterLegendLabel(ctx.legend, 'Transform function', '#02E028');
    ctx.impcolor = plot.RegisterLegendLabel(ctx.legend, 'Impulse response', '#10D0FF');
    ctx.phcolor = plot.RegisterLegendLabel(ctx.legend, 'Transform phase shift', '#D050C0');

    ComputeFunctions();

    Playfield.register_handler(_module, 'mousedown', ev => {
        if (Math.abs(ev.offsetY - _module.canvas.height + 80) < 20) {
            ev.preventDefault();
            let idx = Math.floor((ev.offsetX - 5) / 40);
            if (idx >= 0 && idx < ctx.nodes.length) {
                ctx.nodes[idx].type = 1 - ctx.nodes[idx].type;
                ComputeFunctions();
            }
            return;
        }
        if (ctx.mouse.target === null)
            return;

        ctx.mouse.dragging = true;
    });

    Playfield.register_handler(_module, 'mousemove', ev => {
        const cutoff = ev.offsetX / _module.canvas.width * ctx.samres;

        if (ctx.mouse.dragging) {
            if (ctx.mouse.target)
                ctx.mouse.target.cutoff = cutoff;
        } else {
            let target = null;

            if (Math.abs(ev.offsetY - _module.canvas.height * 0.35) <= 15) {
                for (let handle of ctx.nodes) {
                    if (Math.abs(handle.cutoff - cutoff) > 50)
                        continue;

                    if (target === null || Math.abs(handle.cutoff - cutoff) < Math.abs(target.cutoff - cutoff))
                        target = handle;
                }
            }

            ctx.mouse.target = target;
        }
    });

    Playfield.register_handler(_module, 'mouseup', ev => {
        if (!ctx.mouse.dragging)
            return;

        ctx.mouse.dragging = false;
        ComputeFunctions();
    });
};

_module.render = function render() {
    const {cnv, ctx: dctx} = plot;
    dctx.clearRect(0, 0, cnv.width, cnv.height);
    dctx.strokeStyle = '#000000';
    dctx.beginPath();
    dctx.moveTo(0, cnv.height/2);
    dctx.lineTo(cnv.width, cnv.height/2);
    dctx.stroke();

    //plot.PlotBuffer(ctx.trans, {scale: 10*Math.sqrt(ctx.samres), color: ctx.legend.colors[ctx.color], start: 0, incr: 2, size: ctx.samres/2});
    plot.PlotBuffer(ctx.impres, {scale: 10, color: ctx.legend.colors[ctx.impcolor], start: 0, incr: 2, size: ctx.samres});
    plot.PlotBuffer(ctx.trans_polar, {scale: 10*Math.sqrt(ctx.samres), color: ctx.legend.colors[ctx.color], start: 0, incr: 2, size: ctx.samres/2});
    plot.PlotBuffer(ctx.trans_polar, {scale: 10/Math.PI, color: ctx.legend.colors[ctx.phcolor], start: 1, incr: 2, size: ctx.samres/2});
    plot.DrawLegend(ctx.legend, {x: 100, y: 15});

    dctx.fillStyle = '#000000';
    dctx.fillText(`Cutoff: ${ctx.nodes[0].cutoff}`, 550, 15);
    dctx.fillText(`Peak: ${ctx.trans_peak}`, 550, 35);

    const ctl = { x: 5, y: cnv.height - 100 };
    dctx.font = 'bold 17px sans-serif';

    for (const node of ctx.nodes) {
        if (node.color === undefined) {
            node.color = Color.Random();
            node.color_dim = node.color.Dim();
            node.color_light = node.color.Lighten();
        }

        dctx.fillStyle = node === ctx.mouse.target ? node.color : node.color_light;
        dctx.beginPath();
        dctx.arc(node.cutoff / ctx.samres * cnv.width, cnv.height * 0.35, 10, 0, 2*Math.PI);
        dctx.fill();
        dctx.fillStyle = node.color_dim;
        dctx.beginPath();
        dctx.arc(node.cutoff / ctx.samres * cnv.width, cnv.height * 0.35, 4, 0, 2*Math.PI);
        dctx.fill();

        dctx.fillStyle = dctx.strokeStyle = node.color;
        dctx.text
        switch (node.type) {
        case NODE_LPF:
            dctx.strokeRect(ctl.x, ctl.y, 38, 20);
            dctx.fillText('LPF', ctl.x+3, ctl.y+17, 40);
            ctl.x += 40;
            break;
        case NODE_HPF:
            dctx.strokeRect(ctl.x, ctl.y, 38, 20);
            dctx.fillText('HPF', ctl.x+3, ctl.y+17, 40);
            ctl.x += 40;
            break;
        }
    }
};

});
