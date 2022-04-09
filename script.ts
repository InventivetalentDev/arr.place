const endpoint = 'https://api.arr.place';
// const endpoint = 'http://localho.st:3024'

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
    s: 0,
    sx: 0,
    sy: 0,
    cx: 0,
    cy: 0,
    cz: 0.5,
    x: 0,
    y: 0
};

let selectedColor = -1;

async function init() {
    const initInfo = await fetch(endpoint + '/hello').then(res => res.json());
    canvasState = { ...canvasState, ...initInfo };
    canvasEl.width = canvasState.w!;
    canvasEl.height = canvasState.h!;

    const cameraBounds = camera.getBoundingClientRect();
    const canvasBounds = canvasEl.getBoundingClientRect();
    canvasState.cx = cameraBounds.width / 2 - canvasEl.width / 4;
    canvasState.cy = cameraBounds.height / 2 - canvasEl.height / 4;


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

    updatePosition();
    updateZoom();

    getState();

    for (let cX = 0; cX < canvasState.w / canvasState.s; cX++) {
        for (let cY = 0; cY < canvasState.w / canvasState.s; cY++) {
            // loadChunk(cX, cY);
        }
    }

}

// function loadChunk(cX: number, cY: number) {
//     fetch(endpoint + `/chunk/${ cX }/${ cY }`)
//         .then(res => res.arrayBuffer())
//         .then(buf => {
//             const data = new Uint8Array(buf);
//             for (let x = 0; x < canvasState.s; x++) {
//                 for (let y = 0; y < canvasState.s; y++) {
//                     const iX = x + (cX * canvasState.s);
//                     const iY = y + (cY * canvasState.s);
//                     const v = data[(y * canvasState.s) + x];
//                     ctx.fillStyle = canvasState.c[v];
//                     ctx.fillRect(iX, iY, 1, 1);
//                     if (v > 0) {
//                         console.log(v)
//                     }
//                 }
//             }
//         })
// }

function getState() {
    fetch(endpoint+'/state')
        .then(res=>res.json())
        .then(res=>{
            for (let l of res) {
                const split0 = l.split('_');
                const split1 = split0[2].split('-');
                const x = parseInt(split1[0]);
                const y = parseInt(split1[1]);

                const img = document.createElement('img') as HTMLImageElement;
                img.src = endpoint + '/pngs/' + l;
                img.onload = function () {
                    ctx.drawImage(img, x * canvasState.s, y * canvasState.s);
                };
            }
        })
}

function loadChunk(cX: number, cY: number) {
    const img = document.createElement('img') as HTMLImageElement;
    img.src = endpoint + `/pngs/c_${ cX }_${ cY }.png?t=${Math.floor(Date.now()/1000)}`;
    img.onload = function () {
        ctx.drawImage(img, cX * canvasState.s, cY * canvasState.s);
    };
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

    const bound = (event.target as HTMLElement).getBoundingClientRect();

    const z = 100.0;
    // use clientXY + bound to get a more precise coordinate than offsetXY gives and subtract .5 to always center on the selected pixel
    canvasState.x = Math.round(((event.clientX - bound.x) / canvasState.cz) - .5);
    canvasState.y = Math.round(((event.clientY - bound.y) / canvasState.cz) - .5);

    // scale by canvas scale
    canvasState.sx = canvasState.x * z;
    canvasState.sy = canvasState.y * z;

    // canvasState.sx = Math.round((event.offsetX - (canvasState.w / 2.0))) * z;
    // canvasState.sy = Math.round((event.offsetY - (canvasState.h / 2.0))) * z;
    console.log('click', canvasState.x, canvasState.y);
    console.log(canvasState.sx, canvasState.sy)
    updateSelection();

    // ctx.fillStyle = 'blue';
    // ctx.fillRect(canvasState.x, canvasState.y, 1, 1);
}

function scrolled(event: WheelEvent) {
    // based on https://dev.to/stackfindover/zoom-image-point-with-mouse-wheel-11n3
    const xs = (event.clientX - canvasState.cx) / canvasState.cz;
    const ys = (event.clientY - canvasState.cy) / canvasState.cz;

    canvasState.cz -= event.deltaY * ZOOM_FACTOR * canvasState.cz;
    canvasState.cz = Math.max(MIN_ZOOM, canvasState.cz);
    canvasState.cz = Math.min(MAX_ZOOM, canvasState.cz);

    canvasState.cx = event.clientX - xs * canvasState.cz;
    canvasState.cy = event.clientY - ys * canvasState.cz;

    updatePosition();
    updateZoom();

}

function updateSelection() {
    // selectionContainer.style.left = canvasState.x + 'px';
    // selectionContainer.style.top = canvasState.y + 'px';
    selectionContainer.style.transform = `translateX(${ canvasState.sx }px) translateY(${ canvasState.sy }px) scale(100)`;
    // selectionContainer.style.transform = `translate3d(${canvasState.sx}px, ${canvasState.sy}px, 0) scale(100) `
}

function updateZoom() {
    zoom.style.transform = `scale(${ canvasState.cz }%)`
}

function updatePosition() {
    position.style.transform = `translateX(${ canvasState.cx }px) translateY(${ canvasState.cy }px) scale(1)`;
    // position.style.transform = `translate3d(${ canvasState.cx }px, ${ canvasState.cy }px, 0)`;
}

function getDecimal(n: number): number {
    return n - Math.floor(n);
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
        console.log(canvasState.cx, canvasState.cy)
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
    s: number;
    c: string[];
    sx: number;
    sy: number;
    cx: number;
    cy: number;
    cz: number;
    x: number;
    y: number;
}
