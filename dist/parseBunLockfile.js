"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBunLockfile = void 0;
const child_process_1 = require("child_process");
// Adapted from https://github.com/oven-sh/bun/blob/ffe4f561a3af53b9f5a41c182de55d7199b5d692/packages/bun-vscode/src/features/lockfile.ts#L39,
// rewritten to use spawnSync instead of spawn.
function parseBunLockfile(lockFilePath) {
    const process = child_process_1.spawnSync("bun", [lockFilePath], {
        stdio: ["ignore", "pipe", "pipe"],
    });
    if (process.status !== 0) {
        throw new Error(`Bun exited with code: ${process.status}\n${process.stderr.toString()}`);
    }
    return process.stdout.toString();
}
exports.parseBunLockfile = parseBunLockfile;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VCdW5Mb2NrZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZUJ1bkxvY2tmaWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGlEQUF5QztBQUV6Qyw4SUFBOEk7QUFDOUksK0NBQStDO0FBQy9DLFNBQWdCLGdCQUFnQixDQUFDLFlBQW9CO0lBQ25ELE1BQU0sT0FBTyxHQUFHLHlCQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDL0MsS0FBSyxFQUFFLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUM7S0FDbEMsQ0FBQyxDQUFBO0lBQ0YsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUN4QixNQUFNLElBQUksS0FBSyxDQUNiLHlCQUF5QixPQUFPLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FDeEUsQ0FBQTtLQUNGO0lBQ0QsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFBO0FBQ2xDLENBQUM7QUFWRCw0Q0FVQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNwYXduU3luYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCJcblxuLy8gQWRhcHRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9vdmVuLXNoL2J1bi9ibG9iL2ZmZTRmNTYxYTNhZjUzYjlmNWE0MWMxODJkZTU1ZDcxOTliNWQ2OTIvcGFja2FnZXMvYnVuLXZzY29kZS9zcmMvZmVhdHVyZXMvbG9ja2ZpbGUudHMjTDM5LFxuLy8gcmV3cml0dGVuIHRvIHVzZSBzcGF3blN5bmMgaW5zdGVhZCBvZiBzcGF3bi5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJ1bkxvY2tmaWxlKGxvY2tGaWxlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcHJvY2VzcyA9IHNwYXduU3luYyhcImJ1blwiLCBbbG9ja0ZpbGVQYXRoXSwge1xuICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcbiAgfSlcbiAgaWYgKHByb2Nlc3Muc3RhdHVzICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYEJ1biBleGl0ZWQgd2l0aCBjb2RlOiAke3Byb2Nlc3Muc3RhdHVzfVxcbiR7cHJvY2Vzcy5zdGRlcnIudG9TdHJpbmcoKX1gLFxuICAgIClcbiAgfVxuICByZXR1cm4gcHJvY2Vzcy5zdGRvdXQudG9TdHJpbmcoKVxufVxuIl19