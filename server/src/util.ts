export function stripUuid(uuid: string): string {
    return uuid.replace(/-/g, "");
}

export function addDashesToUuid(uuid: string): string {
    if (uuid.length >= 36) return uuid; // probably already has dashes
    return uuid.substr(0, 8) + "-" + uuid.substr(8, 4) + "-" + uuid.substr(12, 4) + "-" + uuid.substr(16, 4) + "-" + uuid.substr(20);
}

export function hexToRgb(hex): number[] {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ];
}

export function validateOrigin(origin: string): Maybe<string> {
    if (["https://arr.place", "https://arr-place.pages.dev"].includes(origin)) {
        return origin;
    } else if (/https:\/\/[a-z0-9]+\.arr-place\.pages\.dev/m.test(origin as string)) {
        return origin;
    }
    return undefined;
}

export type Maybe<T> = T | undefined | null;
