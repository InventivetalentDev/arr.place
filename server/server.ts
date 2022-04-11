import express, { NextFunction, Request, Response } from "express";
import bodyParser from "body-parser";
import * as fs from "fs";
import { PNG } from "pngjs";
import compression from "compression";
import { createGzip, deflate, inflate } from "zlib";
import rateLimit from "express-rate-limit";
import { v4 as randomUuid } from "uuid";
import JWT, { Jwt, JwtPayload } from "jsonwebtoken";
import cookieParser from "cookie-parser";

const jwtPrivateKey = fs.readFileSync('canvas.jwt.priv.key');

const app = express()
const port = 3024

const EPOCH_BASE = 1649000000;
const VERSION = Math.floor(Date.now() / 1000) - EPOCH_BASE;
console.log('version', VERSION);

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', 'https://arr.place');
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === 'OPTIONS') {
        res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT");
        res.header("Access-Control-Allow-Headers", "X-Requested-With, Accept, Content-Type, Origin, X-User");
        res.header("Access-Control-Request-Headers", "X-Requested-With, Accept, Content-Type, Origin, X-User");
        return res.sendStatus(200);
    } else {
        return next();
    }
};

app.set('trust proxy', 1)
app.use(compression());
app.use(corsMiddleware)
app.use(cookieParser())
app.use(bodyParser.json());

try {
    fs.mkdirSync("data");
} catch (e) {
}

try {
    fs.mkdirSync("pngs");
} catch (e) {
}

const TIMEOUT = 60;

const CHUNK_SIZE = 128;

const MOD_SIZE = 4;
const USER_SIZE = 16;

const WIDTH = CHUNK_SIZE * 2;
const HEIGHT = CHUNK_SIZE * 2;


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
const COLORS = [
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

const COLORS_PNG: number[][] = [];


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


let state: string[] = [];

const CHUNKS: Buffer[][] = [[]]
const LAST_UPDATES: number[][] = [];
const LAST_USERS: string[][] = [];
for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
    CHUNKS[x] = [];
    LAST_UPDATES[x] = [];
    LAST_USERS[x] = [];
    for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
        CHUNKS[x][y] = Buffer.alloc(CHUNK_SIZE * CHUNK_SIZE + MOD_SIZE + USER_SIZE);
        LAST_UPDATES[x][y] = Math.floor(Date.now() / 1000);

        const bufs: Buffer[] = [];
        const f = `data/c_${ x }_${ y }.bin`;
        if (!fs.existsSync(f)) continue;
        fs.copyFileSync(f, f + '.' + (Math.floor(Date.now() / 1000)) + '.bck'); // backup
        const stream = fs.createReadStream(f);
        stream.on("data", (d) => {
            bufs.push(d as Buffer)
        });
        stream.on("end", () => {
            inflate(Buffer.concat(bufs), (err, buffer) => {
                if (err) {
                    console.error(err);
                }
                CHUNKS[x][y] = buffer;
                if (buffer.length > CHUNK_SIZE * CHUNK_SIZE) {
                    try {
                        const t = buffer.readUint32LE(CHUNK_SIZE * CHUNK_SIZE); // modified time
                        LAST_UPDATES[x][y] = EPOCH_BASE + t;
                    } catch (e) {
                        console.warn(e);
                    }
                }
                if (buffer.length > CHUNK_SIZE * CHUNK_SIZE + MOD_SIZE) {
                    try {
                        const u = buffer.toString('hex', CHUNK_SIZE * CHUNK_SIZE + MOD_SIZE, CHUNK_SIZE * CHUNK_SIZE + MOD_SIZE + USER_SIZE); // user
                        LAST_USERS[x][y] = u;
                    } catch (e) {
                        console.warn(e);
                    }
                }
            });
        });
    }
}
setTimeout(() => {
    updateState();
}, 1000);


const placeLimiter = rateLimit({
    windowMs: TIMEOUT * 1000,
    max: 1,
    standardHeaders: true,
    legacyHeaders: true
});
const stateLimiter = rateLimit({
    windowMs: 20 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: true
})

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

    const t = Math.floor(Date.now() / 1000);
    png.pack().pipe(fs.createWriteStream(`pngs/c_${ t }_${ cX }-${ cY }.png`))
    LAST_UPDATES[cX][cY] = t;
}

function updateState() {
    state = [];
    for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
        for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
            state.push(`c_${ LAST_UPDATES[x][y] }_${ x }-${ y }.png`);
        }
    }
}

app.get('/', async (req: Request, res: Response) => {
    res.send('Hello World!')
})

app.get('/hello', stateLimiter, async (req: Request, res: Response) => {
    let jwtPayload;
    try {
        jwtPayload = await verifyJWT(req, res);
    } catch (e) {
        console.warn(e);
        res.status(403).end();
        return;
    }
    const userId = await applyJWT(req, res, jwtPayload);

    console.log('hello', userId, req.ip)

    res.json({
        w: WIDTH,
        h: HEIGHT,
        c: COLORS,
        s: CHUNK_SIZE,
        u: userId,
        v: VERSION
    })
});

app.use('/pngs', express.static('pngs'));


app.get('/state', stateLimiter, async (req: Request, res: Response) => {
    let jwtPayload;
    try {
        jwtPayload = await verifyJWT(req, res);
    } catch (e) {
        console.warn(e);
        res.status(403).end();
        return;
    }
    if (!jwtPayload) {
        res.status(403).end();
        return;
    }
    await applyJWT(req, res, jwtPayload);

    let list: string[] = state;
    res.header('Cache-Control', 'max-age=1')
    res.json(list);
})

app.get('/info/:x/:y', async (req: Request, res: Response) => {
    const x = parseInt(req.params['x']);
    const y = parseInt(req.params['y']);
    if (x < 0 || y < 0 || x > WIDTH || y > HEIGHT) {
        res.status(400).end();
        return;
    }

    res.json({
        mod: LAST_UPDATES[x][y],
        usr: LAST_USERS[x][y]?.substring(8, 8 + 16),
    })
})

app.put('/place', placeLimiter, async (req: Request, res: Response) => {
    if (!req.body || req.body.length !== 3) {
        res.status(400).end();
        return;
    }

    let jwtPayload;
    try {
        jwtPayload = await verifyJWT(req, res);
    } catch (e) {
        console.warn(e);
        res.status(403).end();
        return;
    }
    if (!jwtPayload) {
        res.status(403).end();
        return;
    }
    if (!req.headers['x-user']) {
        res.status(400).end();
        return;
    }

    console.log('place', jwtPayload.sub, req.ip)

    if (req.headers['x-user'] !== jwtPayload.sub) {
        res.status(403).end();
        console.warn("user id mismatch! header:" + req.headers['x-user'] + ", token: " + jwtPayload.sub);
        return;
    }

    const [x, y, v] = req.body;
    if (x < 0 || y < 0 || x > WIDTH || y > HEIGHT || v < 0 || v > COLORS.length) {
        res.status(400).end();
        return;
    }

    if (Math.floor(Date.now() / 1000) - jwtPayload['lst'] < TIMEOUT) {
        console.warn("place too soon", req.ip);
        return res.status(429).end();
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
    chunk.writeUint32LE(Math.floor(Date.now() / 1000) - EPOCH_BASE, CHUNK_SIZE * CHUNK_SIZE); // modified time
    chunk.write(stripUuid(jwtPayload.sub), CHUNK_SIZE * CHUNK_SIZE + MOD_SIZE, 'hex'); // user

    console.log(`chunk size ${ cX },${ cY }: ${ chunk.length } bytes`);
    deflate(chunk, (err, buffer) => {
        if (err) {
            console.error(err);
        }
        console.log(`compressed chunk size ${ cX },${ cY }: ${ buffer.length } bytes`);
        const stream = fs.createWriteStream(`data/c_${ cX }_${ cY }.bin`);
        stream.write(buffer);
        stream.on("end", () => {
            stream.end();
        });
    })
    // chunk.pack().pipe(fs.createWriteStream(`data/c_${ cX }_${ cY }.png`))

    savePNG(cX, cY);
    updateState();

    LAST_USERS[cX][cY] = stripUuid(jwtPayload.sub);

    jwtPayload['lst'] = Math.floor(Date.now() / 1000);
    jwtPayload['cnt']++;
    await applyJWT(req, res, jwtPayload);

    res.json({
        next: Math.floor(Date.now() / 1000) + TIMEOUT
    })
});

async function verifyJWT(req: Request, res: Response): Promise<JwtPayload | undefined> {
    const existingCookie = req.cookies?.['access_token'];
    if (existingCookie) {
        const verifyPromise = new Promise<Jwt>((resolve, reject) => {
            JWT.verify(existingCookie, jwtPrivateKey, {
                issuer: 'https://arr.place',
                maxAge: '1y',
                complete: true
            }, (err, jwt) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!jwt) {
                    reject(new Error('invalid JWT'));
                    return;
                }
                resolve(jwt);
            })
        });
        const jwt = await verifyPromise;
        if (!jwt || !jwt.payload.sub || !jwt.payload['jti'] || !jwt.payload['lst'] || !('cnt' in (jwt.payload as JwtPayload))) {
            res.status(400);
            throw new Error('invalid JWT');
        }

        if (jwt.payload['ip'] !== req.ip) {
            console.log(jwt.payload.sub + " changed ip " + jwt.payload['ip'] + " -> " + req.ip);
        }

        return jwt.payload as JwtPayload;
    }
    return undefined;
}

async function applyJWT(req: Request, res: Response, payload?: JwtPayload): Promise<string> {
    if (!payload) {
        const userId = randomUuid();
        payload = {
            sub: userId,
            lst: Math.floor(Date.now() / 1000) - TIMEOUT,
            cnt: 0,
            ip: req.ip,
            iss: 'https://arr.place',
            jti: randomUuid()
        }
        console.log('assigned user id', userId, req.ip, req.headers['user-agent']);
    }

    payload['ip'] = req.ip;

    delete payload['exp']; // remove old expiration
    const token = JWT.sign(payload, jwtPrivateKey, {
        expiresIn: '1y'
    })
    res.cookie('access_token', token, {
        domain: '.arr.place',
        secure: true,
        maxAge: 31556926000
    })

    return payload.sub!;
}


export function stripUuid(uuid: string): string {
    return uuid.replace(/-/g, "");
}

export function addDashesToUuid(uuid: string): string {
    if (uuid.length >= 36) return uuid; // probably already has dashes
    return uuid.substr(0, 8) + "-" + uuid.substr(8, 4) + "-" + uuid.substr(12, 4) + "-" + uuid.substr(16, 4) + "-" + uuid.substr(20);
}

setTimeout(() => {
    app.listen(port, () => {
        console.log(`Example app listening on port ${ port }`)
    })
}, 1000);



