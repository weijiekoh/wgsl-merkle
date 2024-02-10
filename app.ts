const assert = require('assert');
const crypto = require('crypto');
// Parcel should inline the fs module. See https://github.com/parcel-bundler/parcel/issues/8256
import { readFileSync } from 'fs';
import * as constants from './poseidon_constants';
import buildPoseidon from './poseidon_reference'
import { utils } from 'ffjavascript'
import {
  get_device,
  create_sb,
  create_and_write_sb,
  create_and_write_ub,
  create_bind_group_layout,
  create_bind_group,
  create_compute_pipeline,
  execute_pipeline,
  read_from_gpu,
} from './gpu.ts'

import shader from 'bundle-text:./wgsl/structs.wgsl';
import structs from 'bundle-text:./wgsl/structs.wgsl';
import storage from 'bundle-text:./wgsl/storage.wgsl';
import bigint from 'bundle-text:./wgsl/bigint.wgsl';
import fr from 'bundle-text:./wgsl/fr.wgsl';
import poseidon_t3 from 'bundle-text:./wgsl/poseidon_t3.wgsl';
import main_shader from 'bundle-text:./wgsl/merkle.wgsl';
const shader = 
  structs + '\n' +
  storage + '\n' +
  bigint + '\n' +
  fr + '\n' +
  poseidon_t3 + '\n' +
  main_shader;

function compute_merkle_root(
  hasher: any,
  leaves: Bigint[],
) {
  if (leaves.length === 1) {
    return leaves[0]
  }

  const nodes = []
  for (let i = 0; i < leaves.length; i += 2) {
    const a = leaves[i]
    const b = leaves[i + 1]
    const h = hasher([a, b])
    const node = utils.leBuff2int(hasher.F.fromMontgomery(h))
    nodes.push(node)
  }

  return compute_merkle_root(hasher, nodes)
}

async function merkle() {
  const hasher = await buildPoseidon();

  const codeOutput = document.getElementById("output");

  const t = 3

  const num_inputs = 2 ** 10

  let leaves: BigInt[] = []
  let leaves_mont: BigInt[] = []

  const p = BigInt('0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001')
  const r = BigInt('0xe0a77c19a07df2f666ea36f7879462e36fc76959f60cd29ac96341c4ffffffb')
  const ri = BigInt('0x15ebf95182c5551cc8260de4aeb85d5d090ef5a9e111ec87dc5ba0056db1194e')

  for (let i = 0; i < num_inputs; i ++) {
    // Note: this will have modulo bias
    let rand = BigInt('0x' + crypto.randomBytes(32).toString('hex')) % p
    leaves.push(rand)
    leaves_mont.push((rand * r) % p)
  }

  let start = Date.now()
  const expected_root = compute_merkle_root(hasher, leaves)
  console.log('expected result:', expected_root.toString(16))
  let elapsed = Date.now() - start

  codeOutput.innerHTML = `Computing the Poseidon Merkle root of ${num_inputs} leaves in the browser / WebGPU<br />`
  codeOutput.innerHTML += "CPU took " + elapsed + " ms<br />"

  // Convert the C constants to Montgomery form
  const constants_c: BigInt[] = []
  for (const c_val of constants.default.C[t - 2]) {
    constants_c.push(BigInt(c_val) * r % p);
  }

  // Convert the M constants to Montgomery form
  const constants_m: BigInt[] = []
  for (const vs of constants.default.M[t - 2]) {
    for (const v of vs) {
      constants_m.push(BigInt(v) * r % p)
    }
  }

  const leaves_bytes = new Uint8Array(bigints_to_limbs(leaves_mont).buffer);
  const constants_c_bytes = new Uint8Array(bigints_to_limbs(constants_c).buffer);
  const constants_m_bytes = new Uint8Array(bigints_to_limbs(constants_m).buffer);

  const start_gpu = Date.now()
  const device = await get_device();
  const commandEncoder = device.createCommandEncoder()

  const leaves_sb = create_and_write_sb(device, leaves_bytes)
  const constants_c_sb = create_and_write_sb(device, constants_c_bytes)
  const constants_m_sb = create_and_write_sb(device, constants_m_bytes)
  const output_sb = create_sb(device, leaves_sb.size / 2)

  let n = num_inputs
  while (n > 1) {
    const n_bytes = new Uint8Array(bigint_to_limbs(BigInt(n)).buffer)
    const n_ub = create_and_write_ub(device, n_bytes)
    await invoke_shader(
      n,
      device,
      commandEncoder,
      leaves_sb,
      constants_c_sb,
      constants_m_sb,
      n_ub,
      output_sb,
    )
    n = Math.floor(n / 2)
  }

  const data = await read_from_gpu(device, commandEncoder, [output_sb])
  const elapsed_gpu = Date.now() - start_gpu
  codeOutput.innerHTML += "GPU took " + elapsed_gpu + " ms"

  device.destroy()
  const output_as_mont = u8s_to_bigints(data[0])
  const output = output_as_mont.map((x) => x * ri % p)

  console.log('result from GPU:', output[0].toString(16))
}

async function invoke_shader(
  n: number,
  device: GPUDevice,
  commandEncoder: GPUCommandEncoder,
  leaves_sb: GPUBufer,
  constants_c_sb: GPUBufer,
  constants_m_sb: GPUBufer,
  n_ub: GPUBufer,
  output_sb: GPUBufer
) {

  const bindGroupLayout = create_bind_group_layout(device, [
    'read-only-storage',
    'read-only-storage',
    'read-only-storage',
    'storage',
    'uniform',
  ])

  const bindGroup = create_bind_group(device, bindGroupLayout, [
    leaves_sb,
    constants_c_sb,
    constants_m_sb,
    output_sb,
    n_ub,
  ])

  const computePipeline = await create_compute_pipeline(
    device,
    [bindGroupLayout],
    shader,
    "main",
  )

  execute_pipeline(
    commandEncoder,
    computePipeline,
    bindGroup,
    n / 2,
  )

  const size = (n / 2) * 16 * 4
  commandEncoder.copyBufferToBuffer(output_sb, 0, leaves_sb, 0, size);
}


// From msm-webgpu
const uint32ArrayToBigint = (arr: any) => {
  // Convert the Uint16Array to a hex string
  let hexString = '';
  for (const uint32 of arr) {
    hexString = uint32.toString(16).padStart(4, '0') + hexString;
  }

  // Convert the hex string to a BigInt
  return BigInt('0x' + hexString);
}
export const u8s_to_bigints = (
  u8s: Uint8Array,
  num_words = 16,
  word_size = 16,
): bigint[] => {
  const num_u8s_per_scalar = num_words * 4;
  const result = [];
  for (let i = 0; i < u8s.length / num_u8s_per_scalar; i++) {
    const p = i * num_u8s_per_scalar;
    const s = u8s.slice(p, p + num_u8s_per_scalar);
    result.push(u8s_to_bigint(s, num_words, word_size));
  }
  return result;
};

export const u8s_to_bigint = (
  u8s: Uint8Array,
  num_words = 16,
  word_size = 16,
): bigint => {
  const a = new Uint16Array(u8s.buffer);
  const limbs: number[] = [];
  for (let i = 0; i < a.length; i += 2) {
    limbs.push(a[i]);
  }

  return from_words_le(new Uint16Array(limbs), num_words, word_size);
};

const from_words_le = (words: Uint8Array, num_words: number, word_size: number): BigInt[] => {
  let val = BigInt(0);
  for (let i = 0; i < num_words; i++) {
    assert(words[i] < 2 ** word_size);
    assert(words[i] >= 0);
    val +=
      BigInt(2) ** BigInt((num_words - i - 1) * word_size) *
      BigInt(words[num_words - 1 - i]);
  }

  return val;
}

const bigint_to_limbs = (val: BigInt): Uint32Array => {
  // From msm-webgpu
  // Convert the BigInt to a hex string
  const hexString = val.toString(16);

  // Pad the hex string with leading zeros, if necessary
  const paddedHexString = hexString.padStart(64, '0');

  // Split the padded hex string into an array of 16-bit values
  const uint32Array = new Uint32Array(paddedHexString.length / 4);
  for (let i = 0; i < paddedHexString.length; i += 4) {
    uint32Array[i / 4] = parseInt(paddedHexString.slice(i, i + 4), 16);
  }

  return uint32Array.reverse();
}

const bigints_to_limbs = (vals: BigInt[]): Uint32Array => {
  const result = new Uint32Array(vals.length * 16);

  for (let i = 0; i < vals.length; i ++ ) {
    const limbs = bigint_to_limbs(vals[i]);
    for (let j = 0; j < limbs.length; j ++ ) {
      result[i * 16 + j] = limbs[j];
    }
  }
  return result;
}

const main = async () => {
  await merkle();
}

main()
