const endpoint = 'https://y.arr.place';

const mainContainer = document.getElementById('main-container') as HTMLDivElement;
const controlsContainer = document.getElementById('controls-container') as HTMLDivElement;
const colorsContainer = document.getElementById('colors-container') as HTMLDivElement;
const colorPlaceButton = document.getElementById('color-place-button') as HTMLElement;
const colorCancelButton = document.getElementById('color-cancel-button') as HTMLElement;
const timerContainer = document.getElementById('timer-container') as HTMLElement;
const positionInfo = document.getElementById('position-info') as HTMLElement;
const timer = document.getElementById('timer') as HTMLElement;
const camera = document.getElementById('camera') as HTMLDivElement;
const position = document.getElementById('position') as HTMLDivElement;
const zoom = document.getElementById('zoom') as HTMLDivElement;
const selectionContainer = document.getElementById('selection-container') as HTMLDivElement;
const canvasEl = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvasEl.getContext('2d')!;

const ZOOM_FACTOR = 0.001;
const ZOOM_FACTOR_TOUCH = 0.01
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
    y: 0,
    n: 0
};

let selectedColor = -1;
let ticker: any = -1;

async function init() {
    const storedState = localStorage.getItem('canvas_state');
    if (storedState) {
        canvasState = { ...canvasState, ...JSON.parse(storedState) };
    }


    let initInfo;
    try {
        initInfo = await fetch(endpoint + '/hello', {
            credentials: 'include',
        }).then(res => res.json());
    } catch (e) {
        console.warn(e);
        setTimeout(() => init(), 5000);
        return;
    }
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
            colorPlaceButton.removeAttribute('disabled')
            colorCancelButton.removeAttribute('disabled')
            selectionContainer.style.backgroundColor = color;
            btn.classList.add('selected-color');
        })
    }

    const params = new URLSearchParams(location.search);
    if (params.has('cx')) {
        canvasState.cx = parseInt(params.get('cx') as string);
    }
    if (params.has('cy')) {
        canvasState.cy = parseInt(params.get('cy') as string);
    }
    if (params.has('cz')) {
        canvasState.cz = parseInt(params.get('cz') as string);
    }
    if (params.has('x')) {
        canvasState.x = parseInt(params.get('x') as string);
        canvasState.sx = canvasState.x * 100;
    }
    if (params.has('y')) {
        canvasState.y = parseInt(params.get('y') as string);
        canvasState.sy = canvasState.y * 100;
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
    updateSelection();

    updateTimeout();

    getState();

    for (let cX = 0; cX < canvasState.w / canvasState.s; cX++) {
        for (let cY = 0; cY < canvasState.w / canvasState.s; cY++) {
            // loadChunk(cX, cY);
        }
    }

    localStorage.setItem('canvas_state', JSON.stringify(canvasState));
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

let lastState: string[] = [];

function getState() {
    fetch(endpoint + '/state', {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(res => {
            for (let l of res) {
                if (lastState.indexOf(l) !== -1) {
                    continue;
                }
                lastState.push(l);

                const split0 = l.split('_');
                const split1 = split0[2].split('-');
                const x = parseInt(split1[0]);
                const y = parseInt(split1[1]);

                const img = document.createElement('img') as HTMLImageElement;
                img.src = endpoint + '/pngs/' + l;
                img.onload = function () {
                    ctx.drawImage(img, x * canvasState.s, y * canvasState.s);
                    setTimeout(() => {
                        img.remove();
                    }, 10000);
                };
                img.style.display = 'none';
                document.body.append(img);
            }

            localStorage.setItem('canvas_state', JSON.stringify(canvasState));

            setTimeout(() => getState(), 1000);

            if (lastState.length > 50) {
                lastState.shift();
            }
        })
        .catch(err => {
            console.warn(err);
            setTimeout(() => getState(), 5000);
        })
}

function clearSelectedColor() {
    selectedColor = -1;
    document.querySelectorAll('.color-button').forEach(e => e.classList.remove('selected-color'));
    colorPlaceButton.setAttribute('disabled', '')
    colorCancelButton.setAttribute('disabled', '')
    selectionContainer.style.backgroundColor = 'transparent';
}

colorCancelButton.addEventListener('click', e => {
    e.preventDefault();
    clearSelectedColor();
})

async function placeSelectedColor() {
    if (selectedColor < 0) return;
    if (Math.floor(Date.now() / 1000) < canvasState.n) return;
    fetch(endpoint + '/place', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-User': canvasState.u!
        },
        credentials: 'include',
        body: JSON.stringify([canvasState.x, canvasState.y, selectedColor])
    }).then(res => {
        if (res.status === 200) {
            ctx.fillStyle = canvasState.c[selectedColor];
            ctx.fillRect(canvasState.x, canvasState.y, 1, 1);
        }

        clearSelectedColor();
        return res.json();
    }).then(json => {

        if (json.next) {
            canvasState.n = json.next;

        }

        updateTimeout();

        localStorage.setItem('canvas_state', JSON.stringify(canvasState));
    })
}

function updateTimeout() {
    clearInterval(ticker);
    const diff = canvasState.n - Math.floor(Date.now() / 1000);
    if (diff <= 0) return;

    controlsContainer.style.display = 'none';
    setTimeout(() => {
        if(canvasState.sx>=0&&canvasState.sy>=0) {
            controlsContainer.style.display = 'block';
        }
    }, Math.ceil((canvasState.n - (Date.now() / 1000)) * 1000) + 100);

    ticker = setInterval(() => tickTimer(), 1000);
    timer.textContent = '00:00';
    tickTimer();
    timerContainer.style.display = 'block';
}

function tickTimer() {
    const diff = canvasState.n - Math.floor(Date.now() / 1000);
    if (diff <= 0) {
        clearInterval(ticker);
        timerContainer.style.display = 'none';
        return;
    }
    const m = Math.floor(diff / 60);
    const s = diff - m * 60;
    timer.textContent = `${ pad(`${ m }`, 2) }:${ pad(`${ s }`, 2) }`
}

function pad(s, l) {
    while (s.length < l) {
        s = "0" + s;
    }
    return s;
}


colorPlaceButton.addEventListener('click', e => {
    e.preventDefault();
    placeSelectedColor();
})


let dragging = false;
let dragStart = { x: 0, y: 0 }
let dragVsCanvas = { x: 0, y: 0 }
let pinching = false;

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
    updateSelection();


    const diff = canvasState.n - Math.floor(Date.now() / 1000);
    if (diff <= 0) {
        controlsContainer.style.display = 'block';
    }

    // ctx.fillStyle = 'blue';
    // ctx.fillRect(canvasState.x, canvasState.y, 1, 1);

    updateSearchParams();
}

function outsideCanvasClicked(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    console.log(event);
    if (event.composedPath().indexOf(canvasEl) !== -1 || event.composedPath().indexOf(controlsContainer) !== -1) {
        return;
    }

    canvasState.sx = -1;
    canvasState.sy = -1;

    controlsContainer.style.display = 'none';

    updateSelection();
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

    afterZoomChange();
}

function afterZoomChange() {
    updatePosition();
    updateZoom();

    updateSearchParams();
}

function updateSelection() {
    // selectionContainer.style.left = canvasState.x + 'px';
    // selectionContainer.style.top = canvasState.y + 'px';
    if (canvasState.sx >= 0 && canvasState.sy >= 0) {
        selectionContainer.style.display = 'block';
        selectionContainer.style.transform = `translateX(${ canvasState.sx }px) translateY(${ canvasState.sy }px) scale(100)`;
    }else{
        selectionContainer.style.display = 'none';
    }
    // selectionContainer.style.transform = `translate3d(${canvasState.sx}px, ${canvasState.sy}px, 0) scale(100) `
    updatePositionInfo()
}

function updateZoom() {
    zoom.style.transform = `scale(${ canvasState.cz }%)`
    updatePositionInfo();
}

function updatePosition() {
    position.style.transform = `translateX(${ canvasState.cx }px) translateY(${ canvasState.cy }px) scale(1)`;
    // position.style.transform = `translate3d(${ canvasState.cx }px, ${ canvasState.cy }px, 0)`;
    updatePositionInfo()
}

function updatePositionInfo() {
    positionInfo.innerHTML = `${ Math.round(canvasState.cx) },${ Math.round(canvasState.cy) }@${ Math.round(canvasState.cz) }<br/>${ Math.round(canvasState.x) },${ Math.round(canvasState.y) }`
}

function getDecimal(n: number): number {
    return n - Math.floor(n);
}

canvasEl.addEventListener('click', canvasClicked);
document.addEventListener('click', outsideCanvasClicked)
document.addEventListener('wheel', scrolled);

function mouseDown(e: MouseEvent | TouchEvent) {
    e.stopPropagation();
    dragging = true;
    if (isMouseEvent(e)) {
        dragStart.x = e.offsetX;
        dragStart.y = e.offsetY;
    }
    if (isTouchEvent(e)) {
        pinching = e.touches.length === 2;
        if (pinching) {
            onPinch(e);
        }
        dragStart.x = e.touches[0].clientX;
        dragStart.y = e.touches[0].clientY;
    }

    // const canvasPos = canvasEl.getBoundingClientRect();
    // dragVsCanvas.x = e.pageX - canvasPos.left;
    // dragVsCanvas.y = e.pageY - canvasPos.top;
}

camera.addEventListener('mousedown', mouseDown)
camera.addEventListener('touchstart', mouseDown);

function mouseUp(e: MouseEvent | TouchEvent) {
    dragging = false;
    pinching = false;
    lastTouch = undefined;
    lastDist = 0;
    // dragVsCanvas.x = 0;
    // dragVsCanvas.y = 0;

    updateSearchParams();
}

camera.addEventListener('mouseup', mouseUp);
camera.addEventListener('touchend', mouseUp);

let lastTouch: any = undefined;

function mouseMove(e: MouseEvent | TouchEvent) {
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
        if (isMouseEvent(e)) {
            canvasState.cx += e.movementX;
            canvasState.cy += e.movementY;
        }
        if (isTouchEvent(e)) {
            pinching = e.touches.length === 2;
            if (pinching) {
                onPinch(e);
            }
            if (lastTouch) {
                canvasState.cx += e.touches[0].clientX - lastTouch.x;
                canvasState.cy += e.touches[0].clientY - lastTouch.y;
            }

            lastTouch = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };

        }
        // canvasState.cx = Math.max(0, canvasState.cx);
        // canvasState.cy = Math.max(0, canvasState.cy);
        updatePosition();
    }
}

let lastDist: any = undefined;

function onPinch(e: TouchEvent) {
    // https://stackoverflow.com/a/11183333/6257838
    // let dist = Math.hypot(
    //     e.touches[0].pageX - e.touches[1].pageX,
    //     e.touches[0].pageY - e.touches[1].pageY
    // );
    let dist = Math.sqrt(Math.pow(e.touches[1].clientX - e.touches[0].clientX, 2) + Math.pow(e.touches[1].clientY - e.touches[0].clientY, 2));

    if (!lastDist) {
        lastDist = dist;
    }

    let scale = (dist / lastDist);

    const xs = (e.touches[0].clientX - canvasState.cx) / canvasState.cz;
    const ys = (e.touches[0].clientY - canvasState.cy) / canvasState.cz;

    canvasState.cz *= scale;
    canvasState.cz = Math.max(MIN_ZOOM, canvasState.cz);
    canvasState.cz = Math.min(MAX_ZOOM, canvasState.cz);

    canvasState.cx = e.touches[0].clientX - xs * canvasState.cz;
    canvasState.cy = e.touches[0].clientY - ys * canvasState.cz;

    lastDist = dist;

    afterZoomChange();
}

document.addEventListener('mousemove', mouseMove);
document.addEventListener('touchmove', mouseMove);

function updateSearchParams() {
    const params = new URLSearchParams(location.search);
    params.set('cx', `${ Math.round(canvasState.cx) }`);
    params.set('cy', `${ Math.round(canvasState.cy) }`);
    params.set('cz', `${ Math.round(canvasState.cz) }`);
    params.set('x', `${ Math.round(canvasState.x) }`);
    params.set('y', `${ Math.round(canvasState.y) }`);
    history.pushState(null, '', location.pathname + '?' + params.toString());
}

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

function isMouseEvent(obj: any): obj is MouseEvent {
    return 'offsetX' in obj;
}

function isTouchEvent(obj: any): obj is TouchEvent {
    return 'touches' in obj;
}

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
    n: number;
    u?: string;
}
