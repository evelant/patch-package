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
        // Parse with JSON5 and stringify with standard JSON to ensure compatibility
        const parsed = json5_1.default.parse(content);
        return JSON.stringify(parsed);
    }
    // Check if there's a text-based lockfile in the same directory
    const lockDir = path_1.dirname(lockFilePath);
    const textLockfilePath = path_1.join(lockDir, "bun.lock");
    if (fs_extra_1.existsSync(textLockfilePath)) {
        const content = fs_extra_1.readFileSync(textLockfilePath, "utf8");
        // Parse with JSON5 and stringify with standard JSON to ensure compatibility
        const parsed = json5_1.default.parse(content);
        return JSON.stringify(parsed);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VCdW5Mb2NrZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZUJ1bkxvY2tmaWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLGlEQUF5QztBQUN6Qyx1Q0FBbUQ7QUFDbkQsaUNBQXNDO0FBQ3RDLGtEQUF5QjtBQUV6Qiw4SUFBOEk7QUFDOUksK0NBQStDO0FBQy9DLFNBQWdCLGdCQUFnQixDQUFDLFlBQW9CO0lBQ25ELHdEQUF3RDtJQUN4RCxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDbEMsTUFBTSxPQUFPLEdBQUcsdUJBQVksQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFDbEQsNEVBQTRFO1FBQzVFLE1BQU0sTUFBTSxHQUFHLGVBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUE7UUFDbkMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFBO0tBQzlCO0lBRUQsK0RBQStEO0lBQy9ELE1BQU0sT0FBTyxHQUFHLGNBQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQTtJQUNyQyxNQUFNLGdCQUFnQixHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUE7SUFDbEQsSUFBSSxxQkFBVSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7UUFDaEMsTUFBTSxPQUFPLEdBQUcsdUJBQVksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQTtRQUN0RCw0RUFBNEU7UUFDNUUsTUFBTSxNQUFNLEdBQUcsZUFBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUNuQyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUE7S0FDOUI7SUFFRCxzREFBc0Q7SUFDdEQsTUFBTSxPQUFPLEdBQUcseUJBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRTtRQUMvQyxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQztLQUNsQyxDQUFDLENBQUE7SUFDRixJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQ2IseUJBQXlCLE9BQU8sQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUN4RSxDQUFBO0tBQ0Y7SUFDRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUE7QUFDbEMsQ0FBQztBQTdCRCw0Q0E2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBzcGF3blN5bmMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgam9pbiwgZGlybmFtZSB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IEpTT041IGZyb20gXCJqc29uNVwiXG5cbi8vIEFkYXB0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vb3Zlbi1zaC9idW4vYmxvYi9mZmU0ZjU2MWEzYWY1M2I5ZjVhNDFjMTgyZGU1NWQ3MTk5YjVkNjkyL3BhY2thZ2VzL2J1bi12c2NvZGUvc3JjL2ZlYXR1cmVzL2xvY2tmaWxlLnRzI0wzOSxcbi8vIHJld3JpdHRlbiB0byB1c2Ugc3Bhd25TeW5jIGluc3RlYWQgb2Ygc3Bhd24uXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VCdW5Mb2NrZmlsZShsb2NrRmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIENoZWNrIGlmIHRoZSBmaWxlIGlzIGEgdGV4dC1iYXNlZCBsb2NrZmlsZSAoYnVuLmxvY2spXG4gIGlmIChsb2NrRmlsZVBhdGguZW5kc1dpdGgoXCIubG9ja1wiKSkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSByZWFkRmlsZVN5bmMobG9ja0ZpbGVQYXRoLCBcInV0ZjhcIilcbiAgICAvLyBQYXJzZSB3aXRoIEpTT041IGFuZCBzdHJpbmdpZnkgd2l0aCBzdGFuZGFyZCBKU09OIHRvIGVuc3VyZSBjb21wYXRpYmlsaXR5XG4gICAgY29uc3QgcGFyc2VkID0gSlNPTjUucGFyc2UoY29udGVudClcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocGFyc2VkKVxuICB9XG5cbiAgLy8gQ2hlY2sgaWYgdGhlcmUncyBhIHRleHQtYmFzZWQgbG9ja2ZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5XG4gIGNvbnN0IGxvY2tEaXIgPSBkaXJuYW1lKGxvY2tGaWxlUGF0aClcbiAgY29uc3QgdGV4dExvY2tmaWxlUGF0aCA9IGpvaW4obG9ja0RpciwgXCJidW4ubG9ja1wiKVxuICBpZiAoZXhpc3RzU3luYyh0ZXh0TG9ja2ZpbGVQYXRoKSkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSByZWFkRmlsZVN5bmModGV4dExvY2tmaWxlUGF0aCwgXCJ1dGY4XCIpXG4gICAgLy8gUGFyc2Ugd2l0aCBKU09ONSBhbmQgc3RyaW5naWZ5IHdpdGggc3RhbmRhcmQgSlNPTiB0byBlbnN1cmUgY29tcGF0aWJpbGl0eVxuICAgIGNvbnN0IHBhcnNlZCA9IEpTT041LnBhcnNlKGNvbnRlbnQpXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHBhcnNlZClcbiAgfVxuXG4gIC8vIE90aGVyd2lzZSwgdXNlIGJ1biBDTEkgdG8gcGFyc2UgdGhlIGJpbmFyeSBsb2NrZmlsZVxuICBjb25zdCBwcm9jZXNzID0gc3Bhd25TeW5jKFwiYnVuXCIsIFtsb2NrRmlsZVBhdGhdLCB7XG4gICAgc3RkaW86IFtcImlnbm9yZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdLFxuICB9KVxuICBpZiAocHJvY2Vzcy5zdGF0dXMgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgQnVuIGV4aXRlZCB3aXRoIGNvZGU6ICR7cHJvY2Vzcy5zdGF0dXN9XFxuJHtwcm9jZXNzLnN0ZGVyci50b1N0cmluZygpfWAsXG4gICAgKVxuICB9XG4gIHJldHVybiBwcm9jZXNzLnN0ZG91dC50b1N0cmluZygpXG59XG4iXX0=