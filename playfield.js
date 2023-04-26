/** @summary Library for managing multiple experiments on a playfield */

(function() {

const Playfield = window.Playfield = Object.create(null);

Playfield._loaded = false;
Playfield._canvas = null;
Playfield._tabs = null;
Playfield._pending_experiments = [];
Playfield._loaded_experiments = [];
Playfield._current_module = null;

Playfield.register_experiment = function(name, definition) {
    if (Playfield._loaded) {
        Playfield._load_experiment(name, definition);
    } else {
        Playfield._pending_experiments.push({name, definition});
    }
};

Playfield.register_handler = function(module, event, handler) {
    if (module._handlers.has(event))
        throw new Error('Handler already registered');
    module._handlers.set(event, handler);
    if (Playfield._current_module === module)
        module.canvas.addEventListener(event, handler);
};

Playfield.unregister_handler = function(module, event) {
    if (Playfield._current_module === module) {
        let handler = module._handlers.get(event);
        if (handler !== undefined)
            module.canvas.removeEventListener(event, handler);
    }
    if (!module._handlers.delete(event))
        console.error('Module', module, 'does not have event handler for: '+event);
}

Playfield._load_experiment = function(name, definition) {
    const module = Object.create(null);
    module.name = name;
    module._backbuffer = null; // For swapping canvas image
    module._handlers = new Map;
    module.canvas = Playfield._canvas;
    module.init = null;
    module.render = null;
    // Make a tab
    const tab = document.createElement('td');
    Playfield._tabs.firstChild.appendChild(tab);
    const button = document.createElement('button');
    tab.appendChild(button);
    button.textContent = module.name;
    button.addEventListener('click', function() {
        Playfield._switch_module(module);
    });
    module._tab = tab;
    // Execute the module definition
    definition.call(null, module);
    // Push the module
    Playfield._loaded_experiments.push(module);
};

Playfield._start = function() {
    // First module or null
    Playfield._current_module = Playfield._loaded_experiments[0] ?? null;

    if (Playfield._current_module === null) {
        const ctx = Playfield._canvas.getContext('2d');
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, Playfield._canvas.width, Playfield._canvas.height);
    }
    for (let m of Playfield._loaded_experiments) {
        if (m.init !== null)
            m.init();
    }
    Playfield._render(0);
};

Playfield._render = function(dt) {
    requestAnimationFrame(Playfield._render);

    if (Playfield._current_module === null)
        return;

    if (Playfield._current_module.render) {
        Playfield._current_module.render(dt);
    }
};

Playfield._switch_module = function(new_mod) {
    if (Playfield._current_module === new_mod)
        return;

    if (Playfield._current_module !== null) {
        // Save the current image of the canvas
        Playfield._current_module._backbuffer =
            Playfield._canvas.getContext('2d').getImageData(0, 0, Playfield._canvas.width, Playfield._canvas.height);
        for (let [event, handler] of Playfield._current_module._handlers.entries())
        Playfield._current_module.canvas.removeEventListener(event, handler);
    }
    Playfield._current_module = new_mod;
    if (new_mod._backbuffer !== null) {
        // Restore saved image
        Playfield._canvas.getContext('2d').putImageData(new_mod._backbuffer, 0, 0);
        new_mod._backbuffer = null;
    }
    for (let [event, handler] of new_mod._handlers.entries())
        new_mod.canvas.addEventListener(event, handler);
};


document.addEventListener('DOMContentLoaded', function() {
    // Prepare the environment
    Playfield._canvas = document.getElementById('PlayfieldCanvas');
    Playfield._tabs = document.getElementById('PlayfieldTabs');
    Playfield._tabs.appendChild(document.createElement('th'));
    Playfield._loaded = true;
    const cnv = /** @type {HTMLCanvasElement} */(Playfield._canvas);
    cnv.width = cnv.offsetWidth;
    cnv.height = cnv.offsetHeight;
    window.addEventListener('resize', function() {
        cnv.width = cnv.height = 1;
        cnv.width = cnv.offsetWidth;
        cnv.height = cnv.offsetHeight;
    });
    // Load all pending experiments
    while (Playfield._pending_experiments.length !== 0) {
        const pend = Playfield._pending_experiments.shift();
        Playfield._load_experiment(pend.name, pend.definition);
    }
    // Start the playfield
    Playfield._start();
});

})();
