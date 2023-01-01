window.addEventListener("DOMContentLoaded", start);

async function start() {
    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    document.getElementById("room-render").appendChild(renderer.domElement);

    // camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1 / 1, 0.1, 1000);
    camera.position.setZ(5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons.LEFT = -1;
    controls.mouseButtons.MIDDLE = -1;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.enablePan = false;
    controls.rotateSpeed = .5;

    const geometries = {
        ramp: makeGeometry(ramp),
        slab: makeGeometry(slab),
        cube: makeGeometry(cube),
        wedgeHead: makeGeometry(wedgeHead),
        wedgeBody: makeGeometry(wedgeBody),
    };

    // level
    const level = new THREE.Object3D();
    scene.add(level);

    // tileset & designs
    const tilesImage = await loadImage("./assets/level1.png");
    const tilesTex = new THREE.Texture(tilesImage);
    tilesTex.magFilter = THREE.NearestFilter;
    tilesTex.minFilter = THREE.NearestFilter;
    tilesTex.generateMipmaps = false;
    tilesTex.needsUpdate = true;

    const designCount = 16;
    const blockDesignData = new BlockDesignData(8, 4, designCount);
    for (let i = 0; i < designCount; ++i) blockDesignData.setDesignAt(i, randomDesign(undefined, 0));

    const blockMaterial = new THREE.MeshBasicMaterial({ 
        side: THREE.DoubleSide, 
        alphaTest: .5, 
        map: tilesTex,
    });
    blockMaterial.onBeforeCompile = function (shader) {
        blockMaterial.uniforms = shader.uniforms;
        blockShapeShaderFixer(shader);
        shader.uniforms.blockDesigns.value = blockDesignData;
    }

    const spriteMaterial = blockMaterial.clone();

    const cubeCount = 4096;
    const renderers = new Map(Object.entries(geometries).map(([key, geometry]) => [key, new BlockShapeInstances(geometry, blockMaterial, cubeCount)]));
    const blockMap = new BlockMap(renderers);
    const billboards = new BillboardInstances(new THREE.PlaneGeometry(1, 1), spriteMaterial, cubeCount);

    level.add(blockMap);
    level.add(billboards);

    for (let z = 0; z < 15; ++z) {
        for (let x = 0; x < 15; ++x) {
            blockMap.setBlockAt(new THREE.Vector3(x-7, 0, z-7), "slab", THREE.MathUtils.randInt(0, 23), THREE.MathUtils.randInt(0, 15));
        }
    }

    camera.position.set(2, 2, 2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    //

    function resize() {
        const w = renderer.domElement.parentElement.clientWidth;
        const h = renderer.domElement.parentElement.clientHeight;
        renderer.setSize(w, h);

        renderer.setClearColor(new THREE.Color(0, 255, 0));
        renderer.clear();

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    let frame = 0;
    let timer = 0;
    function animate() {
        if (blockMaterial.uniforms) blockMaterial.uniforms.frame.value = frame;
        if (timer == 0) frame = (frame + 1) % 4;
        timer = (timer + 1) % 20;

        billboards.update();
        renderer.render(scene, camera);

        controls.update();
        stats.update();
    };

    function update() {
        resize();
        animate();
        requestAnimationFrame(update);
    }

    update();
}
