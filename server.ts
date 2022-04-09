import express, { NextFunction, Request, Response } from "express";
import bodyParser from "body-parser";
import * as fs from "fs";
import { PNG } from "pngjs";
import compression from "compression";
import { createGzip, deflate, inflate } from "zlib";

const app = express()
const port = 3024

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT");
        res.header("Access-Control-Allow-Headers", "X-Requested-With, Accept, Content-Type, Origin");
        res.header("Access-Control-Request-Headers", "X-Requested-With, Accept, Content-Type, Origin");
        return res.sendStatus(200);
    } else {
        return next();
    }
};

app.use(compression());
app.use(corsMiddleware)
app.use(bodyParser.json());

try {
    fs.mkdirSync("data");
} catch (e) {
}

try {
    fs.mkdirSync("pngs");
} catch (e) {
}

const CHUNK_SIZE = 128;

const WIDTH = CHUNK_SIZE * 2;
const HEIGHT = CHUNK_SIZE * 2;


const COLORS = [
    '#ffffff',
    '#000000',
    '#0000AA',
    '#00AA00',
    '#00AAAA',
    '#AA0000',
    '#AA00AA',
    '#FFAA00',
    '#AAAAAA',
    '#555555',
    '#5555FF',
    '#55FF55',
    '#55FFFF',
    '#FF5555',
    '#FF55FF',
    '#FFFF55'
]

const COLORS_PNG = [
    [255, 255, 255],
    [0, 0, 0],
    [0, 0, 170],
    [0, 170, 0],
    [0, 170, 170],
    [170, 0, 0],
    [170, 0, 170],
    [255, 170, 0],
    [170, 170, 170],
    [85, 85, 85],
    [85, 85, 255],
    [85, 255, 85],
    [85, 255, 255],
    [255, 85, 85],
    [255, 85, 255],
    [255, 255, 85]
];


function hexToRgb(hex): number[] {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!;
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ];
}

for (let c = 0; c < COLORS.length; c++) {
    COLORS_PNG[c] = hexToRgb(COLORS[c]);
}



// const CHUNKS: PNG[][] = [[]];
// for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
//     CHUNKS[x] = [];
//     for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
//         CHUNKS[x][y] = new PNG({
//             width: CHUNK_SIZE,
//             height: CHUNK_SIZE,
//             bitDepth: 8,
//             colorType: 2,
//             inputHasAlpha: false
//         })
//         //
//         // const bufs: Buffer[] = [];
//         // const f = `data/c_${ x }_${ y }.bin`;
//         // if (!fs.existsSync(f)) continue;
//         // const stream = fs.createReadStream(f,'utf8');
//         // stream.on("data", function (d) {
//         //     bufs.push(d as Buffer)
//         // });
//         // stream.on("end", function () {
//         //      inflate(Buffer.concat(bufs),(err,buffer)=>{
//         //          if (err) {
//         //              console.error(err);
//         //          }
//         //          CHUNKS[x][y] = buffer;
//         //     });
//         // });
//     }
// }

const CHUNKS: Buffer[][] = [[]]
const LAST_UPDATES: number[][] = [];
for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
    CHUNKS[x] = [];
    LAST_UPDATES[x] = [];
    for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
        CHUNKS[x][y] = Buffer.alloc(CHUNK_SIZE * CHUNK_SIZE);
        LAST_UPDATES[x][y] = Math.floor(Date.now() / 1000);

        const bufs: Buffer[] = [];
        const f = `data/c_${ x }_${ y }.bin`;
        if (!fs.existsSync(f)) continue;
        const stream = fs.createReadStream(f);
        stream.on("data", function (d) {
            bufs.push(d as Buffer)
        });
        stream.on("end", function () {
            inflate(Buffer.concat(bufs), (err, buffer) => {
                if (err) {
                    console.error(err);
                }
                CHUNKS[x][y] = buffer;
            });
        });
    }
}

function savePNG(cX: number, cY: number) {
    const chunk = CHUNKS[cX][cY];
    if (!chunk) return;
    const png = new PNG({
        width: CHUNK_SIZE,
        height: CHUNK_SIZE,
        bitDepth: 8,
        colorType: 2, // color, no alpha
        inputHasAlpha: false,
        bgColor: { red: 0, green: 0, blue: 0 }
    });
    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            const v = chunk.readUint8((y * CHUNK_SIZE) + x)
            // const idx = (CHUNK_SIZE * y + x)<<2;
            const idx = y * (CHUNK_SIZE * 3) + x * 3;
            const clr = COLORS_PNG[v];
            png.data[idx] = clr[0];
            png.data[idx + 1] = clr[1];
            png.data[idx + 2] = clr[2];
        }
    }

    // const gzip = createGzip();
    // pipeline(png.pack(), gzip, fs.createWriteStream(`pngs/c_${ cX }_${ cY }.png`), (err) => {
    //     if (err) {
    //         console.warn(err);
    //     }
    // })

    const t = Math.floor(Date.now() / 1000);
    png.pack().pipe(fs.createWriteStream(`pngs/c_${ cX }-${ cY }_${ t }.png`))
    LAST_UPDATES[cX][cY] = t;
}


app.get('/', async (req: Request, res: Response) => {
    res.send('Hello World!')
})

app.get('/hello', async (req: Request, res: Response) => {
    res.json({
        w: WIDTH,
        h: HEIGHT,
        c: COLORS,
        s: CHUNK_SIZE
    })
});

app.use('/pngs', express.static('pngs'));

// app.get('/chunk/:x/:y', async (req: Request, res: Response) => {
//     const cX = parseInt(req.params['x']);
//     const cY = parseInt(req.params['y']);
//
//     if (cX < 0 || cX > WIDTH / CHUNK_SIZE || cY < 0 || cY > HEIGHT / CHUNK_SIZE) {
//         res.status(400).end();
//         return;
//     }
//
//     const chunk = CHUNKS[cX][cY];
//     res.header('Content-Type', 'application/octet-stream');
//     // chunk.pack().pipe(res);
//     res.write(chunk, 'binary');
//     res.end();
//
//     // new PNG({
//     //     width: CHUNK_SIZE,
//     //     height: CHUNK_SIZE,
//     //     bitDepth: 8
//     // })
// });

app.get('/state', async (req:Request, res:Response) => {
    let list:string[] = [];
    for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
        for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
            list.push(`c_${ x }-${ y }_${ LAST_UPDATES[x][y] }.png`);
        }
    }
    res.json(list);
})

app.put('/place', async (req: Request, res: Response) => {
    if (!req.body || req.body.length !== 3) {
        res.status(400).end();
        return;
    }
    const [x, y, v] = req.body;
    if (x < 0 || y < 0 || x > WIDTH || y > HEIGHT || v < 0 || v > COLORS.length) {
        res.status(400).end();
        return;
    }
    const cX = Math.floor(x / CHUNK_SIZE);
    const cY = Math.floor(y / CHUNK_SIZE);
    const chunk = CHUNKS[cX][cY];

    const clr = COLORS[v];
    console.log(clr);

    const iX = x - (cX * CHUNK_SIZE);
    const iY = y - (cY * CHUNK_SIZE);
    const idx = (CHUNK_SIZE * iY + iX) << 2;
    // chunk.data[idx] = clr[0];
    // chunk.data[idx+1] = clr[1];
    // chunk.data[idx+2] = clr[2];
    chunk.writeUInt8(v, (iY * CHUNK_SIZE) + iX);

    console.log(`chunk size ${ cX },${ cY }: ${ chunk.length } bytes`);
    deflate(chunk, (err, buffer) => {
        if (err) {
            console.error(err);
        }
        console.log(`compressed chunk size ${ cX },${ cY }: ${ buffer.length } bytes`);
        const stream = fs.createWriteStream(`data/c_${ cX }_${ cY }.bin`);
        stream.write(buffer);
        stream.on("end", function () {
            stream.end();
        });
    })
    // chunk.pack().pipe(fs.createWriteStream(`data/c_${ cX }_${ cY }.png`))

    savePNG(cX, cY);

    res.end();
});


app.listen(port, () => {
    console.log(`Example app listening on port ${ port }`)
})



