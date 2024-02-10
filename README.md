# Poseidon Merkle root computation with WebGPU

This repository contains code which computes the Poseidon Merkle root of a list
of BN254 scalar field elements using your GPU. The code is written in WGSL, a
shader programming language that works with WebGPU.

This implementation of the Poseidon hash targets the BN254 scalar field, with
the following parameters:

- Number of inputs: 2
- `t = 3`
- `n_rounds_f = 8`
- `n_rounds_p = 57`

The results from this implementation should match those of the circomlibjs
implementation on BN254.

## Credits

Much of the big integer and finite field code was adapted from 
[msm-webgpu](https://github.com/sampritipanda/msm-webgpu) by Sampriti Panda,
Adhyyan Sekhsaria, and Nalin Bhardwaj.

The structure of the Poseidon WGSL code was inspired by
[poseidon-ark](https://github.com/arnaucube/poseidon-ark) by arnaucube.

## Getting started

The following was tested with Chrome 115.

Clone this repository, navigate to the project directory, and run:

```bash
npm i && rm -rf .parcel-cache && npx parcel index.html
```

Navigate to the URL that appears and you should see something like the
following:

```
Computing the Poseidon Merkle root of 1024 leaves in the browser / WebGPU
CPU took 447 ms
GPU took 112 ms
```
