"use strict";

// D4 = symmetry group for rotations+flips of a square

/**
 *  how to transform uv coordinates for different members of D4
 */
const D4_UV_LOOKUP = (function() {
    const [X, Y, XINV, YINV] = [0, 1, 2, 3];
    return Object.freeze([
        [   X,    Y], [YINV,    X], [XINV, YINV], [   Y, XINV],
        [XINV,    Y], [   Y,    X], [   X, YINV], [YINV, XINV],
    ].flat(1));
})();

const cols = 8;
const sw = 512;

const tileDefines = `
uniform float tileScale;
uniform int[16] D4_UV_LOOKUP;

vec2 mapTile(vec2 uv, int tile, int orientation) {
    vec4 components = vec4(uv.x, uv.y, 1.0 - uv.x, 1.0 - uv.y);
    int xi = D4_UV_LOOKUP[orientation * 2 + 0];
    int yi = D4_UV_LOOKUP[orientation * 2 + 1];
    uv = vec2(components[xi], components[yi]);
    
    // half pixel correction
    vec2 c = vec2(1.0 / ${sw}.0);
    uv += c * .5;
    uv -= c * uv;

    float t = float(tile);
    uv += vec2(mod(t, ${cols}.0), floor(t / ${cols}.0));
    uv *= tileScale;

    return uv;
}
`;

const cubeDefines = `
uniform mat3[24] S4_TRANSFORM_LOOKUP;

mat4 mapCube(vec3 position, int orientation) {
    mat4 matrix = mat4(1.0);
    mat3 rotation = S4_TRANSFORM_LOOKUP[orientation];
    matrix[0].xyz = rotation[0];
    matrix[1].xyz = rotation[1];
    matrix[2].xyz = rotation[2];
    matrix[3].xyz = position;
    return matrix;
}
`;

const blockTileDefines = tileDefines + cubeDefines + `
precision highp usampler2D;

attribute vec4 instanceOrientation;
attribute float face;
attribute int design;

uniform usampler2D blockDesigns;
uniform int frame;

vec2 getTileData() {
    int faceIndex = int(face);
    uint tileIndex = texelFetch(blockDesigns, ivec2(frame*16 + faceIndex*2 + 0, design), 0).r;
    uint rotIndex = texelFetch(blockDesigns, ivec2(frame*16 + faceIndex*2 + 1, design), 0).r;
    
    return vec2(float(tileIndex), rotIndex);
}
`;

const quadTileDefines = tileDefines + `
attribute vec3 instancePosition;
attribute vec4 instanceAxis;
attribute vec2 instanceTile;

vec2 getTileData() {
    return instanceTile;
}
`;

const tileUVs = `
    #ifdef USE_UV
        vec2 tile = getTileData();
        vUv = mapTile(uv, int(tile.x), int(tile.y));
    #endif
`;

/** 
 * @param {THREE.Shader} shader
 */
function blockShapeShaderFixer(shader) {
    shader.uniforms.frame = { value: 1 };
    shader.uniforms.tileScale = { value: 1/cols };
    shader.uniforms.S4_TRANSFORM_LOOKUP = { value: S4_TRANSFORM_LOOKUP };
    shader.uniforms.D4_UV_LOOKUP = { value: D4_UV_LOOKUP };
    shader.uniforms.blockDesigns = { value: undefined };

    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
` + blockTileDefines);
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", tileUVs);
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `
vec4 mvPosition = vec4(transformed, 1.0);
mat4 blockMatrix = mapCube(instanceOrientation.xyz, int(instanceOrientation.w));
mat4 combined = projectionMatrix * modelViewMatrix * blockMatrix; 

// pull backfaces in a little to prevent z-fighting inside transparent blocks
vec3 norm = transformDirection(normal, combined);
float offset = dot(norm, vec3(0.0, 0.0, 1.0));
mvPosition.xyz -= normal * clamp(offset, 0.0, 1.0) * 0.001;

gl_Position = combined * mvPosition;

#ifdef USE_UV
    if (tile.x == 0.0) gl_Position = vec4(0.0);
#endif
        `.trim(),
    );
};

/** 
 * @param {THREE.Shader} shader
 */
function billboardShaderFixer(shader) {
    this.uniforms = shader.uniforms;
    shader.uniforms.tileScale = { value: 1/cols };
    shader.uniforms.D4_UV_LOOKUP = { value: D4_UV_LOOKUP };

    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
` + quadTileDefines);
    shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `
    #ifdef USE_UV
        vec2 tile = getTileData();
        vUv = mapTile(uv, int(tile.x), int(tile.y));
    #endif
`);
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `
vec4 mvPosition = vec4(transformed, 1.0);

vec3 forward = -inverse(modelViewMatrix)[2].xyz;
vec3 up      = instanceAxis.xyz;
vec3 left    = normalize(cross(forward, up));
up           = mix(normalize(cross(left, forward)), up, instanceAxis.w);
forward      = cross(left, up);

mat4 quadMatrix = mat4(1.0);
quadMatrix[0].xyz = left;
quadMatrix[1].xyz = up;
quadMatrix[2].xyz = forward;
quadMatrix[3].xyz = instancePosition;

gl_Position = projectionMatrix * modelViewMatrix * quadMatrix * mvPosition;
        `.trim(),
    );
};

class BlockDesignData extends THREE.DataTexture {
    /**
     * @param {number} faces
     * @param {number} frames
     * @param {number} count
     */
    constructor(faces, frames, count) {
        const stride = faces * frames * 2;
        const data = new Uint8Array(stride * count);

        super(data, stride, count, THREE.RedIntegerFormat, THREE.UnsignedByteType);
        
        this.internalFormat = /** @type {THREE.PixelFormatGPU} */ ("R8UI");
        this.needsUpdate = true;

        this.data = data;
        this.faces = faces;
        this.frames = frames;
        this.count = count;

        this.view = new DataView(data.buffer, 0, data.byteLength);
    }

    /**
     * @param {number} index
     * @param {number[]} target
     */
    getDesignAt(index, target) {
        const stride = this.faces * this.frames * 2;
        
        target.length = stride;
        for (let i = 0; i < stride; ++i) {
            target[i] = this.view.getUint8(index * stride + i);
        }
    }

    /**
     * @param {number} index
     * @param {number[]} design
     */
    setDesignAt(index, design) {
        const stride = this.faces * this.frames * 2;
        
        for (let i = 0; i < stride; ++i) {
            this.view.setUint8(index * stride + i, design[i]);
        }
    }

    update() {
        this.needsUpdate = true;
    }
}

/**
 * Instancing based on a particular block shape mesh and material (tileset), but
 * with a design (per face tiles) per instance.
 */
class BlockShapeInstances extends THREE.InstancedMesh {
    /**
     * @param {THREE.BufferGeometry} geometry
     * @param {THREE.Material} material
     * @param {number} count
     */
    constructor(geometry, material, count) {
        super(geometry.clone(), material, count);
        this.count = 0;

        this.orientation = new THREE.InstancedBufferAttribute(new Float32Array(4 * count), 4).setUsage(THREE.DynamicDrawUsage);
        this.design = new THREE.InstancedBufferAttribute(new Int32Array(count), 1).setUsage(THREE.DynamicDrawUsage);

        this.geometry.setAttribute("instanceOrientation", this.orientation);
        this.geometry.setAttribute("design", this.design);
    }

    static _sphere = new THREE.Sphere();
    static _box = new THREE.Box3();
    static _matrix = new THREE.Matrix4();
    static _orientation = new THREE.Vector4();
    static _mesh = new THREE.Mesh();
    static _intersects = [];

    /**
     * @param {number} index
     */
    delAllAt(index) {
        const isLast = index === this.count - 1;

        // if this isn't the last element, swap it with the last element
        if (!isLast) {
            const prev = this.count - 1;
            const next = index;

            this.getOrientationAt(prev, BlockShapeInstances._orientation);
            this.setOrientationAt(next, BlockShapeInstances._orientation);
            this.setDesignAt(next, this.getDesignAt(prev));

            // contents of prev now live at next
        }

        // discard the last element
        this.count -= 1;

        return !isLast;
    }

    /**
     * @param {number} triangle
     * @returns {number}
     */
    getFaceIndex(triangle) {
        const faces = this.geometry.getAttribute("face");
        const face = faces.getX(this.geometry.index.array[triangle * 3]);
        return face;
    }

    /**
     * @param {number} index
     * @param {number} face
     * @returns {THREE.Triangle[]}
     */
    getFaceTriangles(index, face) {
        this.getMatrixAt(index, BlockShapeInstances._matrix);
        const triCount = this.geometry.index.count / 3;
        const triangles = [];

        for (let i = 0; i < triCount; ++i) {
            if (this.getFaceIndex(i) === face) {
                const triangle = new THREE.Triangle();
                this.getTriangleAt(index, i, triangle);
                triangles.push(triangle);
            }
        }

        return triangles;
    }

    /**
     * @param {number} index
     * @param {number} triangle
     * @param {THREE.Triangle} target
     */
    getTriangleAt(index, triangle, target) {
        this.getMatrixAt(index, BlockShapeInstances._matrix);
        const indexes = this.geometry.index.array;
        const i = triangle * 3;

        target.setFromAttributeAndIndices(
            this.geometry.getAttribute("position"), 
            indexes[i+0], indexes[i+1], indexes[i+2],
        );

        target.a.applyMatrix4(BlockShapeInstances._matrix);
        target.b.applyMatrix4(BlockShapeInstances._matrix);
        target.c.applyMatrix4(BlockShapeInstances._matrix);
    }

    /**
     * @param {number} index
     * @param {THREE.Matrix4} target
     */
    getMatrixAt(index, target) {
        const _orientation = BlockShapeInstances._orientation;

        _orientation.fromBufferAttribute(this.orientation, index);
        target.identity();
        target.setFromMatrix3(S4_TRANSFORM_LOOKUP[_orientation.w]);
        target.setPosition(_orientation.x, _orientation.y, _orientation.z);
    }

    /**
     * @param {number} index
     * @param {THREE.Vector4} target
     */
    getOrientationAt(index, target) {
        target.fromBufferAttribute(this.orientation, index);
    }

    /**
     * @param {number} index
     * @param {THREE.Vector4} orientation
     */
     setOrientationAt(index, orientation) {
        this.orientation.setXYZW(index, orientation.x, orientation.y, orientation.z, orientation.w);
    }

    /**
     * @param {number} index
     * @param {THREE.Vector3} target
     */
    getPositionAt(index, target) {
        target.fromBufferAttribute(this.orientation, index);
    }

    /**
     * @param {number} index
     * @param {THREE.Vector3} position
     */
    setPositionAt(index, position) {
        this.orientation.setXYZ(index, position.x, position.y, position.z);
    }

    /**
     * @param {number} index
     * @returns {number}
     */
     getRotationAt(index) {
        return this.orientation.getW(index);
    }

    /**
     * @param {number} index
     * @param {number} rotation
     */
    setRotationAt(index, rotation) {
        this.orientation.setW(index, rotation);
    }

    /**
     * @param {number} index
     */
    getDesignAt(index) {
        return this.design.getX(index);
    }

    /**
     * @param {number} index
     * @param {number} design
     */
    setDesignAt(index, design) {
        this.design.setX(index, design);
    }

    update() {
        this.orientation.needsUpdate = true;
        this.design.needsUpdate = true;
    }

    /**
     * @param {THREE.Raycaster} raycaster
     * @param {THREE.Intersection[]} intersects
     */
    raycast(raycaster, intersects) {
        BlockShapeInstances._sphere.radius = 1 * Math.sqrt(3);

        BlockShapeInstances._mesh.geometry = this.geometry;
        BlockShapeInstances._mesh.material = this.material;

        for (let index = 0; index < this.count; ++index) {
            this.getPositionAt(index, BlockShapeInstances._sphere.center);
            if (!raycaster.ray.intersectsSphere(BlockShapeInstances._sphere)) continue;

            this.getMatrixAt(index, BlockShapeInstances._matrix);
            BlockShapeInstances._mesh.matrixWorld = BlockShapeInstances._matrix;
            BlockShapeInstances._mesh.raycast(raycaster, BlockShapeInstances._intersects);

            for (let i = 0; i < BlockShapeInstances._intersects.length; ++i) {
				const intersect = BlockShapeInstances._intersects[i];
				intersect.instanceId = index;
				intersect.object = this;
				intersects.push(intersect);
			}

			BlockShapeInstances._intersects.length = 0;
        }
    }

    /**
     * All triangles within the bounding box.
     * 
     * @param {THREE.Box3} bounds
     * @param {THREE.Triangle[]} target
     */
    getTrianglesInBounds(bounds, target) {
        const offset = new THREE.Vector3(.5, .5, .5);

        const positions = this.geometry.getAttribute('position');
        const indexes = this.geometry.index.array;

        for (let i = 0; i < this.count; ++i) {
            this.getPositionAt(i, BlockShapeInstances._box.min);
            BlockShapeInstances._box.max.copy(BlockShapeInstances._box.min);
            BlockShapeInstances._box.min.sub(offset);
            BlockShapeInstances._box.max.add(offset);

            if (!bounds.intersectsBox(BlockShapeInstances._box)) continue;

            this.getMatrixAt(i, BlockShapeInstances._matrix);

            for (let i = 0; i < indexes.length; i += 3) {
                const triangle = new THREE.Triangle();
                triangle.setFromAttributeAndIndices(
                    positions, 
                    indexes[i+0], 
                    indexes[i+1], 
                    indexes[i+2],
                );
                triangle.a.applyMatrix4(BlockShapeInstances._matrix);
                triangle.b.applyMatrix4(BlockShapeInstances._matrix);
                triangle.c.applyMatrix4(BlockShapeInstances._matrix);
                target.push(triangle);
            }
        }
    }
}

class BillboardInstances extends THREE.InstancedMesh {
    /**
     * @param {THREE.BufferGeometry} geometry
     * @param {THREE.Material} material
     * @param {number} count
     */
    constructor(geometry, material, count) {
        material = material.clone();
        material.onBeforeCompile = billboardShaderFixer;

        super(geometry.clone(), material, count);
        this.count = 0;

        this.cameraWorldDirection = new THREE.Vector3();

        this.positions = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        this.positions.setUsage(THREE.DynamicDrawUsage);

        this.axis = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
        this.axis.setUsage(THREE.DynamicDrawUsage);
        
        this.tile = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
        this.tile.setUsage(THREE.DynamicDrawUsage);

        this.geometry.setAttribute("instancePosition", this.positions);
        this.geometry.setAttribute("instanceAxis", this.axis);
        this.geometry.setAttribute("instanceTile", this.tile);
    }

    static _matrix = new THREE.Matrix4();
    static _position = new THREE.Vector4();
    static _axis = new THREE.Vector4();
    static _xAxis = new THREE.Vector3();
    static _yAxis = new THREE.Vector3();
    static _zAxis = new THREE.Vector3();

    /**
     * @param {number} index
     * @returns {THREE.Triangle[]}
     */
    getFaceTriangles(index) {
        this.getMatrixAt(index, BillboardInstances._matrix);
        const triCount = this.geometry.index.count / 3;
        const triangles = [];

        for (let i = 0; i < triCount; ++i) {
            const triangle = new THREE.Triangle();
            this.getTriangleAt(index, i, triangle);
            triangles.push(triangle);
        }

        return triangles;
    }

    /**
     * @param {number} index
     * @param {number} triangle
     * @param {THREE.Triangle} target
     */
    getTriangleAt(index, triangle, target) {
        this.getMatrixAt(index, BillboardInstances._matrix);
        const indexes = this.geometry.index.array;
        const i = triangle * 3;

        target.setFromAttributeAndIndices(
            this.geometry.getAttribute("position"), 
            indexes[i+0], indexes[i+1], indexes[i+2],
        );

        target.a.applyMatrix4(BillboardInstances._matrix);
        target.b.applyMatrix4(BillboardInstances._matrix);
        target.c.applyMatrix4(BillboardInstances._matrix);
    }

    /**
     * @param {number} index
     * @param {THREE.Matrix4} target
     */
    getMatrixAt(index, target) {
        const _position = BillboardInstances._position;
        const _axis = BillboardInstances._axis;

        _position.fromBufferAttribute(this.positions, index);
        _axis.fromBufferAttribute(this.axis, index);

        BillboardInstances._zAxis.copy(this.cameraWorldDirection);
        BillboardInstances._yAxis.set(_axis.x, _axis.y, _axis.z);
        BillboardInstances._xAxis.crossVectors(
            BillboardInstances._zAxis, 
            BillboardInstances._yAxis,
        ).normalize();

        if (_axis.w === 0) {
            BillboardInstances._yAxis.crossVectors(
                BillboardInstances._xAxis, 
                BillboardInstances._zAxis,
            ).normalize();
        }

        target.identity();
        target.makeBasis(
            BillboardInstances._xAxis, 
            BillboardInstances._yAxis, 
            BillboardInstances._zAxis,
        );
        target.setPosition(_position.x, _position.y, _position.z);

        return target;
    }

    /**
     * @param {number} index
     * @param {THREE.Vector3} position
     */
    setPositionAt(index, position) {
        this.positions.setXYZ(index, position.x, position.y, position.z);
    }

    /**
     * @param {number} index
     * @param {THREE.Vector3} axis
     * @param {boolean} pinned
     */
    setAxisAt(index, axis, pinned=false) {
        this.axis.setXYZW(index, axis.x, axis.y, axis.z, pinned ? 1 : 0);
    }

    /**
     * @param {number} index
     * @param {number} tile 
     * @param {number} rotation
     */
    setTileAt(index, tile, rotation=0) {
        this.tile.setXY(index, tile, rotation);
    }

    update() {
        this.positions.needsUpdate = true;
        this.axis.needsUpdate = true;
        this.tile.needsUpdate = true;
    }
}
