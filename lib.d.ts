/** @file "plot.js" */

class Plotter {
	cnv: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor(canvas: HTMLCanvasElement);

	PlotFunction(func: (x: number) => number, opts: object);
	PlotBuffer(buf: ArrayLike<number>, opts: object);
	CreateLegend(): Legend;
	RegisterLegendLabel(legend: Legend, name: string, color: string): number;
	DrawLegend(legend: Legend, pos: {x: number, y: number});
}

interface Legend {
	labels: string[];
	colors: string[];
}

/** @file "playfield.js" */

interface PlayfieldModule {
	name: string;
	canvas: HTMLCanvasElement;
	init?();
	render?(dt: number);
}

interface Playfield {
	register_experiment(name: string, definition: (module: PlayfieldModule) => void);
	register_handler<K extends keyof HTMLElementEventMap>(module: PlayfieldModule, event: K, handler: (ev: HTMLElementEventMap[K]) => void);
	// This does not throw on missing event handler but logs the error on console.
	unregister_handler(module: PlayfieldModule, event: string);
}

declare var Playfield: Playfield;

/** @file "complex.js" */
interface Complex {
	re: number;
	im: number;
}

function _cmp_add(u: Complex, v: Complex): Complex;
function _cmp_sub(u: Complex, v: Complex): Complex;
function _cmp_mul(u: Complex, v: Complex): Complex;
function _cmp_scale(z: Complex, s: number): Complex;
function _exp_i(th: number): Complex;
function _cmp_buf(buf: ArrayLike<number>, idx: number): Complex;

class CSubarray {
	constructor(buf: ArrayLike<number>, start: number, stride: number, size: number);

	get(i: number): Complex;
	set(i: number, v: Complex);
	sub(offset: number, stride: number, size: number): CSubarray;
}

function FFT(src: CSubarray, dst: CSubarray);
function PerformFFT(buf: ArrayLike<number>, offset: number, size: number): Float32Array;
function ConvertComplex2Polar(buf: ArrayLike<number>): Float32Array;
