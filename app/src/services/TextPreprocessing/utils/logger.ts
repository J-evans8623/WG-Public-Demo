// utils/logger.ts
import fs from 'fs';
import util from 'util';
import path from 'path';

// Build the absolute path for the log file in the same directory as this file.
const logFilePath = path.join(__dirname, 'ai-logs.txt');

// Ensure the directory exists
const logDirectory = path.dirname(logFilePath);
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

const logFile = fs.createWriteStream(logFilePath, { flags: 'a' });

// Export only the logging function
export function log(...args: any[]): void {
    const message = util.format(...args);
    const timestamp = new Date().toISOString();
    const logMessage = `[LOG ${timestamp}] ${message}\n`;

    logFile.write(logMessage, (err) => {
        if (err) {
            console.error('Failed to write to log file:', err);
        }
    });

    // Uncomment the next line if you want to print to terminal as well
    // console.log(...args);
}