const DIRECTIONS_3D = {
    FORWARD:  Object.freeze(new THREE.Vector3( 0,  0,  1)),
    BACKWARD: Object.freeze(new THREE.Vector3( 0,  0, -1)),
    UP:       Object.freeze(new THREE.Vector3( 0,  1,  0)),
    DOWN:     Object.freeze(new THREE.Vector3( 0, -1,  0)),
    RIGHT:    Object.freeze(new THREE.Vector3( 1,  0,  0)),
    LEFT:     Object.freeze(new THREE.Vector3(-1,  0,  0)),
};

const DIRECTIONS_2D = {
    UP:    Object.freeze(new THREE.Vector2( 0,  1)),
    DOWN:  Object.freeze(new THREE.Vector2( 0, -1)),
    RIGHT: Object.freeze(new THREE.Vector2( 1,  0)),
    LEFT:  Object.freeze(new THREE.Vector2(-1,  0)),
};

const orthoNormals = Object.freeze([
    DIRECTIONS_3D.UP, DIRECTIONS_3D.FORWARD, DIRECTIONS_3D.DOWN, 
    DIRECTIONS_3D.RIGHT, DIRECTIONS_3D.BACKWARD, DIRECTIONS_3D.LEFT,
]);

const ORTHO_TO_INDEX = new Map();
const INDEX_TO_ORTHO = new Map();

orthoNormals.forEach((ortho, i) => {
    ORTHO_TO_INDEX.set(ortho, i);
    INDEX_TO_ORTHO.set(i, ortho);
});

Object.freeze(ORTHO_TO_INDEX);
Object.freeze(INDEX_TO_ORTHO);

function getOrthoIndex(ortho) {
    return ORTHO_TO_INDEX.get(ortho) ?? ORTHO_TO_INDEX.get(getNearestOrtho(ortho));
}

/**
 * @param {THREE.Vector3} vector
 * @param {number} threshold
 */
function getNearestOrtho(vector, threshold=-Infinity) {
    let dotMax = threshold;
    let orthoMax = orthoNormals[0];

    for (const ortho of orthoNormals) {
        const dot = ortho.dot(vector);
        if (dot > dotMax) {
            dotMax = dot;
            orthoMax = ortho;
        }
    }

    return orthoMax;
}

const orthoOrients = [];
orthoOrients.length = 6;

/** @type {THREE.Matrix3[]} */
const S4_TRANSFORM_LOOKUP = [];

/** @type {THREE.Quaternion[]} */
const S4Quats = [];

orthoNormals.forEach((up, i) => {
    orthoNormals.forEach((forward) => {
        if (Math.abs(up.dot(forward)) > .1) return;
        const left = up.clone().cross(forward);
        const matrix = new THREE.Matrix4().makeBasis(left, up, forward);
        S4_TRANSFORM_LOOKUP.push(new THREE.Matrix3().setFromMatrix4(matrix));

        const q = new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
        S4Quats.push(q);
        orthoOrients[i] = q;
    });
});

/**
 * @param {THREE.Quaternion} quaternion
 */
function quaternionToS4(quaternion) {
    return S4Quats.findIndex((o) => Math.abs(o.dot(quaternion)) >= 0.99);
}

const S4Ops = [];

orthoNormals.forEach((axis) => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 2).normalize();
    const rotationLookup = [];
    S4Ops.push(rotationLookup);

    S4Quats.forEach((prevOrientation) => {
        const nextOrientation = rotation.clone().multiply(prevOrientation).normalize();
        const nextOrientationIndex = quaternionToS4(nextOrientation);
        rotationLookup.push(nextOrientationIndex);
    });
});
