Playfield.register_experiment('DFT', function (_module) {

const tau = 2*Math.PI;

let plot = null;

/*
struct Complex {
    var Number re;
    var Number im;
};
*/

// DFT(g)[n] = sum k 0..N-1 g[k]e^(-2pi i kn/N)
// freq = n/T, sampleRate = N/T n/N = freq/sampleRate
// n : [0, N-1], freq/sampleRate : [0, 1], freq : [0, sampleRate]
function DiscreteFourierTransform(buf, sampleRate, freq) {
    let result, tmp;
    let i;
    let t;
    let f = freq/sampleRate;
    result = {re: 0, im: 0};
    for (i = 0; i < buf.length; i++) {
        t = i / buf.length;
        tmp = {
            re: buf[i] * Math.cos(tau*i*f),
            im:-buf[i] * Math.sin(tau*i*f)
        };
        result.re += tmp.re;
        result.im += tmp.im;
    }
    return result;
}

function PerformDFT(buf, sampleRate) {
    let out_r = new Float32Array(buf.length);
    let out_i = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
        let tmp = DiscreteFourierTransform(buf, sampleRate, i / buf.length * sampleRate);
        out_r[i] = tmp.re;
        out_i[i] = tmp.im;
    }
    return {re: out_r, im: out_i};
}

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
 * @param {Subarray} buf Given source buffer
 * @param {Subarray} out Output buffer
 */
function FFT(buf, out) {
    if (buf.size !== out.size)
        throw Error('Somethin\'s gon\' wrong >:[');
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

/*
class Subarray:
    arr
    start
    stride
    N

out = FFT (x=Subarray(inp, 0, 1, N))
=[if N=1] x
=[else]
Subarray(out, 0, 1, N/2) = FFT(Subarray(x, 0, 2, N/2))
Subarray(out, N/2, 1, N/2) = FFT(Subarray(x, 1, 2, N/2))
for ... end

*/

/** @summary Computes FFT of a given chunk
 * @param {Float32Array} buf Target buffer
 * @param {number} offset Offset of the buffer (in samples)
 * @param {number} size Number of samples to processs
 * @returns {Float32Array} The FFT of `buf`
 */
function PerformFFT(buf, offset, size) {
    // Is size a power of 2?
    if (((size - 1) & size) !== 0)
        throw new RangeError('size must be a power of 2!');
    let out = new Float32Array(2*size);
    FFT(new CSubarray(buf.subarray(2*offset), 0, 1, size), new CSubarray(out, 0, 1, size));
    // Scale the output
    let s = 1 / Math.sqrt(size);
    for (let i = 0; i < 2*size; i++) {
        out[i] *= s;
    }
    return out;
}

/** @summary Slides the DFT by 1 sample
 * @param {Float32Array} buf DFT buffer
 * @param {Float32Array} signal Original signal
 * @param {Float32Array} etab @see init/generateCoefTable
 * @param {number} t Current sample (before slide)
 */
function DFTDoSlide(buf, signal, etab, t) {
    const N = Math.floor(buf.length/2);
    let s = 1 / Math.sqrt(buf.length/2);
    for (let i = 0; i < N; i++) {
        const prev = _cmp_buf(buf, i);
        const coef = _cmp_buf(etab, i);
        // Formula: X(k) = etab[k] * (Xprev(k) + x(t + N) - x(t))
        let sample = _cmp_mul(coef, _cmp_add(prev, _cmp_scale(_cmp_sub(_cmp_buf(signal, t + N), _cmp_buf(signal, t)), s)));
        buf[2*i+0] = sample.re;
        buf[2*i+1] = sample.im;
    }
}

function ConvertRealToComplexBuffer(buf) {
    let out = new Float32Array(2*buf.length);
    for (let i = 0; i < buf.length; i++) {
        out[2*i] = buf[i];
        out[2*i+1] = 0;
    }
    return out;
}

function ConvertComplex2Polar(buf) {
    const l = Math.floor(buf.length/2);
    let out = new Float32Array(2*l);
    for (let n = 0; n < l; n++) {
        let r = buf[2*n+0], i = buf[2*n+1];
        out[2*n+0] = Math.sqrt(r*r + i*i);
        out[2*n+1] = Math.atan2(i, r);
    }
    return out;
}

function saw(t) {
    let v = (t + .5) % 1.0;
    return 2 * (v - .5);
}

function square(t) {
    return (t % 1.0) >= .5 ? 1 : 0;
}

function onDraw(t, d) {
    const {cnv, ctx} = plot;
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, cnv.height/2);
    ctx.lineTo(cnv.width, cnv.height/2);
    ctx.stroke();

    plot.PlotBuffer(d.buffer, {color: d.legend.colors[d.sig_clr], start: 2*t, incr: 2, size: d.window});
    //let dft = PerformDFT(d.buffer, 200);
    //let fft = PerformFFT(d.buffer, t, 100)
    // Plot spectograph BUT omit latter half, as it's XY mirror image of first half
    //PlotBuffer(d.dft, {color: d.legend.colors[d.ftr_clr], start: 0, incr: 2, size: d.window/2})
    //PlotBuffer(d.dft, {color: d.legend.colors[d.fti_clr], start: 1, incr: 2, size: d.window/2});
    let polar = ConvertComplex2Polar(d.dft);
    plot.PlotBuffer(polar, {color: d.legend.colors[d.fta_clr], start: 0, incr: 2, size: d.window/2})
    plot.PlotBuffer(polar, {color: d.legend.colors[d.ftp_clr], start: 1, incr: 2, size: d.window/2});
    plot.DrawLegend(d.legend, {x: 100, y: 15});

    for (let i = 0; i < d.speed; i++)
        DFTDoSlide(d.dft, d.buffer, d.etab, t++);
}

function init() {
    plot = new Plotter(_module.canvas);
    const d = Object.create(null);
    /** Sample rate */
    d.sr = 1000;
    /** Number of samples */
    d.size = 5*d.sr;
    /** Sliding speed samples/frame */
    d.speed = Math.floor(1);
    /** Original buffer */
    d.buffer = new Float32Array(2 * d.size);
    let theta = 0;
    for (let i = 0; i < d.size; i++) {
        /** sample = (Amax - slope(0, 5, 5000samples, t))(saw(1/200samples, t)) + 0i */
        d.buffer[2*i] =
            (5 - i/1000) *
            saw(i*8/200);
            //square(i*8/200);
            //Math.cos(tau*i*8/200);
            //Math.sin(theta);
            //Math.random();
            //1;
        d.buffer[2*i+1] = 0;
        theta += tau * i/20000;
    }
    const legend = plot.CreateLegend();
    const sig_clr = plot.RegisterLegendLabel(legend, "Signal", '#13CC55');
    //const ftr_clr = plot.RegisterLegendLabel(legend, "Fourier Transform real", '#DD0122');
    //const fti_clr = plot.RegisterLegendLabel(legend, "Fourier Transform imaginary", '#004499');
    const fta_clr = plot.RegisterLegendLabel(legend, "Fourier Transform amplitude", '#DD0122');
    const ftp_clr = plot.RegisterLegendLabel(legend, "Fourier Transform phase", '#004499');
    d.legend = legend;
    d.sig_clr = sig_clr;
    //d.ftr_clr = ftr_clr;
    //d.fti_clr = fti_clr;
    d.fta_clr = fta_clr;
    d.ftp_clr = ftp_clr;
    /** Window for preview */
    d.window = 512;
    /** e^i 2pi k/N coefficient table (used for sliding) */
    d.etab = function generateCoefTable(N) {
        // [e^i 2pi 0/N, e^i tau 1/N, ...]
        const tab = new Float32Array(2*N);
        for (let i = 0; i < N; ++i) {
            let v = _exp_i(tau*i/N);
            tab[2*i+0] = v.re;
            tab[2*i+1] = v.im;
        }
        return tab;
    }(d.window);
    d.dft = PerformFFT(d.buffer, 0, d.window);
    let t = 0;
    let f = () => {
        if (t >= d.size - d.window) {
            _module.render = null;
            return;
        }
        onDraw(t, d);
        t += d.speed;
    }
    _module.render = f;
}

/** @summary Unused main function (needs tweaks to work) */

/*
function Main() {
    plot = new Plotter(_module.canvas);
    const {cnv, ctx} = plot;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, cnv.height/2);
    ctx.lineTo(cnv.width, cnv.height/2);
    ctx.stroke();
    //plot.PlotFunction(x => 20 * x - 10);
    ctx.strokeStyle = '#00CC00';
    plot.PlotFunction(x => {
        const f = 3;
        return 5*Math.sin(tau*f*x);
    });

    const legend = CreateLegend();
    const sig_clr = RegisterLegendLabel(legend, "Signal", '#13CC55');
    const ftr_clr = RegisterLegendLabel(legend, "Fourier Transform real", '#DD0122');
    const fti_clr = RegisterLegendLabel(legend, "Fourier Transform imaginary", '#004499');
    DrawLegend(legend, {x: 100, y: 15});

    let buf = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) {
        //buf[i] = Math.cos(tau*3*(i/200));
        buf[i] = 5*saw(i/200, 3);
        //buf[i] = i == 0 ? 5 : 5*(Math.sin(tau*3*(i/200)) / (tau*3*(i/200)));
    }
    PlotBuffer(buf, {color: legend.colors[sig_clr]});
    let dft = PerformDFT(buf, 200);
    let buf2 = PerformDFT(dft.re, 200);
    for (let i = 0; i < buf2.re.length; i++)
        buf2.re[i] /= buf2.re.length;
    for (let i = 0; i < buf2.im.length; i++)
        buf2.im[i] /= buf2.im.length;
    PlotFunction(x => {
        return DiscreteFourierTransform(buf, 200, x*200).re;
    }, {color: '#004499'});
    PlotBuffer(buf2.re, {color: legend.colors[ftr_clr]})
    PlotBuffer(buf2.im, {color: legend.colors[fti_clr]});
}
*/

_module.init = init;

});
