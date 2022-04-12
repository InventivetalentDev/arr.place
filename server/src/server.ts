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
import { CHUNK_SIZE, COLORS, COLORS_PNG, EPOCH_BASE, HEIGHT, MOD_SIZE, TIMEOUT, WIDTH } from "./data";
import { placeLimiter, stateLimiter } from "./ratelimit";
import { applyJWT, verifyJWT } from "./jwt";
import { connectMongo } from "./db/mongo";
import { start } from "repl";
import { Change } from "./db/Change";
import { Maybe, stripUuid } from "./util";
import { User } from "./db/User";
import { AsyncLoadingCache, Caches } from "@inventivetalent/loading-cache";
import { Time } from "@inventivetalent/time";
import { IChangeDocument } from "./typings/db/IChangeDocument";


const app = express()
const port = 3024


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

let state: string[] = [];

const CHUNKS: Buffer[][] = [[]]
const LAST_UPDATES: number[][] = [];

const CHANGE_CACHE: AsyncLoadingCache<number[], Maybe<IChangeDocument>> = Caches.builder()
    .expireAfterWrite(Time.minutes(5))
    .expireAfterAccess(Time.minutes(1))
    .buildAsync<number[], Maybe<IChangeDocument>>((key: number[]) => {
        return Change.findOne({
            x: key[0],
            y: key[1]
        }).exec();
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


async function startup() {
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


    console.log("Loading chunk data...");
    for (let x = 0; x < WIDTH / CHUNK_SIZE; x++) {
        CHUNKS[x] = [];
        LAST_UPDATES[x] = [];
        for (let y = 0; y < HEIGHT / CHUNK_SIZE; y++) {
            CHUNKS[x][y] = Buffer.alloc(CHUNK_SIZE * CHUNK_SIZE + MOD_SIZE);
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
                });
            });
        }
    }
    setTimeout(() => {
        updateState();
    }, 1000);

    {
        console.log("Connecting to mongo...");
        await connectMongo();
    }


    console.log("Registering routes");

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

        await User.updateUsed(stripUuid(userId));

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

        const change = await CHANGE_CACHE.get([x, y]);
        if (!change) {
            res.status(404).end();
            return;
        }
        res.json({
            mod: Math.floor(change.time.getTime() / 1000),
            usr: change.user.substring(8, 8 + 16)
        });
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

        jwtPayload['lst'] = Math.floor(Date.now() / 1000);
        jwtPayload['cnt']++;
        await applyJWT(req, res, jwtPayload);

        const change = new Change({
            x: x,
            y: y,
            color: clr.substring(1).toLowerCase(),
            user: stripUuid(jwtPayload.sub),
            time: new Date()
        });
        await change.save();

        await User.updateUsed(stripUuid(jwtPayload.sub));

        res.json({
            next: Math.floor(Date.now() / 1000) + TIMEOUT
        })
    });


    console.log("Starting!")

    setTimeout(() => {
        app.listen(port, () => {
            console.log(`Example app listening on port ${ port }`)
        })
    }, 500);
}

startup();



