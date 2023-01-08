window.addEventListener("DOMContentLoaded", start);

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
            ramp: makeGeometry(ramp),
            slab: makeGeometry(slab),
            cube: makeGeometry(cube),
            wedgeHead: makeGeometry(wedgeHead),
            wedgeBody: makeGeometry(wedgeBody),
        };

        this.texture = texture;
        this.tilesetWidth = 512;
        this.tilesetCols = 16;

        this.designs = new BlockDesignData(8, 4, designCount);
        for (let i = 0; i < designCount; ++i) this.designs.setDesignAt(i, randomDesign(undefined, 0));

        this.designs.setDesignAt(0, boxDesign(1, 2));

        this.blockMaterial = new BlocksMaterial(this.texture, this.designs);
        this.spriteMaterial = new SpritesMaterial(this.texture);

        this.blockMap = new BlockMap(geometries, this.blockMaterial);
        this.billboards = new BillboardInstances(new THREE.PlaneGeometry(1, 1), this.spriteMaterial, 4096);

        this.add(this.blockMap);
        this.add(this.billboards);

        this.bounds = new THREE.Box3(
            new THREE.Vector3(-Infinity, -Infinity, -Infinity),
            new THREE.Vector3( Infinity,  Infinity,  Infinity),
        );
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

const UP = Object.freeze(new THREE.Vector3(0, 1, 0));

async function start() {
    const clock = new THREE.Clock();
    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    document.getElementById("room-render").appendChild(renderer.domElement);

    //

    const editState = {
        layerMode: true,
    };

    // input
    let held = {};
    let pressed = {};

    const mouseButtons = {
        0: "MouseLeft",
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
        held[mouseButtons[event.button] ?? "MouseUnknown"] = false;
    });
    
    window.addEventListener("pointermove", (event) => {
        pointer.set(event.clientX, event.clientY);
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

    const cameraFocus = new THREE.Object3D();

    function makeTexture(image) {
        const texture = new THREE.Texture(image);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        return texture;
    }

    // tileset & designs
    const cursorImage = await loadImage("./assets/cursor.png");
    const cursorTex = makeTexture(cursorImage);
    const nubImage = await loadImage("./assets/nub.png");
    const nubTex = makeTexture(nubImage);
    const cellImage = await loadImage("./assets/cell.png");
    const cellTex = makeTexture(cellImage);
    cellTex.wrapS = THREE.RepeatWrapping;
    cellTex.wrapT = THREE.RepeatWrapping;
    // cellTex.repeat.set(16, 16);
    const tilesImage = await loadImage("./assets/level1.png");
    const tilesTex = makeTexture(tilesImage);

    // level
    const level = new RoomRendering(tilesTex);
    scene.add(level);

    const gridGeo = new THREE.PlaneGeometry(16, 16);
    // gridGeo.rotateX(-Math.PI * .5);
    gridGeo.translate(-.5, .01, -.5);
    const gridMat = new THREE.MeshBasicMaterial({ map: cellTex, alphaTest: .5 });
    // const grid = new THREE.Mesh(gridGeo, gridMat);
    // scene.add(grid2);

    const grid = new GridHelper(16, 16);
    grid.name = "Edit Plane";
    grid.geometry.translate(-.5, 0, -.5);
    grid.geometry.rotateX(-Math.PI * .5);
    grid.material.map = cellTex;
    scene.add(grid);

    const max = 6;
    const sub = 3;

    const types = [...level.blockMap.meshes.keys()];

    // for (let z = 0; z < max; ++z) {
    //     for (let y = 0; y < max; ++y) {
    //         for (let x = 0; x < max; ++x) {
    //             if (Math.random() < y/8) continue;
    //             level.blockMap.setBlockAt(new THREE.Vector3(x-sub, y-sub, z-sub), types[THREE.MathUtils.randInt(0, types.length-1)], THREE.MathUtils.randInt(0, 23), THREE.MathUtils.randInt(0, designCount-1));
    //         }
    //     }
    // }

    camera.position.set(2, 2, 2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    //

    const shadow = new THREE.WebGLRenderTarget(1, 1);
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadow.texture, opacity: .1, transparent: true, color: 0x00000 });

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

    const nubMat = new THREE.MeshBasicMaterial({ map: nubTex, alphaTest: .5 });
    const nub = new THREE.Mesh(cubeGeo, nubMat);
    nub.scale.set(1, 0.1, 1);

    const cursor = new THREE.Object3D();
    cursor.add(cube);
    
    nub.position.set(0, .5, 0);
    cursor.add(nub);

    scene.add(cursor);
    const plane = new THREE.Plane();
    plane.normal.set(0, -1, 0);
    
    const focusTarget = new THREE.Vector3(0, 0.5, 0);
    focusTarget.copy(cameraFocus.position);

    const focus = new THREE.Vector3(0, 0, 0);
    let ortho = undefined;

    level.bounds.max.y = 4;
    function animate(dt) {
        if (pressed["l"]) {
            editState.layerMode = !editState.layerMode;
        }

        const delta = focus.clone().sub(cameraFocus.position);
        cameraFocus.position.add(delta.multiplyScalar(.25+dt));
        cameraFocus.updateMatrixWorld();

        const forward = camera.getWorldDirection(new THREE.Vector3());
        const right = forward.clone().set(1, 0, 0).applyQuaternion(camera.quaternion);

        const vert = Math.abs(UP.dot(forward)) > .3;
        
        if (vert) ortho = forward.y > 0 ? UP : UP.clone().multiplyScalar(-1);
        else ortho = nearestOrthoNormal(forward, ortho ? .75 : 0) ?? ortho;

        if (pressed["="]) focus.add(ortho);
        if (pressed["-"]) focus.sub(ortho);

        level.bounds.min.set(-Infinity, -Infinity, -Infinity);
        level.bounds.max.set( Infinity,  Infinity,  Infinity);

        function clip(primary, inclusive=true) {
            level.bounds.min.set(-Infinity, -Infinity, -Infinity);
            level.bounds.max.set( Infinity,  Infinity,  Infinity);

            if (editState.layerMode) {
                const sign = Math.sign(ortho.x + ortho.y + ortho.z);
                const adjust = (sign > 0 ? 0 : 1) //- (inclusive ? 0 : sign);
                if (sign > 0) primary = !primary;

                const bound = primary ? level.bounds.max : level.bounds.min;

                if (ortho.x !== 0) bound.x = focus.x + adjust;
                if (ortho.y !== 0) bound.y = focus.y + adjust;
                if (ortho.z !== 0) bound.z = focus.z + adjust;
            } 
            
            level.update();
        }

        compMesh.visible = editState.layerMode;

        const norm = getNormalisePointer();
        raycaster.setFromCamera(norm, camera);

        const bounds = new THREE.Box3(
            new THREE.Vector3(-Infinity, -Infinity, -Infinity),
            new THREE.Vector3( Infinity,  Infinity,  Infinity),
        );

        cursor.visible = false;
        nub.visible = false;
        grid.visible = false;

        if (!held["MouseRight"]) {
            if (editState.layerMode) {
                grid.position.copy(focus);
                grid.position.add(ortho.clone().multiplyScalar(.49));
                grid.lookAt(focus);

                plane.setFromNormalAndCoplanarPoint(ortho, grid.position);
                const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
                const block = false;//level.blockMap.raycastBlocks(raycaster, bounds);

                if (block) {
                    cursor.visible = true;
                    cursor.position.copy(block.position);

                    grid.visible = true;
                    if (ortho.x === 0) grid.position.x = cursor.position.x; 
                    if (ortho.y === 0) grid.position.y = cursor.position.y;
                    if (ortho.z === 0) grid.position.z = cursor.position.z;
                } else if (point && point.distanceTo(focus) < 20) {
                    cursor.visible = true;
                    cursor.position.copy(point).sub(ortho.clone().multiplyScalar(.5)).round();

                    grid.visible = true;
                    if (ortho.x === 0) grid.position.x = cursor.position.x; 
                    if (ortho.y === 0) grid.position.y = cursor.position.y;
                    if (ortho.z === 0) grid.position.z = cursor.position.z;
                }

                if (cursor.visible && held["MouseLeft"]) {
                    level.blockMap.setBlockAt(cursor.position, "cube", 0, 0);
                    focus.copy(cursor.position);
                }
            } else {
                const block = level.blockMap.raycastBlocks(raycaster);

                if (block) {
                    cursor.visible = true;
                    cursor.position.copy(block.position);
                    //cursor.position.add(block.normal);

                    const orthoIndex = orthoNormals.findIndex((o) => o.distanceToSquared(block.normal) < 0.1);
                    const quat = orthoOrients[orthoIndex];
                    cursor.rotation.setFromQuaternion(quat);

                    if (pressed["MouseLeft"]) {
                        const pos = cursor.position.clone().add(block.normal);
                        level.blockMap.setBlockAt(pos, "cube", 0, 0);
                    }
                    
                    nub.visible = true;
                }
            }
        }

        if (held["w"]) camera.position.addScaledVector(forward, dt * 7);
        if (held["s"]) camera.position.addScaledVector(forward, dt * -7);
        if (held["a"]) camera.position.addScaledVector(right, dt * -7);
        if (held["d"]) camera.position.addScaledVector(right, dt *  7);
        if (held[" "]) camera.position.addScaledVector(new THREE.Vector3(0, 1, 0), dt *  7);
        if (held["Shift"]) camera.position.addScaledVector(new THREE.Vector3(0, 1, 0), dt *  -7);

        if (held["q"]) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * 1);
        if (held["e"]) camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), dt * -1);

        renderer.autoClear = false;

        level.fog = scene.fog;

        if (editState.layerMode) {
            clip(false, false);
            renderer.setRenderTarget(shadow);
            renderer.clear(true, true, true);
            renderer.render(level, camera);
        }

        clip(true);
        renderer.setRenderTarget(null);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.render(compMesh, compCamera);

        stats.update();
        pressed = {};
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

        if (event.key.includes("Arrow")) event.preventDefault();
    });

    window.addEventListener("keyup", (event) => {
        held[event.key] = false;
    });

    function clearHeld() {
        held = {};
    }

    renderer.domElement.addEventListener("mousemove", (event) => {
        if (held["MouseRight"]) {
            camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), event.movementY * -0.005);
            camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), event.movementX * -0.005);
        }
    });

    renderer.domElement.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    renderer.domElement.addEventListener("wheel", (event) => {
        // if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            if (event.deltaY < 0) {
                focus.add(ortho);
            } else {
                focus.sub(ortho);
            }
        // }
    });

    window.addEventListener("contextmenu", clearHeld);
    window.addEventListener("blur", clearHeld);
}

class GridHelper extends THREE.Mesh {
	constructor(size = 10, divisions = 10, color1 = new THREE.Color("white"), texture) {
		const halfSize = size / 2;

		const vertices = [];
        const colors = [];
        const uvs = [];
        const index = [];

        for (let z = 0; z < divisions; ++z) {
            for (let x = 0; x < divisions; ++x) {
                const dx = Math.abs(x - halfSize);
                const dz = Math.abs(z - halfSize);
                const d = Math.sqrt(dx*dx + dz*dz);

                vertices.push(x - halfSize, 0, z - halfSize);
                colors.push(color1.r, color1.g, color1.b, 1 - Math.min(1, d / (halfSize - 1)));
                uvs.push(z % 2, x % 2);

                if (z > 0 && x > 0) {
                    const v0 = (z - 1) * divisions + x - 1;
                    const v1 = (z - 1) * divisions + x;
                    const v2 = z * divisions + x;
                    const v3 = z * divisions + x - 1;

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

		const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, map: texture, side: THREE.DoubleSide });

		super(geometry, material);

		this.type = 'GridHelper';

	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}
