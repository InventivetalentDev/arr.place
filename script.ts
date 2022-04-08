const endpoint = 'http://localho.st:3000';

const mainContainer = document.getElementById('main-container') as HTMLDivElement;
const controlsContainer = document.getElementById('controls-container') as HTMLDivElement;
const colorsContainer = document.getElementById('colors-container') as HTMLDivElement;
const colorPlaceButton = document.getElementById('color-place-button') as HTMLElement;
const colorCancelButton = document.getElementById('color-cancel-button') as HTMLElement;
const camera = document.getElementById('camera') as HTMLDivElement;
const position = document.getElementById('position') as HTMLDivElement;
const zoom = document.getElementById('zoom') as HTMLDivElement;
const selectionContainer = document.getElementById('selection-container') as HTMLDivElement;
const canvasEl = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvasEl.getContext('2d')!;

const ZOOM_FACTOR = 0.005;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 100;

let canvasState: CState = {
    w: 0,
    h: 0,
    c: [],
    sx: 0,
    sy: 0,
    cx: 0,
    cy: 0,
    cz: 1,
    x: 0,
    y: 0
};

let selectedColor = -1;

async function init() {
    const initInfo = await fetch(endpoint + '/hello').then(res => res.json());
    canvasState = { ...canvasState, ...initInfo };
    canvasEl.width = canvasState.w!;
    canvasEl.height = canvasState.h!;

    canvasState.cx = canvasState.w / 2;
    canvasState.cy = canvasState.h / 2;


    for (let colorIndex = 0; colorIndex < canvasState.c.length; colorIndex++) {
        const color = canvasState.c[colorIndex];
        const btn = document.createElement('a');
        btn.classList.add('color-button');
        btn.style.backgroundColor = color;
        colorsContainer.append(btn);

        btn.addEventListener('click', e => {
            e.preventDefault();
            clearSelectedColor();
            selectedColor = colorIndex;
            btn.classList.add('selected-color');
        })
    }


    // canvasState.cx = 500;
    // canvasState.cy = 500;

    // ctx.translate(canvasEl.width / 2, canvasEl.height / 2);
    // ctx.scale(canvasState.cz, canvasState.cz);
    // ctx.translate(-canvasEl.width / 2 + canvasState.cx, -canvasEl.height / 2 + canvasState.cy);

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    updateZoom();
    updatePosition();


    for (let cX = 0; cX < canvasState.w / CHUNK_SIZE; cX++) {
        for (let cY = 0; cY < canvasState.w / CHUNK_SIZE; cY++) {
            loadChunk(cX, cY);
        }
    }

}

const CHUNK_SIZE = 128;

function loadChunk(cX: number, cY: number) {
    fetch(endpoint + `/chunk/${ cX }/${ cY }`)
        .then(res => res.arrayBuffer())
        .then(buf => {
            const data = new Uint8Array(buf);
            for (let x = 0; x < CHUNK_SIZE; x++) {
                for (let y = 0; y < CHUNK_SIZE; y++) {
                    const iX = x + (cX * CHUNK_SIZE);
                    const iY = y + (cY * CHUNK_SIZE);
                    const v = data[(y * CHUNK_SIZE) + x];
                    ctx.fillStyle = canvasState.c[v];
                    ctx.fillRect(iX, iY, 1, 1);
                    if (v > 0) {
                        console.log(v)
                    }
                }
            }
        })
}

function clearSelectedColor() {
    selectedColor = -1;
    document.querySelectorAll('.color-button').forEach(e => e.classList.remove('selected-color'));
}

colorCancelButton.addEventListener('click', e => {
    e.preventDefault();
    clearSelectedColor();
})

async function placeSelectedColor() {
    if (selectedColor < 0) return;
    fetch(endpoint + '/place', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify([canvasState.x, canvasState.y, selectedColor])
    }).then(res => {
        if (res.status === 200) {
            ctx.fillStyle = canvasState.c[selectedColor];
            ctx.fillRect(canvasState.x, canvasState.y, 1, 1);
        }

        clearSelectedColor();
    })
}

colorPlaceButton.addEventListener('click', e => {
    e.preventDefault();
    placeSelectedColor();
})


let dragging = false;
let dragStart = { x: 0, y: 0 }
let dragVsCanvas = { x: 0, y: 0 }

// // https://stackoverflow.com/a/18053642/6257838
// function toCanvasCoords(clientX: number, clientY: number): { x: number, y: number } {
//     // const bodyRect = document.body.getBoundingClientRect();
//     // const canvasRect = canvasEl.getBoundingClientRect();
//     const x = clientX - canvasRect.left +bodyRect.left;
//     const y = clientY - canvasRect.top+bodyRect.top;
//     return { x, y };
// }

function canvasClicked(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    console.log(event);

    const z = 100.0;
    canvasState.x = event.offsetX;
    canvasState.y = event.offsetY;
    // canvasState.x = ((event.offsetX) * z) - ((canvasEl.width / 2) * z);
    // canvasState.y = ((event.offsetY) * z) - ((canvasEl.height / 2) * z);
    canvasState.sx = Math.round((event.offsetX - (canvasEl.width / 2.0))) * z;
    canvasState.sy = Math.round((event.offsetY - (canvasEl.height / 2.0))) * z;
    console.log('click', canvasState.x, canvasState.y);
    updateSelection();

    // ctx.fillStyle = 'blue';
    // ctx.fillRect(canvasState.x, canvasState.y, 1, 1);
}

function scrolled(event: WheelEvent) {


    // const cameraRect = camera.getBoundingClientRect();
    //
    // canvasState.cx += ((cameraRect.left + cameraRect.right) / 2) - (event.x - cameraRect.left);
    // canvasState.cy += ((cameraRect.top + cameraRect.bottom) / 2) - (event.y - cameraRect.top);
    //
    // updatePosition();


    canvasState.cz -= event.deltaY * ZOOM_FACTOR * canvasState.cz;
    canvasState.cz = Math.max(MIN_ZOOM, canvasState.cz);
    canvasState.cz = Math.min(MAX_ZOOM, canvasState.cz);

    updateZoom();

}

function updateSelection() {
    // selectionContainer.style.left = canvasState.x + 'px';
    // selectionContainer.style.top = canvasState.y + 'px';
    selectionContainer.style.transform = `translateX(${ canvasState.sx }px) translateY(${ canvasState.sy }px) scale(100)`;
}

function updateZoom() {
    zoom.style.transform = `scale(${ canvasState.cz }%)`
}

function updatePosition() {
    position.style.transform = `translateX(${ canvasState.cx }px) translateY(${ canvasState.cy }px)`;
    // position.style.transform = `translate3d(${ canvasState.cx }px, ${ canvasState.cy }px, 0)`;
}

canvasEl.addEventListener('click', canvasClicked);
document.addEventListener('wheel', scrolled);

camera.addEventListener('mousedown', (e: MouseEvent) => {
    e.stopPropagation();
    console.log(e.target)
    dragging = true;
    dragStart.x = e.offsetX;
    dragStart.y = e.offsetY;
    console.log('dragStart', dragStart.x, dragStart.y);

    // const canvasPos = canvasEl.getBoundingClientRect();
    // dragVsCanvas.x = e.pageX - canvasPos.left;
    // dragVsCanvas.y = e.pageY - canvasPos.top;
})
camera.addEventListener('mouseup', (e: MouseEvent) => {
    dragging = false;
    // dragVsCanvas.x = 0;
    // dragVsCanvas.y = 0;
})
document.addEventListener('mousemove', (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dragging) {
        // if (!e.movementX || !e.movementY) return;
        // console.log(e.target)
        // console.log('dragMove', dragStart.x, dragStart.y);
        // canvasState.cx -= e.pageX - dragVsCanvas.x;
        // canvasState.cy -= e.pageY - dragVsCanvas.y;
        // e.stopImmediatePropagation()
        const z = canvasState.cz * 0.5;
        // canvasState.cx += (e.offsetX - dragStart.x) * z;
        // canvasState.cy += (e.offsetY - dragStart.y) * z;
        canvasState.cx += e.movementX;
        canvasState.cy += e.movementY;
        // canvasState.cx = Math.max(0, canvasState.cx);
        // canvasState.cy = Math.max(0, canvasState.cy);
        updatePosition();
    }
})

// https://davidwalsh.name/function-debounce / http://underscorejs.org/#debounce
function debounce(func: Function, wait: number, immediate?: boolean) {
    let timeout: any;
    return function () {
        let context = this, args = arguments;
        let later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        let callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

init();

interface CState {
    w: number;
    h: number;
    c: string[];
    sx: number;
    sy: number;
    cx: number;
    cy: number;
    cz: number;
    x: number;
    y: number;
}
