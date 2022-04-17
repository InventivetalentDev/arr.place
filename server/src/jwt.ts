import { Request, Response } from "express";
import JWT, { Jwt, JwtPayload } from "jsonwebtoken";
import { v4 as randomUuid } from "uuid";
import { TIMEOUT } from "./data";
import fs from "fs";
import { User } from "./db/User";
import { Maybe, stripUuid, validateOrigin } from "./util";

let jwtPrivateKey;
try {
    jwtPrivateKey = fs.readFileSync('canvas.jwt.priv.key')
} catch (e) {
    console.warn("couldn't read jwt key!", e);
}

export async function verifyJWT(req: Request, res: Response): Promise<JwtPayload | undefined> {
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

export async function applyJWT(req: Request, res: Response, payload?: JwtPayload): Promise<Maybe<string>> {
    if (!payload) return undefined;
    // if (!payload) { //TODO: remove
    //     const userId = randomUuid();
    //     payload = {
    //         sub: userId,
    //         lst: Math.floor(Date.now() / 1000) - TIMEOUT,
    //         cnt: 0,
    //         ip: req.ip,
    //         iss: 'https://arr.place',
    //         jti: randomUuid()
    //     }
    //     console.log('assigned user id', userId, req.ip, req.headers['user-agent']);
    //
    //     const user = new User({
    //         uuid: stripUuid(userId),
    //         created: new Date(),
    //         used: new Date()
    //     });
    //     await user.save();
    // }

    payload['ip'] = req.ip;

    delete payload['exp']; // remove old expiration
    const token = JWT.sign(payload, jwtPrivateKey, {
        expiresIn: '1y'
    })
    res.cookie('access_token', token, {
        domain: '.arr.place',
        maxAge: 31556926000
    });

    return payload.sub!;
}
