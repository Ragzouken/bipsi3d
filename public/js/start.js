window.addEventListener("DOMContentLoaded", start);

async function start() {
    const stats = new Stats();
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    document.getElementById("room-render").appendChild(renderer.domElement);

    function resize() {
        const w = renderer.domElement.parentElement.clientWidth;
        const h = renderer.domElement.parentElement.clientHeight;
        renderer.setSize(w, h);

        renderer.setClearColor(new THREE.Color(0, 255, 0));
        renderer.clear();
    }

    function update() {
        stats.begin();
        resize();
        stats.end();
        requestAnimationFrame(update);
    }

    update();
}
