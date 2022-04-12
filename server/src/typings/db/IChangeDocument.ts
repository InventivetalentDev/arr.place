import { Document, Model } from "mongoose";


export interface IChangeDocument extends Document {
    x: number;
    y: number;
    user: string;
    color: string;
    time: Date;
}

export interface IChangeModel extends Model<IChangeDocument> {
}
