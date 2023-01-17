window.addEventListener("DOMContentLoaded", start);

const UNBOUNDED = new THREE.Box3();
UNBOUNDED.min.set(-Infinity, -Infinity, -Infinity);
UNBOUNDED.max.set( Infinity,  Infinity,  Infinity);
Object.freeze(UNBOUNDED.min);
Object.freeze(UNBOUNDED.max);

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

async function start() {
    const clock = new THREE.Clock();
    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    document.getElementById("room-render").appendChild(renderer.domElement);

    //

    const editState = {
        layerMode: true,
        looking: false,
    };

    // input
    let held = {};
    let pressed = {};
    let released = {};

    const mouseButtons = {
        0: "MouseLeft",
        1: "MouseMiddle",
        2: "MouseRight",
    }

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

    window.addEventListener("pointerdown", (event) => {
        const button = mouseButtons[event.button] ?? "MouseUnknown";
        pressed[button] = true;
        held[button] = true;
    });

    window.addEventListener("pointerup", (event) => {
        const button = mouseButtons[event.button] ?? "MouseUnknown";
        released[button] = true;
        held[button] = false;
    });

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
    const cellTex = await loadTexture("./assets/cell.png");
    const tilesTex = await loadTexture("./assets/test-tiles.png");//"./assets/level1.png");

    // level
    const level = new RoomRendering(tilesTex);
    scene.add(level);

    const gridGeo = makeGridGeometry(17);
    const gridMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, map: cellTex, side: THREE.DoubleSide });
    const grid = new THREE.Mesh(gridGeo, gridMat);

    grid.name = "Edit Plane";
    grid.geometry.translate(-.5, 0, -.5);
    grid.geometry.rotateX(-Math.PI * .5);
    scene.add(grid);

    const types = [...level.blockMap.meshes.keys()];

    camera.position.set(2, 2, 2);
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
    plane.normal.copy(DIRECTIONS_3D.DOWN);
    
    const focusTarget = new THREE.Vector3(0, 0.5, 0);
    focusTarget.copy(cameraFocus.position);

    const focus = new THREE.Vector3(0, 0, 0);
    let gridOrtho = DIRECTIONS_3D.UP;

    const dragInfo = {};

    let type = "cube";
    let rotation = 0;
    let design = 0;

    ALL(`input[name="shape"]`).forEach((input) => {
        input.addEventListener("change", (event) => {
            if (input.checked) type = input.value;
        });
    });

    function getRotationOffset() {
        const cameraForward = camera.getWorldDirection(new THREE.Vector3());
        const t = ORTHO_HORIZONTAL.indexOf(DIRECTIONS_3D.FORWARD);
        const f = ORTHO_HORIZONTAL.indexOf(getHorizontalOrtho(cameraForward));
        const d = (t - f + 4) % 4;

        return d;
    }

    function setBaseRotation(r) {
        const d = getRotationOffset();
        rotation = orthoRotate(r,  getOrthoIndex(DIRECTIONS_3D.UP), -d);
    }

    function getRelativeRotation() {
        const d = getRotationOffset();
        return orthoRotate(rotation, getOrthoIndex(DIRECTIONS_3D.UP), d);
    }

    function clip(primary) {
        level.bounds.copy(UNBOUNDED);

        if (editState.layerMode) {
            const sign = Math.sign(gridOrtho.x + gridOrtho.y + gridOrtho.z);
            const adjust = sign > 0 ? 0 : 1;
            if (sign > 0) primary = !primary;

            const bound = primary ? level.bounds.max : level.bounds.min;

            if (gridOrtho.x !== 0) bound.x = focus.x + adjust;
            if (gridOrtho.y !== 0) bound.y = focus.y + adjust;
            if (gridOrtho.z !== 0) bound.z = focus.z + adjust;
        } 
        
        level.update();
    }
    
    function setGrid(position, ortho) {
        grid.position.copy(position);
        grid.position.addScaledVector(ortho, .49);
        grid.lookAt(position);
    }

    function getGridOrtho() {
        return getNearestOrtho(DIRECTIONS_3D.BACKWARD.clone().applyQuaternion(grid.quaternion));
    }

    setGrid(new THREE.Vector3(0, 0, 0), DIRECTIONS_3D.DOWN);

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

    level.bounds.max.y = 4;
    function animate(dt) {
        if (pressed["g"]) {
            editState.layerMode = !editState.layerMode;
        }

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

        if (camera.position.clone().sub(grid.position).dot(gridOrtho) > 0) {
            setGrid(focus, gridOrtho.clone().multiplyScalar(-1));

            gridOrtho = getGridOrtho();
        }

        if (pressed["="]) stepLayer(1);
        if (pressed["-"]) stepLayer(-1);

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

        if (pressed["1"]) type = types[0];
        if (pressed["2"]) type = types[1];
        if (pressed["3"]) type = types[2];
        if (pressed["4"]) type = types[3];
        if (pressed["5"]) type = types[4];

        if (pressed["7"]) design = 0;
        if (pressed["8"]) design = 1;
        if (pressed["9"]) design = 2;
        if (pressed["0"]) design = 3;

        if (editState.looking) {
            renderer.domElement.requestPointerLock();
        } else {
            document.exitPointerLock();
        }

        if (held["MouseMiddle"] && dragInfo.focus) {;
            const delta = pointer.clone().sub(dragInfo.mouse);

            camera.matrixAutoUpdate = false;
            camera.matrix.identity();
            camera.applyMatrix4(dragInfo.camera2);
            camera.matrixAutoUpdate = true;

            const yawAxis = DIRECTIONS_3D.UP;
            rotateAroundWorldAxis(camera, dragInfo.focus, yawAxis, delta.x * .0075);

            const pitchAxis = DIRECTIONS_3D.LEFT.clone().applyQuaternion(camera.quaternion);
            rotateAroundWorldAxis(camera, dragInfo.focus, pitchAxis, delta.y * .005);
        } else {
            dragInfo.focus = undefined;
        }

        const pick = held["Alt"];
        const del = !pick && held["Control"];
        const put = !pick && !del;
        const click = pressed["MouseLeft"];

        if (editState.layerMode) {
            plane.setFromNormalAndCoplanarPoint(gridOrtho, grid.position);
            const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
            
            grid.visible = true;
            if (editState.looking) {
                const ray = new THREE.Ray(camera.position, cameraForward);
                const point = ray.intersectPlane(plane, new THREE.Vector3())?.addScaledVector(gridOrtho, -.5).round();
                if (point) {
                    if (gridOrtho.x === 0) grid.position.x = point.x; 
                    if (gridOrtho.y === 0) grid.position.y = point.y;
                    if (gridOrtho.z === 0) grid.position.z = point.z;
                }
            }

            if (point && point.distanceTo(camera.position) < 25) {
                cursor.visible = true;
                cursor.position.copy(point).addScaledVector(gridOrtho, -.5).round();

                grid.visible = true;
                if (!editState.looking) {
                    if (gridOrtho.x === 0) grid.position.x = cursor.position.x; 
                    if (gridOrtho.y === 0) grid.position.y = cursor.position.y;
                    if (gridOrtho.z === 0) grid.position.z = cursor.position.z;
                }

                const ray = new THREE.Ray(camera.position, cameraForward);
                const d = ray.intersectPlane(plane, new THREE.Vector3())?.distanceTo(camera.position) ?? 8;
                scene.fog.near = d;
                scene.fog.far = d + 16;

                if (pressed["MouseMiddle"] && !dragInfo.focus) {
                    dragInfo.focus = point.clone().round();
                    dragInfo.mouse = pointer.clone();
                    dragInfo.camera2 = camera.matrix.clone();
                    dragInfo.norm = 1 - Math.abs(getNormalisePointer().x);
                }

                const orthoIndex = getOrthoIndex(DIRECTIONS_3D.FORWARD.clone().applyQuaternion(grid.quaternion));

                if (pressed["q"]) {
                    const block = level.blockMap.getBlockAt(cursor.position);
                    if (block) {
                        const rotation = orthoRotate(block.rotation, orthoIndex, -1);
                        level.blockMap.setBlockAt(cursor.position, block.type, rotation, block.design);
                        setBaseRotation(rotation);
                    } else {
                        setBaseRotation(orthoRotate(getRelativeRotation(), orthoIndex, -1));
                    }
                }
    
                if (pressed["e"]) {
                    const block = level.blockMap.getBlockAt(cursor.position);
                    if (block) {
                        const rotation = orthoRotate(block.rotation, orthoIndex, 1);
                        level.blockMap.setBlockAt(cursor.position, block.type, rotation, block.design);
                        setBaseRotation(rotation);
                    } else {
                        setBaseRotation(orthoRotate(getRelativeRotation(), orthoIndex, 1));
                    }
                }
            }

            cursor.visible = cursor.visible && !editState.looking;
            if (cursor.visible && put) {
                const rotation = getRelativeRotation();
                const pos = cursor.position;
                const prev = level.blockMap.getBlockAt(pos);
                level.blockMap.setBlockAt(cursor.position, type, rotation, design);
                if (held["MouseLeft"]) {

                } else if (prev) {
                    undoPreview = () => level.blockMap.setBlockAt(pos, prev.type, prev.rotation, prev.design);
                } else {
                    undoPreview = () => level.blockMap.delBlockAt(pos);
                }
            } else if (cursor.visible && del) {
                delNub.visible = true;
                nub.visible = false;

                if (held["MouseLeft"]) {
                    level.blockMap.delBlockAt(cursor.position);
                }
            } else if (cursor.visible && pick) {
                pickNub.visible = true;
                nub.visible = false;

                if (held["MouseLeft"]) {
                    const block = level.blockMap.getBlockAt(cursor.position);

                    if (block) {
                        setBaseRotation(block.rotation);
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

                const cubeNormal = getCubeOrtho(raycaster.ray, position); 
                const orthoIndex = getOrthoIndex(cubeNormal);

                const quat = orthoOrients[orthoIndex];
                cursor.rotation.setFromQuaternion(quat);

                focus.copy(cursor.position);
                setGrid(focus, cubeNormal.clone().multiplyScalar(-1));
                //grid.visible = true;

                nub.visible = put;

                if (cursor.visible && put) {
                    const rotation = getRelativeRotation();
                    const pos = cursor.position.clone().add(cubeNormal);
                    const prev = level.blockMap.getBlockAt(pos);
                    level.blockMap.setBlockAt(pos, type, rotation, design);

                    if (pressed["MouseLeft"]) {

                    } else if (prev) {
                        undoPreview = () => level.blockMap.setBlockAt(pos, prev.type, prev.rotation, prev.design);
                    } else {
                        undoPreview = () => level.blockMap.delBlockAt(pos);
                    }
                } else if (cursor.visible && del) {
                    delNub.visible = true;
                    nub.visible = false;
    
                    if (pressed["MouseLeft"]) {
                        level.blockMap.delBlockAt(cursor.position);
                    }
                } else if (cursor.visible && pick) {
                    pickNub.visible = true;
                    nub.visible = false;
    
                    if (pressed["MouseLeft"]) {
                        const block = level.blockMap.getBlockAt(cursor.position);
    
                        if (block) {
                            setBaseRotation(block.rotation);
                            design = block.design;
                            type = block.type;
                        }
                    }
                }

                if (pressed["MouseMiddle"] && !dragInfo.focus) {
                    dragInfo.focus = cursor.position.clone().round();
                    dragInfo.mouse = pointer.clone();
                    dragInfo.camera2 = camera.matrix.clone();
                }

                if (pressed["q"]) {
                    const block = level.blockMap.getBlockAt(position);
                    const rotation = orthoRotate(block.rotation, orthoIndex, -1);
                    level.blockMap.setBlockAt(position, block.type, rotation, block.design);
                    setBaseRotation(rotation);
                }

                if (pressed["e"]) {
                    const block = level.blockMap.getBlockAt(position);
                    const rotation = orthoRotate(block.rotation, orthoIndex, 1);
                    level.blockMap.setBlockAt(position, block.type, rotation, block.design);
                    setBaseRotation(rotation);
                }
            }
        }

        editState.looking = held["MouseRight"] || held["MouseMiddle"];

        if (pressed["o"]) {
            camera.lookAt(camera.position.clone().set(0, 0, 0));
        }

        //if (held["MouseRight"]) {
            if (held["w"]) camera.position.addScaledVector(cameraForward, dt * 7);
            if (held["s"]) camera.position.addScaledVector(cameraForward, dt * -7);
            if (held["a"]) camera.position.addScaledVector(cameraRight, dt * -7);
            if (held["d"]) camera.position.addScaledVector(cameraRight, dt *  7);
            if (held[" "]) camera.position.addScaledVector(DIRECTIONS_3D.UP, dt *  7);
            if (held["Shift"]) camera.position.addScaledVector(DIRECTIONS_3D.UP, dt *  -7);
        //} else if (editState.layerMode) {
            // const right2 = ortho.clone().cross(forward).normalize();
            // const forward2 = right2.clone().cross(ortho).normalize();

            // if (held["w"]) camera.position.addScaledVector(forward2, dt * 7);
            // if (held["s"]) camera.position.addScaledVector(forward2, dt * -7);
            // if (held["a"]) camera.position.addScaledVector(right2, dt * -7);
            // if (held["d"]) camera.position.addScaledVector(right2, dt *  7);
            // if (held[" "]) camera.position.addScaledVector(ortho, dt *  7);
            // if (held["Shift"]) camera.position.addScaledVector(ortho, dt *  -7);
        //}

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
        pressed = {};
        released = {};

        undoPreview();

        ONE(`input[name="shape"][value="${type}"]`).click();
    };

    function update() {
        resize();
        animate(Math.min(1/15, clock.getDelta()));
        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);

    window.addEventListener("keydown", (event) => {
        // if (isElementTextInput(event.target)) return;

        held[event.key] = true;
        pressed[event.key] = true;

        held[event.key.toLowerCase()] = true;
        pressed[event.key.toLowerCase()] = true;

        if (event.key.includes("Arrow")) event.preventDefault();

        if (event.key.includes("Control")) {
            event.preventDefault();
            event.stopPropagation();
        }
    });

    window.addEventListener("keyup", (event) => {
        released[event.key] = true;
        released[event.key.toLowerCase()] = true;
        held[event.key] = false;
        held[event.key.toLowerCase()] = false;

        if (event.key.includes("Alt")) {
            event.preventDefault();
            event.stopPropagation();
        }
    });

    function clearHeld() {
        held = {};
    }

    window.addEventListener("mousemove", (event) => {
        if (held["MouseRight"]) {
            camera.rotateOnAxis(DIRECTIONS_3D.RIGHT, event.movementY * -0.005);
            camera.rotateOnWorldAxis(DIRECTIONS_3D.UP, event.movementX * -0.005);
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

    function stepLayer(sign) {
        const delta = gridOrtho.clone().multiplyScalar(sign);
        focus.add(delta);
        setGrid(focus, gridOrtho);
        camera.position.add(delta);
    }

    renderer.domElement.addEventListener("wheel", (event) => {
        // if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            if (!held["MouseMiddle"]) stepLayer(Math.sign(event.deltaY));

            event.preventDefault();
            event.stopPropagation();
        // }
    });

    window.addEventListener("contextmenu", clearHeld);
    window.addEventListener("blur", clearHeld);

    ONE("#info").addEventListener("pointerdown", (event) => {
        event.stopPropagation();
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

    if (!point) return orthoNormals[0];

    return getNearestOrtho(point);
}
