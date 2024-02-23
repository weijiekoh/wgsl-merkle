@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = global_id.x * num_y_workgroups + global_id.y;

    var a: BigInt256 = leaves[id * 2u];
    var b: BigInt256 = leaves[id * 2u + 1u];

    output[id] = hash_2(a, b);
}
