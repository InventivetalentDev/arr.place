import mongoose, { ConnectOptions, Mongoose } from "mongoose";
import config from "../../config.json";

export async function connectMongo(): Promise<Mongoose> {
    // Connect to DB

    const options: ConnectOptions = {
        autoIndex: false
    };

    let m: Mongoose;
    m = await mongoose.connect(config.mongo.url, options);
    console.info("MongoDB connected!");

    mongoose.connection.on("error", err => {
        console.warn("Mongo connection error, restarting app");
        setTimeout(() => {
            process.exit(1);
        }, 10000);
    })

    return m;
}
