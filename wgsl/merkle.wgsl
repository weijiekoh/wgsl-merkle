@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = global_id.x * num_y_workgroups + global_id.y;

    // TODO for the d/Infra workshop: fill in the blanks.
    var a: BigInt256 = ???;
    var b: BigInt256 = ???;

    output[id] = ???;
}
