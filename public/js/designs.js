function randomDesign(tile = undefined, rot = undefined) {
    const design = [];

    tile = tile ?? THREE.MathUtils.randInt(0, 15);
    rot = rot ?? THREE.MathUtils.randInt(0, 7);

    for (let f = 0; f < 4; ++f) {
        for (let s = 0; s < 8; ++s) {
            design.push(tile*4+f, rot);
        }
    }
    return design;
}

function repeatDesign(design) {
    return [...design, ...design, ...design, ...design];
}

function boxDesign(top, side) {
    return repeatDesign([top, 0, top, 0, side, 0, side, 0, side, 0, side, 0, side, 0, side, 0]);
}

function animatedDesign(...frames) {
    const design = [];
    for (const [tile, rot] of frames) {
        for (let s = 0; s < 8; ++s) {
            design.push(tile, rot);
        }
    }
    return design;
}
