import { hexToRgb } from "./util";

export const EPOCH_BASE = 1649000000;

export const TIMEOUT = 60;

export const CHUNK_SIZE = 128;

export const MOD_SIZE = 4;
export const USER_SIZE = 16;

export const WIDTH = CHUNK_SIZE * 2;
export const HEIGHT = CHUNK_SIZE * 2;


// const COLORS = [
//     '#FFFFFF',
//     '#000000',
//     '#808080',
//     '#C0C0C0',
//     '#FF0000',
//     '#800000',
//     '#00FF00',
//     '#008000',
//     '#0000FF',
//     '#000080',
//     '#FFFF00',
//     '#808000',
//     '#00FFFF',
//     '#008080',
//     '#FF00FF',
//     '#800080',
// ]
export const COLORS = [
    '#ffffff',
    '#d4d7d9',
    '#898d90',
    '#515252',
    '#000000',
    '#ffb470',
    '#9c6926',
    '#6d482f',
    '#ff99aa',
    '#ff3881',
    '#de107f',
    '#e4abff',
    '#b44ac0',
    '#811e9f',
    '#94b3ff',
    '#6a5cff',
    '#493ac1',
    '#51e9f4',
    '#3690ea',
    '#2450a4',
    '#00ccc0',
    '#009eaa',
    '#00756f',
    '#7eed56',
    '#00cc78',
    '#00a368',
    '#fff8b8',
    '#ffd635',
    '#ffa800',
    '#ff4500',
    '#be0039',
    '#6d001a',
]

export const COLORS_PNG: number[][] = [];



for (let c = 0; c < COLORS.length; c++) {
    COLORS_PNG[c] = hexToRgb(COLORS[c]);
}
