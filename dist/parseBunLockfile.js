"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBunLockfile = void 0;
const child_process_1 = require("child_process");
const fs_extra_1 = require("fs-extra");
const path_1 = require("./path");
const json5_1 = __importDefault(require("json5"));
// Adapted from https://github.com/oven-sh/bun/blob/ffe4f561a3af53b9f5a41c182de55d7199b5d692/packages/bun-vscode/src/features/lockfile.ts#L39,
// rewritten to use spawnSync instead of spawn.
function parseBunLockfile(lockFilePath) {
    // Check if the file is a text-based lockfile (bun.lock)
    if (lockFilePath.endsWith(".lock")) {
        const content = fs_extra_1.readFileSync(lockFilePath, "utf8");
        try {
            // Parse with JSON5 and stringify with standard JSON to ensure compatibility
            const parsed = json5_1.default.parse(content);
            return JSON.stringify(parsed);
        }
        catch (e) {
            console.error(`Error parsing bun.lock file: ${e.message}`);
            // Return the raw content as a fallback
            return content;
        }
    }
    // Check if there's a text-based lockfile in the same directory
    const lockDir = path_1.dirname(lockFilePath);
    const textLockfilePath = path_1.join(lockDir, "bun.lock");
    if (fs_extra_1.existsSync(textLockfilePath)) {
        const content = fs_extra_1.readFileSync(textLockfilePath, "utf8");
        try {
            // Parse with JSON5 and stringify with standard JSON to ensure compatibility
            const parsed = json5_1.default.parse(content);
            return JSON.stringify(parsed);
        }
        catch (e) {
            console.error(`Error parsing bun.lock file: ${e.message}`);
            // Return the raw content as a fallback
            return content;
        }
    }
    // Otherwise, use bun CLI to parse the binary lockfile
    const process = child_process_1.spawnSync("bun", [lockFilePath], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (process.status !== 0) {
        throw new Error(`Bun exited with code: ${process.status}\n${process.stderr.toString()}`);
    }
    return process.stdout.toString();
}
exports.parseBunLockfile = parseBunLockfile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VCdW5Mb2NrZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZUJ1bkxvY2tmaWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGlEQUF5QztBQUN6Qyx1Q0FBbUQ7QUFDbkQsaUNBQXNDO0FBQ3RDLGtEQUF5QjtBQUV6Qiw4SUFBOEk7QUFDOUksK0NBQStDO0FBQy9DLFNBQWdCLGdCQUFnQixDQUFDLFlBQW9CO0lBQ25ELHdEQUF3RDtJQUN4RCxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDbEMsTUFBTSxPQUFPLEdBQUcsdUJBQVksQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFDbEQsSUFBSTtZQUNGLDRFQUE0RTtZQUM1RSxNQUFNLE1BQU0sR0FBRyxlQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ25DLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQTtTQUM5QjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7WUFDMUQsdUNBQXVDO1lBQ3ZDLE9BQU8sT0FBTyxDQUFBO1NBQ2Y7S0FDRjtJQUVELCtEQUErRDtJQUMvRCxNQUFNLE9BQU8sR0FBRyxjQUFPLENBQUMsWUFBWSxDQUFDLENBQUE7SUFDckMsTUFBTSxnQkFBZ0IsR0FBRyxXQUFJLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFBO0lBQ2xELElBQUkscUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQ2hDLE1BQU0sT0FBTyxHQUFHLHVCQUFZLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFDdEQsSUFBSTtZQUNGLDRFQUE0RTtZQUM1RSxNQUFNLE1BQU0sR0FBRyxlQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFBO1lBQ25DLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQTtTQUM5QjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUE7WUFDMUQsdUNBQXVDO1lBQ3ZDLE9BQU8sT0FBTyxDQUFBO1NBQ2Y7S0FDRjtJQUVELHNEQUFzRDtJQUN0RCxNQUFNLE9BQU8sR0FBRyx5QkFBUyxDQUFDLEtBQUssRUFBRSxDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQy9DLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDO0tBQ2xDLENBQUMsQ0FBQTtJQUNGLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FDYix5QkFBeUIsT0FBTyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQ3hFLENBQUE7S0FDRjtJQUNELE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQTtBQUNsQyxDQUFDO0FBekNELDRDQXlDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNwYXduU3luYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCJcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgZXhpc3RzU3luYyB9IGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgeyBqb2luLCBkaXJuYW1lIH0gZnJvbSBcIi4vcGF0aFwiXG5pbXBvcnQgSlNPTjUgZnJvbSBcImpzb241XCJcblxuLy8gQWRhcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9vdmVuLXNoL2J1bi9ibG9iL2ZmZTRmNTYxYTNhZjUzYjlmNWE0MWMxODJkZTU1ZDcxOTliNWQ2OTIvcGFja2FnZXMvYnVuLXZzY29kZS9zcmMvZmVhdHVyZXMvbG9ja2ZpbGUudHMjTDM5LFxuLy8gcmV3cml0dGVuIHRvIHVzZSBzcGF3blN5bmMgaW5zdGVhZCBvZiBzcGF3bi5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJ1bkxvY2tmaWxlKGxvY2tGaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gQ2hlY2sgaWYgdGhlIGZpbGUgaXMgYSB0ZXh0LWJhc2VkIGxvY2tmaWxlIChidW4ubG9jaylcbiAgaWYgKGxvY2tGaWxlUGF0aC5lbmRzV2l0aChcIi5sb2NrXCIpKSB7XG4gICAgY29uc3QgY29udGVudCA9IHJlYWRGaWxlU3luYyhsb2NrRmlsZVBhdGgsIFwidXRmOFwiKVxuICAgIHRyeSB7XG4gICAgICAvLyBQYXJzZSB3aXRoIEpTT041IGFuZCBzdHJpbmdpZnkgd2l0aCBzdGFuZGFyZCBKU09OIHRvIGVuc3VyZSBjb21wYXRpYmlsaXR5XG4gICAgICBjb25zdCBwYXJzZWQgPSBKU09ONS5wYXJzZShjb250ZW50KVxuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHBhcnNlZClcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBwYXJzaW5nIGJ1bi5sb2NrIGZpbGU6ICR7ZS5tZXNzYWdlfWApXG4gICAgICAvLyBSZXR1cm4gdGhlIHJhdyBjb250ZW50IGFzIGEgZmFsbGJhY2tcbiAgICAgIHJldHVybiBjb250ZW50XG4gICAgfVxuICB9XG5cbiAgLy8gQ2hlY2sgaWYgdGhlcmUncyBhIHRleHQtYmFzZWQgbG9ja2ZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5XG4gIGNvbnN0IGxvY2tEaXIgPSBkaXJuYW1lKGxvY2tGaWxlUGF0aClcbiAgY29uc3QgdGV4dExvY2tmaWxlUGF0aCA9IGpvaW4obG9ja0RpciwgXCJidW4ubG9ja1wiKVxuICBpZiAoZXhpc3RzU3luYyh0ZXh0TG9ja2ZpbGVQYXRoKSkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSByZWFkRmlsZVN5bmModGV4dExvY2tmaWxlUGF0aCwgXCJ1dGY4XCIpXG4gICAgdHJ5IHtcbiAgICAgIC8vIFBhcnNlIHdpdGggSlNPTjUgYW5kIHN0cmluZ2lmeSB3aXRoIHN0YW5kYXJkIEpTT04gdG8gZW5zdXJlIGNvbXBhdGliaWxpdHlcbiAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT041LnBhcnNlKGNvbnRlbnQpXG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocGFyc2VkKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHBhcnNpbmcgYnVuLmxvY2sgZmlsZTogJHtlLm1lc3NhZ2V9YClcbiAgICAgIC8vIFJldHVybiB0aGUgcmF3IGNvbnRlbnQgYXMgYSBmYWxsYmFja1xuICAgICAgcmV0dXJuIGNvbnRlbnRcbiAgICB9XG4gIH1cblxuICAvLyBPdGhlcndpc2UsIHVzZSBidW4gQ0xJIHRvIHBhcnNlIHRoZSBiaW5hcnkgbG9ja2ZpbGVcbiAgY29uc3QgcHJvY2VzcyA9IHNwYXduU3luYyhcImJ1blwiLCBbbG9ja0ZpbGVQYXRoXSwge1xuICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcbiAgfSlcbiAgaWYgKHByb2Nlc3Muc3RhdHVzICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEJ1biBleGl0ZWQgd2l0aCBjb2RlOiAke3Byb2Nlc3Muc3RhdHVzfVxcbiR7cHJvY2Vzcy5zdGRlcnIudG9TdHJpbmcoKX1gLFxuICAgIClcbiAgfVxuICByZXR1cm4gcHJvY2Vzcy5zdGRvdXQudG9TdHJpbmcoKVxufVxuIl19