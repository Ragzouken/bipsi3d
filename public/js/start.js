"use strict";

window.addEventListener("DOMContentLoaded", start);

const UNBOUNDED = new THREE.Box3();
UNBOUNDED.min.set(-Infinity, -Infinity, -Infinity);
UNBOUNDED.max.set( Infinity,  Infinity,  Infinity);
Object.freeze(UNBOUNDED.min);
Object.freeze(UNBOUNDED.max);
Object.freeze(UNBOUNDED);

const INPUT = new Input();

async function start() {
    const clock = new THREE.Clock();
    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    document.getElementById("room-render").appendChild(renderer.domElement);

    INPUT.element = renderer.domElement;

    const editState = {
        layerMode: true,
        gridVertical: false,
        looking: false,
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function getNormalisePointer() {
        const norm = new THREE.Vector2();
        const rect = renderer.domElement.getBoundingClientRect();
        norm.x = ((pointer.x - rect.x) / rect.width ) * 2 - 1;
        norm.y = ((pointer.y - rect.y) / rect.height) * 2 - 1;
        norm.y *= -1;

        return norm;
    }

    // camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("pink", 8, 24);
    const ambient = new THREE.AmbientLight( 0xffffff, 0.5 );
    const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.75 );
    scene.add(ambient);
    scene.add( directionalLight );
    directionalLight.position.set(1, 2, 1);

    const camera = new THREE.PerspectiveCamera(75, 1 / 1, 0.1, 1000);
    camera.position.setZ(5);

    renderer.shadowMap.enabled = true;
    directionalLight.castShadow = true;

    const cameraFocus = new THREE.Object3D();

    function makeTexture(image) {
        const texture = new THREE.Texture(image);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        return texture;
    }

    async function loadTexture(url) {
        return makeTexture(await loadImage(url));
    }

    // tileset & designs
    const cursorTex = await loadTexture("./assets/cursor.png");
    const nubTex = await loadTexture("./assets/nub.png");
    const delNubTex = await loadTexture("./assets/delnub.png");
    const pickNubTex = await loadTexture("./assets/pick.png");
    const cellTex = await loadTexture("./assets/cell2.png");
    const tilesTex = await loadTexture("./assets/test-tiles.png");//"./assets/level1.png");

    // level
    const level = new RoomRendering(tilesTex);
    scene.add(level);

    const gridGeo = makeGridGeometry(13);
    const gridMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, map: cellTex, side: THREE.DoubleSide });
    const grid = new THREE.Mesh(gridGeo, gridMat);

    const gridAdjust = .5;
    grid.name = "Back Grid";
    grid.geometry.translate(-.5, -gridAdjust, -.5);
    grid.geometry.rotateX(-Math.PI * .5);
    scene.add(grid);

    const types = [...level.blockMap.meshes.keys()];

    camera.position.set(2, 6, 2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    //

    const shadow = new THREE.WebGLRenderTarget(1, 1);
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadow.texture, opacity: .2, transparent: true, color: 0x00000 });

    const compCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const compGeometry = new THREE.PlaneGeometry(2, 2);
    const compMesh = new THREE.Mesh(compGeometry, shadowMaterial);

    function resize() {
        const w = renderer.domElement.parentElement.clientWidth;
        const h = renderer.domElement.parentElement.clientHeight;
        renderer.setSize(w, h);
        shadow.setSize(w, h);

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    const cubeMat = new THREE.MeshBasicMaterial({ map: cursorTex, alphaTest: .5, side: THREE.DoubleSide });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.scale.multiplyScalar(1.02);

    const nubGeo = new THREE.PlaneGeometry(1, 1);
    nubGeo.rotateX(-Math.PI * .5);
    const nubMat = new THREE.MeshBasicMaterial({ map: nubTex, alphaTest: .5, side: THREE.DoubleSide });
    const nub = new THREE.Mesh(nubGeo, nubMat);

    const delNubMat = new THREE.MeshBasicMaterial({ map: delNubTex, alphaTest: .5, side: THREE.DoubleSide, color: "red" });
    const delNub = new THREE.Mesh(cubeGeo, delNubMat);
    delNub.scale.multiplyScalar(1.02);

    const pickNubMat = new THREE.MeshBasicMaterial({ map: pickNubTex, alphaTest: .5, side: THREE.DoubleSide });
    const pickNub = new THREE.Mesh(nubGeo, pickNubMat);

    const cursor = new THREE.Object3D();
    cursor.name = "Block Cursor";
    cursor.add(cube);

    nub.position.set(0, .52, 0);
    //delNub.position.set(0, .52, 0);
    pickNub.position.set(0, .52, 0);
    cursor.add(nub);
    cursor.add(delNub);
    cursor.add(pickNub);

    scene.add(cursor);
    const plane = new THREE.Plane();
    plane.normal.copy(Ortho3D.DOWN.vector);
    
    const focusTarget = new THREE.Vector3(0, 0.5, 0);
    focusTarget.copy(cameraFocus.position);

    const focus = new THREE.Vector3(0, 0, 0);
    let gridOrtho = Ortho3D.UP;

    const dragInfo = {};

    let type = "cube";
    let design = 0;

    let baseRotation = S4.IDENTITY;

    const selectShape = ui.radio("shape");
    selectShape.addEventListener("change", () => type = selectShape.value);

    const selectDesign = ui.radio("design");
    selectDesign.addEventListener("change", () => design = selectDesign.valueAsNumber);

    function getRotationOffset() {
        const cameraForward = camera.getWorldDirection(new THREE.Vector3());
        const t = Ortho3D.HORIZONTAL.indexOf(Ortho3D.BACKWARD);
        const f = Ortho3D.HORIZONTAL.indexOf(Ortho3D.fromNormalHorizontal(cameraForward));
        const d = (f - t + 4) % 4;

        return d;
    }

    function setBaseRotation(rotation) {
        baseRotation = rotation.rotated(Ortho3D.UP, -getRotationOffset());
    }

    function getRelativeRotation() {
        return baseRotation.rotated(Ortho3D.UP, getRotationOffset());
    }

    function clip(primary) {
        level.bounds.copy(UNBOUNDED);

        if (editState.layerMode) {
            const o = gridOrtho.vector;
            const sign = Math.sign(o.x + o.y + o.z);
            const adjust = sign > 0 ? 0 : 1;
            if (sign > 0) primary = !primary;

            const bound = primary ? level.bounds.max : level.bounds.min;

            if (o.x !== 0) bound.x = focus.x + adjust;
            if (o.y !== 0) bound.y = focus.y + adjust;
            if (o.z !== 0) bound.z = focus.z + adjust;
        } 
        
        level.update();
    }

    /**
     * @param {THREE.Vector3} position
     * @param {Ortho3D} ortho
     */
    function setGrid(position, ortho) {
        grid.position.copy(position);
        grid.position.addScaledVector(ortho.vector, .49);
        grid.lookAt(position);
    }

    function getGridOrtho() {
        const result = Ortho3D.fromNormal(Ortho3D.BACKWARD.vector.clone().applyQuaternion(grid.quaternion));
        return result;
    }

    setGrid(new THREE.Vector3(0, 0, 0), Ortho3D.DOWN);

    const cameraForward = new THREE.Vector3();
    const cameraLeft = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();

    function rotateAroundWorldAxis(object, point, axis, angle) {
        const q = new THREE.Quaternion();
        q.setFromAxisAngle(axis, angle);
        object.applyQuaternion(q);
        object.position.sub(point);
        object.position.applyQuaternion(q);
        object.position.add(point);
    }

    function rotateBlock(position, ortho, steps) {
        const block = level.blockMap.getBlockAt(position);

        if (block) {
            const rotation = S4.fromIndex(block.rotation).rotated(ortho, steps);
            level.blockMap.setBlockAt(position, block.type, rotation.index, block.design);
            setBaseRotation(rotation);
        }

        return block !== undefined;
    }

    const gridMode = ui.toggle("grid-mode");
    const gridRaise = ui.action("grid-raise", () => stepLayer(-1));
    const gridLower = ui.action("grid-lower", () => stepLayer(1));

    gridMode.checked = true;
    editState.layerMode = gridMode.checked;

    function stepLayer(sign) {
        const delta = gridOrtho.vector.clone().multiplyScalar(sign);
        focus.add(delta);
        setGrid(focus, gridOrtho);
        camera.position.add(delta);
    }

    level.bounds.max.y = 4;
    function animate(dt) {
        if (INPUT.pressed.has("l")) {
            gridMode.checked = !gridMode.checked;
        }

        editState.layerMode = gridMode.checked;

        let undoPreview = () => {};

        //editState.layerMode = !held["g"]

        const delta = focus.clone().sub(cameraFocus.position).multiplyScalar(.25+dt);
        cameraFocus.position.add(delta);
        cameraFocus.updateMatrixWorld();

        //const cameraForward = camera.getWorldDirection(new THREE.Vector3());
        //const cameraRight = DIRECTIONS_3D.RIGHT.clone().applyQuaternion(camera.quaternion);

        camera.matrix.extractBasis(cameraLeft, cameraUp,  cameraForward);
        cameraLeft.negate();
        cameraUp.negate();
        cameraForward.negate();

        const cameraRight = cameraLeft.clone().negate();

        gridOrtho = getGridOrtho();

        if (camera.position.clone().sub(grid.position).dot(gridOrtho.vector) > 0) {
            setGrid(focus, gridOrtho.inverted());
            gridOrtho = getGridOrtho();
        }

        if (INPUT.pressed.has("=")) gridRaise.invoke();
        if (INPUT.pressed.has("-")) gridLower.invoke();

        level.bounds.copy(UNBOUNDED);

        compMesh.visible = editState.layerMode;

        const norm = getNormalisePointer();
        raycaster.setFromCamera(norm, camera);

        cursor.visible = false;
        nub.visible = false;
        delNub.visible = false;
        pickNub.visible = false;
        grid.visible = false;

        scene.fog.near = 8;
        scene.fog.far = 8 + 16;

        if (INPUT.pressed.has("1")) selectShape.selectedIndex = 0;
        if (INPUT.pressed.has("2")) selectShape.selectedIndex = 1;
        if (INPUT.pressed.has("3")) selectShape.selectedIndex = 2;
        if (INPUT.pressed.has("4")) selectShape.selectedIndex = 3;
        if (INPUT.pressed.has("5")) selectShape.selectedIndex = 4;

        if (INPUT.pressed.has("7")) selectDesign.selectedIndex = 0;
        if (INPUT.pressed.has("8")) selectDesign.selectedIndex = 1;
        if (INPUT.pressed.has("9")) selectDesign.selectedIndex = 2;
        if (INPUT.pressed.has("0")) selectDesign.selectedIndex = 3;

        if (editState.looking) {
            renderer.domElement.requestPointerLock();
        } else {
            document.exitPointerLock();
        }

        if (INPUT.held.has("MouseMiddle") && dragInfo.focus) {;
            const delta = pointer.clone().sub(dragInfo.mouse);

            camera.matrixAutoUpdate = false;
            camera.matrix.identity();
            camera.applyMatrix4(dragInfo.camera2);
            camera.matrixAutoUpdate = true;

            const yawAxis = Ortho3D.UP.vector;
            rotateAroundWorldAxis(camera, dragInfo.focus, yawAxis, delta.x * .0075);

            const pitchAxis = Ortho3D.LEFT.vector.clone().applyQuaternion(camera.quaternion);
            rotateAroundWorldAxis(camera, dragInfo.focus, pitchAxis, delta.y * -.005);
        } else {
            dragInfo.focus = undefined;
        }

        const pick = INPUT.held.has("Alt");
        const del = !pick && INPUT.held.has("Control");
        const put = !pick && !del;

        ONE("#layer-controls").hidden = !editState.layerMode;

        if (editState.layerMode) {
            plane.setFromNormalAndCoplanarPoint(gridOrtho.vector, grid.position.clone().addScaledVector(gridOrtho.vector, -gridAdjust));
            const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
            
            if (editState.gridVertical) {
                const test = cameraForward.clone();
                test.y = 0;
                test.normalize();
                setGrid(focus, Ortho3D.fromNormal(test));
            }

            grid.visible = true;
            if (editState.looking) {
                const o = gridOrtho.vector;
                const ray = new THREE.Ray(camera.position, cameraForward);
                const point = ray.intersectPlane(plane, new THREE.Vector3())?.addScaledVector(o, -.5).round();
                if (point) {
                    if (o.x === 0) grid.position.x = point.x; 
                    if (o.y === 0) grid.position.y = point.y;
                    if (o.z === 0) grid.position.z = point.z;
                }
            }

            if (point && point.distanceTo(camera.position) < 25) {
                const o = gridOrtho.vector;
                cursor.visible = true;
                cursor.position.copy(point).addScaledVector(o, -.5+gridAdjust).round();

                grid.visible = true;
                if (!editState.looking) {
                    if (o.x === 0) grid.position.x = cursor.position.x; 
                    if (o.y === 0) grid.position.y = cursor.position.y;
                    if (o.z === 0) grid.position.z = cursor.position.z;
                }

                if (INPUT.pressed.has("g")) {
                    focus.copy(cursor.position);
                }

                const ray = new THREE.Ray(camera.position, cameraForward);
                const d = ray.intersectPlane(plane, new THREE.Vector3())?.distanceTo(camera.position) ?? 8;
                scene.fog.near = d;
                scene.fog.far = d + 16;

                if (INPUT.pressed.has("MouseMiddle") && !dragInfo.focus) {
                    dragInfo.focus = point.clone().round();
                    dragInfo.mouse = pointer.clone();
                    dragInfo.camera2 = camera.matrix.clone();
                    dragInfo.norm = 1 - Math.abs(getNormalisePointer().x);
                }

                if (INPUT.pressed.has("q")) {
                    if (!rotateBlock(cursor.position, gridOrtho, -1)) {
                        const rotation = getRelativeRotation().rotated(gridOrtho, -1);
                        setBaseRotation(rotation);
                    }
                }
    
                if (INPUT.pressed.has("e")) {
                    if (!rotateBlock(cursor.position, gridOrtho, 1)) {
                        const rotation = getRelativeRotation().rotated(gridOrtho, 1);
                        setBaseRotation(rotation);
                    }
                }
            }

            if (INPUT.pressed.has("g")) {
                editState.gridVertical = !editState.gridVertical; 
                setGrid(focus, editState.gridVertical ? Ortho3D.LEFT : Ortho3D.UP);
            }

            cursor.visible = cursor.visible && !editState.looking;
            if (cursor.visible && put) {
                const rotation = getRelativeRotation();
                const pos = cursor.position;
                const prev = level.blockMap.getBlockAt(pos);
                level.blockMap.setBlockAt(cursor.position, type, rotation.index, design);
                if (INPUT.held.has("MouseLeft")) {
                    focus.copy(cursor.position);
                } else if (prev) {
                    undoPreview = () => level.blockMap.setBlockAt(pos, prev.type, prev.rotation, prev.design);
                } else {
                    undoPreview = () => level.blockMap.delBlockAt(pos);
                }
            } else if (cursor.visible && del) {
                delNub.visible = true;
                nub.visible = false;

                if (INPUT.pressed.has("MouseLeft")) {
                    level.blockMap.delBlockAt(cursor.position);
                }
            } else if (cursor.visible && pick) {
                pickNub.visible = true;
                nub.visible = false;

                if (INPUT.held.has("MouseLeft")) {
                    const block = level.blockMap.getBlockAt(cursor.position);

                    if (block) {
                        setBaseRotation(S4.fromIndex(block.rotation));
                        design = block.design;
                        type = block.type;
                    }
                }
            }
        } else if (!editState.looking) {
            const useCube = level.blockMap.getBlockAt(cursor.position) !== undefined;
            const [first] = raycaster.intersectObjects(useCube ? [level.blockMap, cube] : [level.blockMap]);

            let position = undefined;

            if (first?.object === cube) {
                position = cursor.position.clone();
            } else if (first !== undefined) {
                position = level.blockMap.getEnhancedIntersection(first).position;
            }

            if (position) {
                cursor.visible = true;
                cursor.position.copy(position);

                const cubeOrtho = getCubeOrtho(raycaster.ray, position);
                cursor.rotation.setFromQuaternion(cubeOrtho.s4.quaternion);

                focus.copy(cursor.position);
                setGrid(focus, getGridOrtho());
                //grid.visible = true;

                nub.visible = put;

                if (cursor.visible && put) {
                    const rotation = getRelativeRotation();
                    const pos = cursor.position.clone().add(cubeOrtho.vector);
                    const prev = level.blockMap.getBlockAt(pos);

                    if (INPUT.pressed.has("MouseLeft")) {
                        level.blockMap.setBlockAt(pos, type, rotation.index, design);
                    } else if (prev) {
                        //undoPreview = () => level.blockMap.setBlockAt(pos, prev.type, prev.rotation, prev.design);
                    } else {
                        //undoPreview = () => level.blockMap.delBlockAt(pos);
                    }
                } else if (cursor.visible && del) {
                    delNub.visible = true;
                    nub.visible = false;
    
                    if (INPUT.pressed.has("MouseLeft")) {
                        level.blockMap.delBlockAt(cursor.position);
                    }
                } else if (cursor.visible && pick) {
                    pickNub.visible = true;
                    nub.visible = false;
    
                    if (INPUT.pressed.has("MouseLeft")) {
                        const block = level.blockMap.getBlockAt(cursor.position);
    
                        if (block) {
                            setBaseRotation(block.rotation);
                            design = block.design;
                            type = block.type;
                        }
                    }
                }

                if (INPUT.pressed.has("MouseMiddle") && !dragInfo.focus) {
                    dragInfo.focus = cursor.position.clone().round();
                    dragInfo.mouse = pointer.clone();
                    dragInfo.camera2 = camera.matrix.clone();
                }

                if (INPUT.pressed.has("q")) {
                    rotateBlock(position, cubeOrtho, 1);
                }

                if (INPUT.pressed.has("e")) {
                    rotateBlock(position, cubeOrtho, -1);
                }
            }
        }

        if (INPUT.hovered !== renderer.domElement) {
            cursor.visible = false;
            undoPreview();
            undoPreview = () => {};
        }

        editState.looking = INPUT.held.has("MouseRight") || INPUT.held.has("MouseMiddle");

        if (INPUT.held.has("w")) camera.position.addScaledVector(cameraForward, dt * 7);
        if (INPUT.held.has("s")) camera.position.addScaledVector(cameraForward, dt * -7);
        if (INPUT.held.has("a")) camera.position.addScaledVector(cameraRight, dt * -7);
        if (INPUT.held.has("d")) camera.position.addScaledVector(cameraRight, dt *  7);
        if (INPUT.held.has(" ")) camera.position.addScaledVector(Ortho3D.UP.vector, dt *  7);
        if (INPUT.held.has("Shift")) camera.position.addScaledVector(Ortho3D.UP.vector, dt *  -7);

        renderer.autoClear = false;

        if (editState.layerMode) {
            clip(false);
            renderer.setRenderTarget(shadow);
            renderer.clear(true, true, true);
            renderer.render(level, camera);
        }

        clip(true);
        renderer.setRenderTarget(null);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        if (editState.layerMode) renderer.render(compMesh, compCamera);

        stats.update();

        INPUT.step();

        undoPreview();

        selectShape.setValueSilent(type);
    };

    function update() {
        resize();
        animate(Math.min(1/15, clock.getDelta()));
        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);

    window.addEventListener("mousemove", (event) => {
        if (INPUT.held.has("MouseRight")) {
            camera.rotateOnAxis(Ortho3D.RIGHT.vector, event.movementY * -0.005);
            camera.rotateOnWorldAxis(Ortho3D.UP.vector, event.movementX * -0.005);
        }

        if (document.pointerLockElement) {
            pointer.x += event.movementX;
            pointer.y += event.movementY;
        } else {
            pointer.set(event.clientX, event.clientY);
        }
    });

    renderer.domElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });

    renderer.domElement.addEventListener("wheel", (event) => {
        // if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            if (!INPUT.held.has("MouseMiddle")) stepLayer(Math.sign(event.deltaY));

            event.preventDefault();
            event.stopPropagation();
        // }
    });
}

function makeGridGeometry(cells) {
    const vertices = [];
    const colors = [];
    const uvs = [];
    const index = [];

    const center = Math.floor(cells * .5);
    const origin = center;
    
    for (let z = 0; z <= cells; ++z) {
        for (let x = 0; x <= cells; ++x) {
            const dx = Math.abs(x - origin - .5);
            const dz = Math.abs(z - origin - .5);
            const d = Math.sqrt(dx*dx + dz*dz);

            const fade = Math.min(1, d / center);

            vertices.push(x - origin, 0, z - origin);
            colors.push(1, 1, 1, 1 - fade);
            uvs.push(z % 2, x % 2);

            if (z > 0 && x > 0) {
                const v0 = (z - 1) * (cells+1) + x - 1;
                const v1 = (z - 1) * (cells+1) + x;
                const v2 = z * (cells+1) + x;
                const v3 = z * (cells+1) + x - 1;

                index.push(v3, v2, v1);
                index.push(v3, v1, v0);
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);

    return geometry;
}

/**
 * @param {THREE.Ray} ray
 * @param {THREE.Vector3} position
 */
function getCubeOrtho(ray, position) {
    const box = new THREE.Box3().expandByPoint(position).expandByScalar(.5);
    const point = ray.intersectBox(box, new THREE.Vector3())?.sub(position);

    if (!point) return Ortho3D.UP;

    return Ortho3D.fromNormal(point.normalize());
}

const designCount = 16;


class RoomRendering extends THREE.Object3D {
    /**
     * @param {THREE.Texture} texture
     */
    constructor(texture) {
        super();

        this.timer = 0;
        this.frame = 0;

        const geometries = {
            cube: makeGeometry(cube),
            ramp: makeGeometry(ramp),
            slab: makeGeometry(slab),
            wedgeBody: makeGeometry(wedgeBody),
            wedgeHead: makeGeometry(wedgeHead),
        };

        this.texture = texture;
        this.tilesetWidth = 256;
        this.tilesetCols = 16;

        this.designs = new BlockDesignData(8, 4, designCount);
        for (let i = 0; i < designCount; ++i) this.designs.setDesignAt(i, boxDesign(THREE.MathUtils.randInt(1, 16*16-1), THREE.MathUtils.randInt(1, 16*16-1)));

        this.designs.setDesignAt(0, boxDesign(1, 2));
        this.designs.setDesignAt(1, boxDesign(3, 4));
        this.designs.setDesignAt(2, boxDesign(5, 6));
        this.designs.setDesignAt(3, boxDesign(7, 8));

        this.blockMaterial = new BlocksMaterial(this.texture, this.designs);
        this.spriteMaterial = new SpritesMaterial(this.texture);

        this.blockMap = new BlockMap(geometries, this.blockMaterial);
        this.billboards = new BillboardInstances(new THREE.PlaneGeometry(1, 1), this.spriteMaterial, 4096);

        this.add(this.blockMap);
        this.add(this.billboards);

        this.bounds = new THREE.Box3().copy(UNBOUNDED);
    }

    update() {
        if (this.blockMaterial.uniforms) {
            this.blockMaterial.uniforms.tilesetWidth.value = this.tilesetWidth;
            this.blockMaterial.uniforms.tilesetWidthInv.value = 1/this.tilesetWidth;
            this.blockMaterial.uniforms.tilesetCols.value = this.tilesetCols;
            this.blockMaterial.uniforms.tilesetColsInv.value = 1/this.tilesetCols;

            this.blockMaterial.uniforms.frame.value = this.frame;
            
            this.blockMaterial.uniforms.boundMin.value.copy(this.bounds.min);
            this.blockMaterial.uniforms.boundMax.value.copy(this.bounds.max);
        }

        if (this.timer == 0) this.frame = (this.frame + 1) % 4;
        this.timer = (this.timer + 1) % 20;
        this.billboards.update();
    }
}
