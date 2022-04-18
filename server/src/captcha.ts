import { Request, Response } from "express";
import axios from "axios";

import config from "../config.json";


export async function verifyCaptcha(req: Request, res: Response): Promise<boolean> {
    const token = req.headers['x-captcha-token'];
    if (!token) return false;
    const response = await axios.request({
        method: 'post',
        url: 'https://www.google.com/recaptcha/api/siteverify',
        params: {
            secret: config.captcha.key,
            response: token,
            remoteip: req.ip
        }
    }).then(res => res.data as CaptchaResponse);
    console.log(response);
    if (response.hostname !== 'arr.place') {
        res.status(400).end();
        return false;
    }

    return response.success;
}

interface CaptchaResponse {
    success: boolean;
    challenge_ts: string;
    hostname: string;
    score?: number;
    'error-codes'?: string[];
}
