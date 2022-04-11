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
