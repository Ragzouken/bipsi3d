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

    // camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1 / 1, 0.1, 1000);
    camera.position.setZ(5);

    const cameraFocus = new THREE.Object3D();
    cameraFocus.add(camera);

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
    grid.geometry.translate(-.5, -.5, -.5);
    scene.add(grid);

    const max = 8;
    const sub = 4;

    const types = [...level.blockMap.meshes.keys()];

    for (let z = 0; z < max; ++z) {
        for (let y = 0; y < max; ++y) {
            for (let x = 0; x < max; ++x) {
                if (Math.random() < .4) continue;
                level.blockMap.setBlockAt(new THREE.Vector3(x-sub, y-sub, z-sub), types[THREE.MathUtils.randInt(0, types.length-1)], THREE.MathUtils.randInt(0, 23), THREE.MathUtils.randInt(0, designCount-1));
            }
        }
    }

    camera.position.set(2, 2, 2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    //

    function resize() {
        const w = renderer.domElement.parentElement.clientWidth;
        const h = renderer.domElement.parentElement.clientHeight;
        renderer.setSize(w, h);

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    const up = new THREE.Vector3(0, 1, 0);
    const focusTarget = new THREE.Vector3(0, 0, 0);
    focusTarget.copy(cameraFocus.position);

    level.boundMax.y = 4;
    function animate(dt) {
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

        level.boundMin.y = !above ? Math.floor(cameraFocus.position.y)   : -Infinity;
        level.boundMax.y =  above ? Math.floor(cameraFocus.position.y)+1 :  Infinity;
        grid.position.copy(cameraFocus.position);

        grid.position.y = Math.floor(above ? level.boundMax.y-1 : level.boundMin.y+1);

        level.update();
        renderer.render(scene, camera);

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
