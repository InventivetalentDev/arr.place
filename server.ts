import express, { NextFunction, Request, Response } from "express";
import bodyParser from "body-parser";
import * as fs from "fs";
import { PNG } from "pngjs";
import compression from "compression";
import { createGzip, deflate, inflate } from "zlib";

const app = express()
const port = 3000

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

const CHUNK_SIZE = 128;

const WIDTH = CHUNK_SIZE * 4;
const HEIGHT = CHUNK_SIZE * 4;

// const COLORS = [
//     [255,255,255],
//     [0,0,0],
//     [0,0,170],
//     [0,170,0],
//     [0,170,170],
//     [170,0,0],
//     [170,0,170],
//     [255,170,0],
//     [170,170,170],
//     [85,85,85],
//     [85,85,255],
//     [85,255,85],
//     [85,255,255],
//     [255,85,85],
//     [255,85,255],
//     [255,255,85]
// ];
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

// const CHUNKS: PNG[][] = [[]];
// for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
//     CHUNKS[x] = [];
//     for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
//         CHUNKS[x][y] = new PNG({
//             width: CHUNK_SIZE,
//             height: CHUNK_SIZE,
//             bitDepth: 8
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
for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
    CHUNKS[x] = [];
    for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
        CHUNKS[x][y] = Buffer.alloc(CHUNK_SIZE * CHUNK_SIZE);

        const bufs: Buffer[] = [];
        const f = `data/c_${ x }_${ y }.bin`;
        if (!fs.existsSync(f)) continue;
        const stream = fs.createReadStream(f,'utf8');
        stream.on("data", function (d) {
            bufs.push(d as Buffer)
        });
        stream.on("end", function () {
             inflate(Buffer.concat(bufs),(err,buffer)=>{
                 if (err) {
                     console.error(err);
                 }
                 CHUNKS[x][y] = buffer;
            });
        });
    }
}


app.get('/', async (req: Request, res: Response) => {
    res.send('Hello World!')
})

app.get('/hello', async (req: Request, res: Response) => {
    res.json({
        w: WIDTH,
        h: HEIGHT,
        c: COLORS
    })
});

app.get('/chunk/:x/:y', async (req: Request, res: Response) => {
    const cX = parseInt(req.params['x']);
    const cY = parseInt(req.params['y']);

    if (cX < 0 || cX > WIDTH / CHUNK_SIZE || cY < 0 || cY > HEIGHT / CHUNK_SIZE) {
        res.status(400).end();
        return;
    }

    const chunk = CHUNKS[cX][cY];
    res.header('Content-Type', 'application/octet-stream');
    // chunk.pack().pipe(res);
    res.write(chunk, 'binary');
    res.end();

    // new PNG({
    //     width: CHUNK_SIZE,
    //     height: CHUNK_SIZE,
    //     bitDepth: 8
    // })
});

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

    const iX = x - (cX * CHUNK_SIZE);
    const iY = y - (cY * CHUNK_SIZE);
    const idx = (CHUNK_SIZE * iY + iX) << 2;
    // chunk.data[idx] = clr[0];
    // chunk.data[idx+1] = clr[1];
    // chunk.data[idx+2] = clr[2];
    chunk.writeUInt8(v, (iY * CHUNK_SIZE) + iX);

    console.log(`chunk size ${ cX },${ cY }: ${ chunk.length } bytes`);
    deflate(chunk,(err,buffer)=>{
        if (err) {
            console.error(err);
        }
        console.log(`compressed chunk size ${ cX },${ cY }: ${ buffer.length } bytes`);
        const stream = fs.createWriteStream(`data/c_${ cX }_${ cY }.bin`, 'utf8');
        stream.write(buffer);
        stream.on("end", function () {
            stream.end();
        });
    })
    // chunk.pack().pipe(fs.createWriteStream(`data/c_${ cX }_${ cY }.png`))


    res.end();
});


app.listen(port, () => {
    console.log(`Example app listening on port ${ port }`)
})



