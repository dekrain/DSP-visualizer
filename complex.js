// struct Complex {
//   re: Number
//   im: Number
// }

// struct ComplexBuffer {
//   [re] [im] [re] [im] ...
// }

function _cmp_add(u, v) {
    return {
        re: u.re + v.re,
        im: u.im + v.im
    };
}

function _cmp_sub(u, v) {
    return {
        re: u.re - v.re,
        im: u.im - v.im
    };
}

// (ur + i ui)(vr + i vi) = ur vr + i ur vi + i ui vr - ui vi = (ur vr - ui vi) + i (ur vi + ui vr)
function _cmp_mul(u, v) {
    return {
        re: u.re * v.re - u.im * v.im,
        im: u.re * v.im + u.im * v.re
    };
}

function _cmp_scale(z, s) {
    return {
        re: z.re * s,
        im: z.im * s
    };
}

// exp(i th) = cos th + i sin th
function _exp_i(th) {
    return {
        re: Math.cos(th),
        im: Math.sin(th)
    };
}

function _cmp_buf(buf, idx) {
    return {
        re: buf[2*idx],
        im: buf[2*idx+1]
    };
}
