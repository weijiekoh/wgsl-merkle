fn pow5(val: BigInt256) -> BigInt256 {
    var v = val;
    var r = cios_mon_pro(&v, &v);
    r = cios_mon_pro(&r, &r);
    r = cios_mon_pro(&v, &r);
    return r;
}


fn hash_2(a: BigInt256, b: BigInt256) -> BigInt256 {
    let t = 3u;
    let n_rounds_f = 8u;
    let n_rounds_p = 57u;

    var state: array<BigInt256, 3>;
    state[1] = a;
    state[2] = b;

    for (var i = 0u; i < n_rounds_f + n_rounds_p; i ++) {
        // Add round constants
        for (var j = 0u; j < t; j ++) {
            var s = state[j];
            var c = constants_c[i * t + j];
            state[j] = fr_add(&s, &c);
        }

        // S-Box
        if (i < n_rounds_f / 2u || i >= n_rounds_f / 2u + n_rounds_p) {
            for (var j = 0u; j < t; j ++) {
                state[j] = pow5(state[j]);
            }
        } else {
            state[0] = pow5(state[0]);
        }

        // Mix
        var zero: BigInt256;
        var new_state: array<BigInt256, 3>;
        for (var j = 0u; j < t; j ++) {
            new_state[j] = zero;
            for (var k = 0u; k < t; k ++) {
                var mij = constants_m[j * t + k];
                var s = state[k];
                mij = cios_mon_pro(&mij, &s);

                var n = new_state[j];
                new_state[j] = fr_add(&n, &mij);
            }
        }

        for (var j = 0u; j < t; j ++) {
            state[j] = new_state[j];
        }
    }

    return state[0];
}
