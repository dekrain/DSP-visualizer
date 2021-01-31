Playfield.register_experiment('LPF', function (_module) {

const tau = 2*Math.PI;

let plot = null;

function ActualLowPassFilter(buf, sampleRate, cutoff, amp) {
    let i = 1;
    let out = new Float32Array(buf.length);
    let a = 1 / (sampleRate / (tau * cutoff) + 1);
    let x = a * buf[0];
    while (i < buf.length) {
        x += (buf[i] - x) * a;
        out[i++] = x;
    }
    return out;
}

function TestLowPassFilter(buf, sampleRate, cutoff, amp) {
    let v = 0, x = buf[0];
    let i = 1;
    let out = new Float32Array(buf.length);
    let a = 50 //1 / (sampleRate / (tau * cutoff) + 1);
    let dt = 1 / sampleRate;
    while (i < buf.length) {
        //let t = i / sampleRate;
        //let tmp1 = tau * amp * cutoff * Math.cos(tau * cutoff * t);
        //let tmp2 = buf[i] - v;
        /*if (tmp1 < 0) {
            tmp1 = -tmp1;
            tmp2 = -tmp2;
        }*/
        //v += tmp2 * a; //Math.min(tmp1, tmp2) / sampleRate;
        let e = buf[i] - x;
        v += e * a * dt;
        x += v * dt;
        out[i++] = x;
    }
    return out;
}

function saw(t, freq) {
    let v = (t*freq + .5) % 1.0;
    return 2 * (v - .5);
}

function Main() {
    plot = new Plotter(_module.canvas);
    const {cnv, ctx} = plot;
    const signal = new Float32Array(1000);
    const freq = 3; // Hz
    for (let i = 0; i < 1000; i++) {
        //signal[i] = 5*saw(i/200, freq);
        //signal[i] = 5*Math.sin(tau*freq*i/200);
        signal[i] = i == 0 ? 100 : 0;
    }
    _module.render = function() {
        _module.render = null;
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        ctx.strokeStyle = '#FF0000';
        plot.PlotBuffer(signal);
        const cutoff = 3;
        const amp = 3;
        ctx.strokeStyle = '#00FF22';
        plot.PlotBuffer(ActualLowPassFilter(signal, 200, cutoff, amp));
    };
}

_module.init = Main;

});
