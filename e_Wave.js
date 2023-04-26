Playfield.register_experiment('Wave', function(_module) {

const tau = 2*Math.PI;
const tau_4 = tau/4;

let ctx;

_module.init = function init() {
	ctx = Object.create(null);
	_module.experiment_context = ctx;
	ctx.geometry = [1024, 512];
	ctx.koeff = 0.1;
	// Displacement field. At boundary, u = 0
	ctx.ufield = new Float32Array(ctx.geometry[0] * ctx.geometry[1]);
	// Velocity field. At boundary, v = 0, implied by the above
	ctx.vfield = new Float32Array(ctx.geometry[0] * ctx.geometry[1]);
	ctx.pixels = new Uint8ClampedArray(ctx.geometry[0] * ctx.geometry[1] * 4);
	ctx.img = new ImageData(ctx.pixels, ctx.geometry[0], ctx.geometry[1]);
	// Make all pixels visible
	for (let i = 0; i !== ctx.geometry[0] * ctx.geometry[1]; ++i)
		ctx.pixels[(i << 2) | 3] = 0xFF;

	// Initial position: x-axis: sine wave of frequency 2; y-axis: sine wave of frequency 3
	for (let y = 0; y !== ctx.geometry[1]; ++y) {
		for (let x = 0; x !== ctx.geometry[0]; ++x) {
			ctx.ufield[y*ctx.geometry[0] + x] =
				Math.sin(tau * x / ctx.geometry[0] * 2) *
				Math.sin(tau * y / ctx.geometry[1] * 3) ;
		}
	}

	ctx.renderNeeded = true;
	ctx.simulationRunning = true;
};

function simulateStep() {
	/*
	ð²u/ðt² = c² * (ð²u/ðx² + ð²u/ðy²)
	Δv/Δt(x, y) = c² * (u(x + 1, y) + u(x - 1, y) - 2*u(x, y) + u(x, y + 1) + u(x, y - 1) - 2*u(x, y))
		= c² * (u(x + 1, y) + u(x - 1, y) + u(x, y + 1) + u(x, y - 1) - 4*u(x, y))
	Δu/Δt(x, y) = v(x, y)
	*/

	// Boundaries DON'T MATTER lol, except they do
	/*const bases = [
		0,						// Top left -> right
		ctx.geometry[0] - 1,	// Top right -> down
		(ctx.geometry[1] - 1) * ctx.geometry[0] + 1,	// Bottom right <- left
		ctx.geometry[0]			// Bottom left <- down
	];
	for (let dir = 0; dir !== 4; ++dir) {
		const max = ((dir & 1) ? ctx.geometry[1] : ctx.geometry[0]) - 1;
		const base = bases[dir];
		const dw = (dir & 1) ? ctx.geometry[0] : 1;
		for (let w = 0; w !== max; ++w) {
			const idx = base + dw*w;
			ctx.vfield[idx] += ctx.koeff * (
				dir === 
			);
		}
	}*/

	// Interior
	for (let y = 1; y !== ctx.geometry[1] - 1; ++y) {
		for (let x = 1; x !== ctx.geometry[0] - 1; ++x) {
			const idx = y * ctx.geometry[0] + x;
			ctx.vfield[idx] += ctx.koeff * (
				ctx.ufield[idx + 1] +
				ctx.ufield[idx - 1] +
				ctx.ufield[idx + ctx.geometry[0]] +
				ctx.ufield[idx - ctx.geometry[0]] -
				4 * ctx.ufield[idx]
			);
		}
	}

	// Apply velocity
	for (let y = 0; y !== ctx.geometry[1]; ++y) {
		for (let x = 0; x !== ctx.geometry[0]; ++x) {
			const idx = y * ctx.geometry[0] + x;
			ctx.ufield[idx] += ctx.vfield[idx];
		}
	}
}

_module.render = function render() {
	if (!ctx.renderNeeded)
		return;

	if (ctx.simulationRunning)
		simulateStep();

	const dctx = _module.canvas.getContext('2d');
	// Gradient: -1 --> red; 0 --> green; 1 --> blue
	for (let y = 0; y !== ctx.geometry[1]; ++y) {
		for (let x = 0; x !== ctx.geometry[0]; ++x) {
			const idx = (y * ctx.geometry[0] + x) << 2;
			const val = ctx.ufield[y * ctx.geometry[0] + x];
			ctx.pixels[idx + 0] = -val * 0xFF;
			ctx.pixels[idx + 1] = Math.cos(tau_4 * val) * 0xFF;
			ctx.pixels[idx + 2] = val * 0xFF;
		}
	}
	dctx.clearRect(0, 0, _module.canvas.width, _module.canvas.height);
	dctx.putImageData(ctx.img, 0, 0);
};

});
