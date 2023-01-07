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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons.LEFT = -1;
    controls.mouseButtons.MIDDLE = -1;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.enablePan = false;
    controls.rotateSpeed = .5;

    // const controls = new FlyControls(camera, renderer.domElement);
    // controls.dragToLook = true;

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
    const tilesImage = await loadImage("./assets/level1.png");
    const tilesTex = makeTexture(tilesImage);

    // level
    const level = new RoomRendering(tilesTex);
    scene.add(level);

    const grid = new GridHelper(16, 16);
    grid.name = "Edit Plane";
    grid.geometry.translate(-.5, 0, -.5);
    scene.add(grid);

    const max = 8;
    const sub = 4;

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
    cube.scale.multiplyScalar(1.01);

    scene.add(cube);
    const plane = new THREE.Plane();
    plane.normal.set(0, -1, 0);
    
    const up = new THREE.Vector3(0, 1, 0);
    const focusTarget = new THREE.Vector3(0, 0.5, 0);
    focusTarget.copy(cameraFocus.position);

    level.bounds.max.y = 4;
    function animate(dt) {
        if (pressed["="]) {
            focusTarget.y += 1;
        }
        if (pressed["-"]) {
            focusTarget.y -= 1;
        }
        if (pressed["l"]) {
            editState.layerMode = !editState.layerMode;
        }

        const delta = focusTarget.clone().sub(cameraFocus.position);
        cameraFocus.position.add(delta.multiplyScalar(.25+dt));

        cameraFocus.updateMatrixWorld();
        //controls.target.copy(cameraFocus.position);

        controls.update(dt);

        const forward = camera.getWorldDirection(new THREE.Vector3());
        const above = up.dot(forward) < 0;

        function clip(above, inclusive=true) {
            if (editState.layerMode) {
                const adjust = inclusive ? 0 : 1;
                level.bounds.min.y = !above ? Math.floor(focusTarget.y)   + adjust : -Infinity;
                level.bounds.max.y =  above ? Math.floor(focusTarget.y)+1 - adjust :  Infinity;
            } else {
                level.bounds.min.y = -Infinity;
                level.bounds.max.y =  Infinity;
            }
            level.update();
        
            // grid.position.copy(focusTarget);
            grid.position.y = focusTarget.y + (above ? -.5 : .5);
        }

        renderer.autoClear = false;

        if (editState.layerMode) {
            clip(!above, false);
            renderer.setRenderTarget(shadow);
            renderer.clear(true, true, true);
            renderer.render(level, camera);
        }

        clip(above);
        renderer.setRenderTarget(null);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.render(compMesh, compCamera);

        compMesh.visible = editState.layerMode;

        const norm = getNormalisePointer();
        raycaster.setFromCamera(norm, camera);

        const bounds = new THREE.Box3(
            new THREE.Vector3(-Infinity, -Infinity, -Infinity),
            new THREE.Vector3( Infinity,  Infinity,  Infinity),
        );

        cube.visible = false;
        grid.visible = false;

        if (editState.layerMode) {
            if (above) {
                bounds.min.y = grid.position.y + 0;
                bounds.max.y = grid.position.y + 1;
            } else {
                bounds.min.y = grid.position.y - 1;
                bounds.max.y = grid.position.y + 0;
            }

            plane.setFromNormalAndCoplanarPoint(plane.normal, grid.position);
            const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
            const block = level.blockMap.raycastBlocks(raycaster, bounds);

            if (block) {
                cube.visible = true;
                cube.position.copy(block.position);

                grid.visible = true;
                grid.position.x = cube.position.x;
                grid.position.z = cube.position.z;
            } else if (point && point.distanceTo(focusTarget) < 20) {
                cube.visible = true;
                cube.position.copy(point);
                cube.position.y += above ? .5 : -.5;
                cube.position.round();

                grid.visible = true;
                grid.position.x = cube.position.x;
                grid.position.z = cube.position.z;
            }
        } else {
            const block = level.blockMap.raycastBlocks(raycaster);

            if (block) {
                cube.visible = true;
                cube.position.copy(block.position);
                cube.position.add(block.normal);

                const orthoIndex = orthoNormals.findIndex((o) => o.distanceToSquared(block.normal) < 0.1);
                const quat = orthoOrients[orthoIndex];
                cube.rotation.setFromQuaternion(quat);
            }
        }

        if (cube.visible && pressed["MouseLeft"]) {
            level.blockMap.setBlockAt(cube.position, "cube", 0, 0);
            // focusTarget.copy(cube.position);
        }

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

    window.addEventListener("blur", (event) => {
        held = {};
    });
}

class GridHelper extends THREE.LineSegments {
	constructor(size = 10, divisions = 10, color1 = new THREE.Color("black")) {
		const halfSize = size / 2;

		const vertices = [];
        const colors = [];
        const index = [];

        for (let z = 0; z < divisions; ++z) {
            for (let x = 0; x < divisions; ++x) {
                const dx = Math.abs(x - halfSize);
                const dz = Math.abs(z - halfSize);
                const d = Math.sqrt(dx*dx + dz*dz);

                vertices.push(x - halfSize, 0, z - halfSize);
                colors.push(color1.r, color1.g, color1.b, 1 - Math.min(1, d / (halfSize - 1)));

                if (z > 0) {
                    index.push((z - 1) * divisions + x - 1, (z * divisions) + x);
                }
                
                if (x > 0) {
                    index.push(z * divisions + x - 1, (z * divisions) + x);
                }
            }
        }

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
        geometry.setIndex(index);

		const material = new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true });

		super(geometry, material);

		this.type = 'GridHelper';

	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}
