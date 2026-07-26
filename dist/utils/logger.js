import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "white",
};
winston.addColors(colors);
const format = winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }), winston.format.colorize({ all: true }), winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
const fileFormat = winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }), winston.format.json());
const transports = [
    new winston.transports.Console({
        format,
    }),
    new winston.transports.File({
        filename: path.join(__dirname, "../../logs/error.log"),
        level: "error",
        format: fileFormat,
    }),
    new winston.transports.File({
        filename: path.join(__dirname, "../../logs/combined.log"),
        format: fileFormat,
    }),
];
const logger = winston.createLogger({
    level: "info",
    levels,
    format: fileFormat,
    transports,
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, "../../logs/exceptions.log"),
        }),
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, "../../logs/rejections.log"),
        }),
    ],
});
export default logger;
