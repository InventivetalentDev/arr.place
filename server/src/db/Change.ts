import { model, Schema } from "mongoose";
import { IChangeDocument, IChangeModel } from "../typings/db/IChangeDocument";

export const ChangeSchema: Schema<IChangeDocument, IChangeModel> = new Schema(
    {
        x: Number,
        y: Number,
        user: String,
        color: String,
        time: Date
    }
)

export const Change: IChangeModel = model<IChangeDocument, IChangeModel>("Change", ChangeSchema);
