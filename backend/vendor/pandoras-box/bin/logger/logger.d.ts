declare class Logger {
    static info(s: string): void;
    static title(s: string): void;
    static warn(s: string): void;
    static success(s: string): void;
    static error(s: string): void;
}
export default Logger;
