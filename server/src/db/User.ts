import { model, Schema } from "mongoose";
import { IUserDocument, IUserModel } from "../typings/db/IUserDocument";

export const UserSchema: Schema<IUserDocument, IUserModel> = new Schema(
    {
        uuid: {
            type: String,
            index: true,
            unique: true
        },
        name: String,
        created: Date,
        used: Date
    }
)

UserSchema.statics.findForUuid = function (this: IUserModel, uuid: string): Promise<IUserDocument | null> {
    return this.findOne({
        uuid: uuid
    }).exec();
}

UserSchema.statics.updateUsed = function (this: IUserModel, uuid: string, date: Date = new Date()): Promise<boolean> {
    return this.updateOne({
        uuid: uuid
    }, {
        $set: {
            used: date
        }
    }).exec().then(r => {
        return r.matchedCount>0
    });
}


export const User: IUserModel = model<IUserDocument, IUserModel>("User", UserSchema);
