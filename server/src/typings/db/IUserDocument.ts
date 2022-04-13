import { Document, Model } from "mongoose";
import { Maybe } from "../../util";


export interface IUserDocument extends Document {
    uuid: string;
    name: string;
    created: Date;
    used: Date;
}

export interface IUserModel extends Model<IUserDocument> {
    findForUuid(uuid: string): Promise<Maybe<IUserDocument>>;

    updateUsed(uuid: string, date?: Date): Promise<boolean>;
}
