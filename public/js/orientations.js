"use strict";

class Ortho3D {
    /** @type {Readonly<Ortho3D[]>} */
    static ALL;
    /** @type {Readonly<Ortho3D[]>} */
    static VERTICAL;
    /** @type {Readonly<Ortho3D[]>} */
    static HORIZONTAL;
    /** @type {Readonly<Ortho3D[]>} */
    static INVERT_LOOKUP;

    /** @type {Ortho3D} */
    static FORWARD;
    /** @type {Ortho3D} */
    static BACKWARD;
    /** @type {Ortho3D} */
    static UP;
    /** @type {Ortho3D} */
    static DOWN;
    /** @type {Ortho3D} */
    static RIGHT;
    /** @type {Ortho3D} */
    static LEFT;

    /** @type {number} */
    index;
    /** @type {THREE.Vector3} */
    vector;
    /** @type {S4} */
    s4;
    /** @type {THREE.Quaternion} */
    turn;

    /** @param {THREE.Vector3} normal */
    static fromNormal(normal) {
        return maxBy(Ortho3D.ALL, (ortho) => ortho.vector.dot(normal));
    }

    /** @param {THREE.Vector3} normal */
    static fromNormalHorizontal(normal) {
        return maxBy(Ortho3D.HORIZONTAL, (ortho) => ortho.vector.dot(normal));
    }

    /**
     * @param {number} index
     * @param {THREE.Vector3} vector
     */
    constructor(index, vector) {
        this.index = index;
        this.vector = Object.freeze(vector.clone());
        this.turn = Object.freeze(new THREE.Quaternion().setFromAxisAngle(this.vector, Math.PI * .5).normalize());
    }

    inverted() {
        return Ortho3D.INVERT_LOOKUP[this.index];
    }
}

class S4 {
    /** @type {Readonly<S4>} */
    static IDENTITY;
    /** @type {Readonly<S4[]>} */
    static ALL;

    /** @type {Readonly<S4[][]>} */
    static AXIS_TURN_LOOKUP;

    /** @type {number} */
    index;
    /** @type {Readonly<THREE.Matrix4>} */
    matrix;
    /** @type {Readonly<THREE.Quaternion>} */
    quaternion;
    /** @type {Readonly<Ortho3D>} */
    ortho;
    
    /** @param {number} index */
    static fromIndex(index) {
        return S4.ALL[index];
    }

    /** @param {THREE.Quaternion} quaternion */
    static fromQuaternion(quaternion) {
        return S4.ALL.find((s) => Math.abs(s.quaternion.dot(quaternion)) >= 0.99);
    }

    /** 
     * @param {number} index 
     * @param {THREE.Matrix4} matrix
     */
    constructor(index, matrix) {
        this.index = index;
        this.matrix = Object.freeze(matrix.clone());
        this.quaternion = Object.freeze(new THREE.Quaternion().setFromRotationMatrix(matrix));
        this.ortho = Ortho3D.fromNormal(Ortho3D.UP.vector.clone().applyQuaternion(this.quaternion));
    }

    toString() {
        return `S4[${this.index}]`;
    }

    /**
     * @param {Ortho3D} axis
     * @param {number} steps
     * @returns {S4}
     */
    rotated(axis, steps) {
        if (steps === 0) {
            return this;
        } else if (steps < 0) {
            axis = axis.inverted();
            steps = -steps;
        }

        steps = steps % 4;
        const next = S4.AXIS_TURN_LOOKUP[axis.index][this.index];
        return next.rotated(axis, steps - 1);
    }
}

{
    const DIRECTIONS_3D = {
        FORWARD:  new THREE.Vector3( 0,  0,  1),
        RIGHT:    new THREE.Vector3( 1,  0,  0),
        UP:       new THREE.Vector3( 0,  1,  0),
        BACKWARD: new THREE.Vector3( 0,  0, -1),
        LEFT:     new THREE.Vector3(-1,  0,  0),
        DOWN:     new THREE.Vector3( 0, -1,  0),
    };

    const all = new Array(6);
    Object.entries(DIRECTIONS_3D).map(([name, vector], index) => {
        const ortho = new Ortho3D(index, vector);
        all[index] = ortho;
        Ortho3D[name] = ortho;
    });

    Ortho3D.ALL = Object.freeze(all);
    Ortho3D.VERTICAL = Object.freeze([Ortho3D.UP, Ortho3D.DOWN]);
    Ortho3D.HORIZONTAL = Object.freeze([Ortho3D.RIGHT, Ortho3D.BACKWARD, Ortho3D.LEFT, Ortho3D.FORWARD]);

    const invert = Ortho3D.ALL.map((ortho) => Ortho3D.fromNormal(ortho.vector.clone().negate()));
    Ortho3D.INVERT_LOOKUP = Object.freeze(invert);
}

/**
 * @template T
 * @param {Readonly<T[]>} values
 * @param {(value: T) => number} metric
 * @returns {T}
 */
function maxBy(values, metric) {
    let maxScore = -Infinity;
    let maxValue = values[0];

    for (const value of values) {
        const score = metric(value);
        if (score > maxScore) {
            maxScore = score;
            maxValue = value;
        }
    }

    return maxValue;
}

{
    const elements = [];
    const matrix4 = new THREE.Matrix4();

    const left = new THREE.Vector3();

    Ortho3D.ALL.forEach((forward) => {
        Ortho3D.ALL.forEach((up) => {
            if (Math.abs(up.vector.dot(forward.vector)) > .1) return;

            left.crossVectors(up.vector, forward.vector);
            matrix4.makeBasis(left, up.vector, forward.vector);

            const element = Object.freeze(new S4(elements.length, matrix4));
            elements.push(element);
        });
    });

    S4.ALL = Object.freeze(elements);
    S4.IDENTITY = S4.fromQuaternion(new THREE.Quaternion().identity());

    // nextS4 = AXIS_TURN_LOOKUP[axis][prevS4]
    const AXIS_TURN_LOOKUP = [];

    const nextQuat = new THREE.Quaternion();

    Ortho3D.ALL.forEach((axis) => {
        const turnLookup = [];

        S4.ALL.forEach((s4) => {
            nextQuat.multiplyQuaternions(axis.turn, s4.quaternion).normalize();
            turnLookup.push(S4.fromQuaternion(nextQuat));
        });

        Object.freeze(turnLookup);
        AXIS_TURN_LOOKUP.push(turnLookup);
    });

    Object.freeze(AXIS_TURN_LOOKUP);
    S4.AXIS_TURN_LOOKUP = AXIS_TURN_LOOKUP;
}

{
    Ortho3D.ALL.forEach((ortho) => ortho.s4 = S4.ALL.find((s) => s.ortho === ortho));
    Ortho3D.ALL.forEach(Object.freeze);
}
