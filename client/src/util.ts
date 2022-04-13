export function isMouseEvent(obj: any): obj is MouseEvent {
    return 'offsetX' in obj;
}

export function isTouchEvent(obj: any): obj is TouchEvent {
    return 'touches' in obj;
}

function getDecimal(n: number): number {
    return n - Math.floor(n);
}

// https://davidwalsh.name/function-debounce / http://underscorejs.org/#debounce
export  function debounce(func: Function, wait: number, immediate?: boolean) {
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

export function hexToRgb(hex): number[] {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ];
}
