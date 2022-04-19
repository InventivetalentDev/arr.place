import { Request, Response } from "express";
import axios from "axios";
import { Maybe } from "./util";

import config from "../config.json";

export const CAPTCHA_THRESHOLD = 0.5;

export async function verifyCaptcha(req: Request, res: Response): Promise<Maybe<CaptchaResponse>> {
    const token = req.headers['x-captcha-token'];
    if (!token) return undefined;
    const response = await axios.request({
        method: 'post',
        url: 'https://www.google.com/recaptcha/api/siteverify',
        params: {
            secret: config.captcha.key,
            response: token,
            remoteip: req.ip
        }
    }).then(res => res.data as CaptchaResponse);
    if (response.hostname !== 'arr.place') {
        res.status(400).end();
        return undefined;
    }

    return response;
}

export interface CaptchaResponse {
    success: boolean;
    challenge_ts: string;
    hostname: string;
    score?: number;
    'error-codes'?: string[];
}
