const orthoNormals = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(-1, 0, 0),
];

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
 * @param {THREE.Vector3} normal
 * @param {number} threshold
 * @returns {THREE.Vector3}
 */
function nearestOrthoNormal(normal, threshold=-Infinity) {
    let max = threshold;
    let ortho = undefined;

    orthoNormals.forEach((o) => {
        if (o.dot(normal) > max) {
            max = o.dot(normal);
            ortho = o;
        }
    });

    return ortho;
}

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

const cube = {
    name: "cube",

    faces: [
        {
            name: "top",
            positions: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
            texturing: [[1, 1], [0, 1], [0, 0], [1, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "bottom",
            positions: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
            texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "front",
            positions: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]],
            texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "back",
            positions: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
            texturing: [[0, 0], [1, 0], [1, 1], [0, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "left",
            positions: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]],
            texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "right",
            positions: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]],
            texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },
    ],
}

const ramp =
{
    name: "ramp",

    faces:
        [
            {
                name: "slope",
                positions: [[0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 0]],
                texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },

            {
                name: "bottom",
                positions: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
                texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },

            {
                name: "back",
                positions: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
                texturing: [[0, 0], [1, 0], [1, 1], [0, 1]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },

            {
                name: "left",
                positions: [[1, 1, 0], [1, 0, 1], [1, 0, 0]],
                texturing: [[1, 1], [0, 0], [1, 0]],
                triangles: [[0, 1, 2]]
            },

            {
                name: "right",
                positions: [[0, 0, 1], [0, 1, 0], [0, 0, 0]],
                texturing: [[1, 0], [0, 1], [0, 0]],
                triangles: [[0, 1, 2]]
            },
        ],
}

const slab =
{
    name: "slab",

    faces: [
        {
            name: "top",
            positions: [[0, .5, 1], [1, .5, 1], [1, .5, 0], [0, .5, 0]],
            texturing: [[1, 1], [0, 1], [0, 0], [1, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "bottom",
            positions: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
            texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "front",
            positions: [[0, .5, 1], [0, 0, 1], [1, 0, 1], [1, .5, 1]],
            texturing: [[0, .5], [0, 0], [1, 0], [1, .5]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "back",
            positions: [[1, 0, 0], [0, 0, 0], [0, .5, 0], [1, .5, 0]],
            texturing: [[0, 0], [1, 0], [1, .5], [0, .5]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "left",
            positions: [[1, .5, 1], [1, 0, 1], [1, 0, 0], [1, .5, 0]],
            texturing: [[0, .5], [0, 0], [1, 0], [1, .5]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "right",
            positions: [[0, .5, 0], [0, 0, 0], [0, 0, 1], [0, .5, 1]],
            texturing: [[0, .5], [0, 0], [1, 0], [1, .5]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },
    ],
}

const wedgeHead =
{
    name: "wedge-head",

    faces:
        [
            {
                name: "slope",
                positions: [[0, .5, 0], [0, 0, 1], [1, 0, 1], [1, .5, 0]],
                texturing: [[0, 1], [0, 0], [1, 0], [1, 1]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },

            {
                name: "bottom",
                positions: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
                texturing: [[1, 0], [1, 1], [0, 1], [0, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },

            {
                name: "back",
                positions: [[1, 0, 0], [0, 0, 0], [0, .5, 0], [1, .5, 0]],
                texturing: [[0, 0], [1, 0], [1, .5], [0, .5]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },

            {
                name: "left",
                positions: [[1, .5, 0], [1, 0, 1], [1, 0, 0]],
                texturing: [[1, .5], [0, 0], [1, 0]],
                triangles: [[0, 1, 2]]
            },

            {
                name: "right",
                positions: [[0, 0, 1], [0, .5, 0], [0, 0, 0]],
                texturing: [[1, 0], [0, .5], [0, 0]],
                triangles: [[0, 1, 2]]
            },
        ],
}

const wedgeBody =
{
    name: "wedge-body",

    faces: [
        {
            name: "slope",
            positions: [[0, .5, 1], [1, .5, 1], [1, 1, 0], [0, 1, 0]],
            texturing: [[0, 0], [1, 0], [1, 1], [0, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "bottom",
            positions: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
            texturing: [[1, 0], [1, 1], [0, 1], [0, 0]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "front",
            positions: [[0, .5, 1], [0, 0, 1], [1, 0, 1], [1, .5, 1]],
            texturing: [[0, .5], [0, 0], [1, 0], [1, .5]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "back",
            positions: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
            texturing: [[0, 0], [1, 0], [1, 1], [0, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "left",
            positions: [[1, .5, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]],
            texturing: [[0, .5], [0, 0], [1, 0], [1, 1]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },

        {
            name: "right",
            positions: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, .5, 1]],
            texturing: [[0, 1], [0, 0], [1, 0], [1, .5]],
            triangles: [[0, 1, 2], [0, 2, 3]]
        },
    ],
}

function makeGeometry(data) {
    const positions = [];
    const texcoords = [];
    const normals = [];
    const indexes = [];
    const faces = [];

    let nextIndex = 0;

    data.faces.forEach((face, faceIndex) => {
        // offset indices relative to existing vertices
        const faceIndexes = face.triangles
            .reduce((a, b) => [...a, ...b], [])
            .map(index => nextIndex + index);

        indexes.push(...faceIndexes);
        nextIndex += face.positions.length;

        // compute shared normal and add all positions/texcoords/normals
        const p0 = new THREE.Vector3(...face.positions[0]);
        const p1 = new THREE.Vector3(...face.positions[1]);
        const p2 = new THREE.Vector3(...face.positions[2]);

        const normal = new THREE.Vector3();
        normal.crossVectors(p1.sub(p0), p2.sub(p0)).normalize();

        for (let i = 0; i < face.positions.length; ++i) {
            positions.push(...face.positions[i]);
            texcoords.push(...face.texturing[i]);
            faces.push(faceIndex);
            normals.push(normal.x, normal.y, normal.z);
        }
    });

    const p = new THREE.BufferAttribute(new Float32Array(positions), 3);
    const t = new THREE.BufferAttribute(new Float32Array(texcoords), 2);
    const n = new THREE.BufferAttribute(new Float32Array(normals), 3);
    const f = new THREE.BufferAttribute(new Float32Array(faces), 1);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", p);
    geometry.setAttribute("normal", n);
    geometry.setAttribute("uv", t);
    geometry.setAttribute("face", f);
    geometry.setIndex(indexes);

    geometry.translate(-.5, -.5, -.5);

    return geometry;
}

function vec2key(vector) {
    return this.xyz2key(vector.x, vector.y, vector.z);
}

function xyz2key(x, y, z) {
    return `${x|0},${y|0},${z|0}`;
}

class BlockMap extends THREE.Object3D {
    /** @type {Map<string, { type: string, index: number }>} */
    blocks = new Map();
    /** @type {Map<string, BlockShapeInstances>} */
    meshes = new Map();

    /**
     * @param {{ [type: string]: THREE.BufferGeometry }} geometries
     */
    constructor(geometries, material) {
        super();

        const renderers = new Map(Object.entries(geometries).map(([key, geometry]) => [key, new BlockShapeInstances(geometry, material, 4096)]));
        
        renderers.forEach((mesh, type) => {
            mesh.name = `Instanced Blocks (${type})`;
            this.meshes.set(type, mesh);
            this.add(mesh);
            
            mesh.receiveShadow = true;
            mesh.castShadow = true;
        });
    }

    clearBlocks() {
        this.meshes.forEach((mesh) => mesh.count = 0);
        this.blocks.clear();
    }

    /**
     * @param {THREE.Vector3} position
     * @param {string} type 
     */
    setBlockAt(position, type, rotation=0, design=0) {
        this.delBlockAt(position);

        const mesh = this.meshes.get(type);
        const index = mesh.count++;
        mesh.setPositionAt(index, position);
        mesh.setRotationAt(index, rotation);
        mesh.setDesignAt(index, design);
        mesh.update();

        this.blocks.set(vec2key(position), { type, index });
    }

    getBlockAt(position) {
        const block = this.blocks.get(vec2key(position));
        if (!block) return undefined;

        const mesh = this.meshes.get(block.type);

        return {
            type: block.type,
            rotation: mesh.getRotationAt(block.index),
            design: mesh.getDesignAt(block.index),
        }
    }

    delBlockAt(position) {
        const block = this.blocks.get(vec2key(position));
        if (!block) return;

        const mesh = this.meshes.get(block.type);
        const relocated = mesh.delAllAt(block.index);
        this.blocks.delete(vec2key(position));

        // update index of relocated block
        if (relocated) {
            const lastPos = new THREE.Vector3();
            mesh.getPositionAt(block.index, lastPos);
            this.getBlockAt(lastPos).index = block.index;
            mesh.update();

            this.blocks.set(vec2key(lastPos), block);
        }
    }

    /**
     * @param {THREE.Box3} bounds
     * @param {THREE.Triangle[]} target
     */
    getTrianglesInBounds(bounds, target) {
        this.meshes.forEach((mesh) => mesh.getTrianglesInBounds(bounds, target));
    }

    /**
     * @param {THREE.Raycaster} raycaster
     * @param {THREE.Box3} bounds
     */
    raycastBlocks(raycaster, bounds=undefined) {
        const intersects = raycaster.intersectObject(this, true);

        for (let intersect of intersects) {
            const renderer = /** @type {BlockShapeInstances} */ (intersect.object);
            const position = new THREE.Vector3();

            renderer.getPositionAt(intersect.instanceId, position);

            if (bounds && !bounds.containsPoint(position)) continue;

            return {
                intersection: intersect,
                position,
            }
        }
    }
}
