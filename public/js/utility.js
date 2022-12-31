/**
 * Create an html image from a given src (probably a datauri).
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
 async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", reject);
        image.src = src;
    });
}

async function getCanvasBlob(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob(resolve);
    });
}

/**
 * @param {HTMLElement} element 
 */
function scaleElementToParent(element) {
    const parent = element.parentElement;

    const [tw, th] = [parent.clientWidth, parent.clientHeight];
    const [sw, sh] = [tw / element.clientWidth, th / element.clientHeight];
    let scale = Math.min(sw, sh);
    scale = scale > 1 ? Math.floor(scale) : scale;
    
    element.style.setProperty("transform", `translate(-50%, -50%) scale(${scale})`);

    return scale;
}
