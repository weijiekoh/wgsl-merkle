@group(0) @binding(0)
var<storage, read> leaves: array<BigInt256>;
@group(0) @binding(1)
var<storage, read> constants_c: array<BigInt256>;
@group(0) @binding(2)
var<storage, read> constants_m: array<BigInt256>;
@group(0) @binding(3)
var<storage, read_write> output: array<BigInt256>;
@group(0) @binding(4)
var<uniform> n: u32;
@group(0) @binding(5)
var<uniform> num_y_workgroups: u32;
