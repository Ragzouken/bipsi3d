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
        this.tilesetCols = 8;

        this.designs = new BlockDesignData(8, 4, designCount);
        for (let i = 0; i < designCount; ++i) this.designs.setDesignAt(i, randomDesign(undefined, 0));

        this.blockMaterial = new BlocksMaterial(this.texture, this.designs);
        this.spriteMaterial = new SpritesMaterial(this.texture);

        this.blockMap = new BlockMap(geometries, this.blockMaterial);
        this.billboards = new BillboardInstances(new THREE.PlaneGeometry(1, 1), this.spriteMaterial, 4096);

        this.add(this.blockMap);
        this.add(this.billboards);

        this.boundMin = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        this.boundMax = new THREE.Vector3( Infinity,  Infinity,  Infinity);
    }

    update() {
        if (this.blockMaterial.uniforms) {
            this.blockMaterial.uniforms.tilesetWidth.value = this.tilesetWidth;
            this.blockMaterial.uniforms.tilesetWidthInv.value = 1/this.tilesetWidth;
            this.blockMaterial.uniforms.tilesetCols.value = this.tilesetCols;
            this.blockMaterial.uniforms.tilesetColsInv.value = 1/this.tilesetCols;

            this.blockMaterial.uniforms.frame.value = this.frame;
            
            this.blockMaterial.uniforms.boundMin.value.copy(this.boundMin);
            this.blockMaterial.uniforms.boundMax.value.copy(this.boundMax);
        }

        // if (this.timer == 0) this.frame = (this.frame + 1) % 4;
        this.timer = (this.timer + 1) % 20;
        this.billboards.update();
    }
}

async function start() {
    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    document.getElementById("room-render").appendChild(renderer.domElement);

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
        held[mouseButtons[event.button] ?? "MouseUnknown"] = true;
    });

    window.addEventListener("pointerup", (event) => {
        held[mouseButtons[event.button] ?? "MouseUnknown"] = false;
    });
    
    window.addEventListener("pointermove", (event) => {
        pointer.set(event.clientX, event.clientY);
    });

    // camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1 / 1, 0.1, 1000);
    camera.position.setZ(5);

    const cameraFocus = new THREE.Object3D();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons.LEFT = -1;
    controls.mouseButtons.MIDDLE = -1;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.enablePan = false;
    controls.rotateSpeed = .5;

    // tileset & designs
    const tilesImage = await loadImage("./assets/level1.png");
    const tilesTex = new THREE.Texture(tilesImage);
    tilesTex.magFilter = THREE.NearestFilter;
    tilesTex.minFilter = THREE.NearestFilter;
    tilesTex.generateMipmaps = false;
    tilesTex.needsUpdate = true;

    // level
    const level = new RoomRendering(tilesTex);
    scene.add(level);

    const grid = new THREE.GridHelper(10, 10);
    grid.name = "Edit Plane";
    grid.geometry.translate(-.5, -.5, -.5);
    scene.add(grid);

    const max = 8;
    const sub = 4;

    const types = [...level.blockMap.meshes.keys()];

    for (let z = 0; z < max; ++z) {
        for (let y = 0; y < max; ++y) {
            for (let x = 0; x < max; ++x) {
                if (Math.random() < y/8) continue;
                level.blockMap.setBlockAt(new THREE.Vector3(x-sub, y-sub, z-sub), types[THREE.MathUtils.randInt(0, types.length-1)], THREE.MathUtils.randInt(0, 23), THREE.MathUtils.randInt(0, designCount-1));
            }
        }
    }

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
    const cubeMat = new THREE.MeshBasicMaterial();
    const cube = new THREE.Mesh(cubeGeo, cubeMat);

    scene.add(cube);
    const plane = new THREE.Plane();
    plane.normal.set(0, -1, 0);
    
    const up = new THREE.Vector3(0, 1, 0);
    const focusTarget = new THREE.Vector3(0, 0.5, 0);
    focusTarget.copy(cameraFocus.position);

    level.boundMax.y = 4;
    function animate(dt) {
        const norm = getNormalisePointer();
        raycaster.setFromCamera(norm, camera);
        const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
        // const [first] = raycaster.intersectObjects([grid], true);

        // if (first) {
        //     //first.point.round();
        //     console.log(point);
        //     cube.position.copy(first.point);
        // }

        if (point) {
            point.round();
            cube.position.copy(point);

            if (held["MouseLeft"]) {
                level.blockMap.delBlockAt(cube.position);
            }
        }

        if (pressed["="]) {
            focusTarget.y += 1;
        }
        if (pressed["-"]) {
            focusTarget.y -= 1;
        }

        const delta = focusTarget.clone().sub(cameraFocus.position);
        cameraFocus.position.add(delta.multiplyScalar(.25+dt));

        cameraFocus.updateMatrixWorld();
        controls.target.copy(cameraFocus.position);

        controls.update();

        const forward = camera.getWorldDirection(new THREE.Vector3());
        const above = up.dot(forward) < 0;

        function clip(above, inclusive=true) {
            const adjust = inclusive ? 0 : 1;
            level.boundMin.y = !above ? Math.floor(focusTarget.y)   + adjust : -Infinity;
            level.boundMax.y =  above ? Math.floor(focusTarget.y)+1 - adjust :  Infinity;
            level.update();
            
            grid.position.copy(focusTarget);
            grid.position.y = Math.floor(above ? level.boundMax.y-1 : level.boundMin.y+1);

            if (inclusive) {
                plane.setFromNormalAndCoplanarPoint(plane.normal, grid.position);
            }
        }

        renderer.autoClear = false;

        clip(!above, false);
        renderer.setRenderTarget(shadow);
        renderer.clear(true, true, true);
        renderer.render(level, camera);

        clip(above);
        renderer.setRenderTarget(null);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.render(compMesh, compCamera);

        stats.update();
        pressed = {};
    };

    let prev;
    function update(timestamp) {
        resize();

        const dt = Math.min((timestamp - (prev ?? timestamp)) / 1000, 1/15);
        prev = timestamp;
        resize();

        animate(dt);

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
