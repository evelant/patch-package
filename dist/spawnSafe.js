"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnSafeSync = void 0;
const cross_spawn_1 = require("cross-spawn");
const defaultOptions = {
    logStdErrOnError: true,
    throwOnError: true,
};
const spawnSafeSync = (command, args, options) => {
    const mergedOptions = Object.assign({}, defaultOptions, options);
    const result = cross_spawn_1.sync(command, args, options);
    if (result.error || result.status !== 0) {
        if (mergedOptions.logStdErrOnError) {
            console.log(`Command failed: ${command} ${args ? args.join(" ") : ""}`);
            if (result.stderr) {
                console.log(result.stderr.toString());
            }
            else if (result.error) {
                console.log(result.error);
            }
            if (result.stdout) {
                console.log(result.stdout.toString());
            }
        }
        if (mergedOptions.throwOnError) {
            throw result;
        }
    }
    return result;
};
exports.spawnSafeSync = spawnSafeSync;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3Bhd25TYWZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3NwYXduU2FmZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBK0M7QUFTL0MsTUFBTSxjQUFjLEdBQXFCO0lBQ3ZDLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsWUFBWSxFQUFFLElBQUk7Q0FDbkIsQ0FBQTtBQUVNLE1BQU0sYUFBYSxHQUFHLENBQzNCLE9BQWUsRUFDZixJQUFlLEVBQ2YsT0FBMEIsRUFDMUIsRUFBRTtJQUNGLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQTtJQUNoRSxNQUFNLE1BQU0sR0FBRyxrQkFBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUE7SUFDaEQsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3ZDLElBQUksYUFBYSxDQUFDLGdCQUFnQixFQUFFO1lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLE9BQU8sSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUE7WUFDdkUsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTthQUN0QztpQkFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUU7Z0JBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBO2FBQzFCO1lBQ0QsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO2dCQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQTthQUN0QztTQUNGO1FBQ0QsSUFBSSxhQUFhLENBQUMsWUFBWSxFQUFFO1lBQzlCLE1BQU0sTUFBTSxDQUFBO1NBQ2I7S0FDRjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2YsQ0FBQyxDQUFBO0FBeEJZLFFBQUEsYUFBYSxpQkF3QnpCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc3luYyBhcyBzcGF3blN5bmMgfSBmcm9tIFwiY3Jvc3Mtc3Bhd25cIlxuaW1wb3J0IHsgU3Bhd25PcHRpb25zIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIlxuXG5leHBvcnQgaW50ZXJmYWNlIFNwYXduU2FmZU9wdGlvbnMgZXh0ZW5kcyBTcGF3bk9wdGlvbnMge1xuICB0aHJvd09uRXJyb3I/OiBib29sZWFuXG4gIGxvZ1N0ZEVyck9uRXJyb3I/OiBib29sZWFuXG4gIG1heEJ1ZmZlcj86IG51bWJlclxufVxuXG5jb25zdCBkZWZhdWx0T3B0aW9uczogU3Bhd25TYWZlT3B0aW9ucyA9IHtcbiAgbG9nU3RkRXJyT25FcnJvcjogdHJ1ZSxcbiAgdGhyb3dPbkVycm9yOiB0cnVlLFxufVxuXG5leHBvcnQgY29uc3Qgc3Bhd25TYWZlU3luYyA9IChcbiAgY29tbWFuZDogc3RyaW5nLFxuICBhcmdzPzogc3RyaW5nW10sXG4gIG9wdGlvbnM/OiBTcGF3blNhZmVPcHRpb25zLFxuKSA9PiB7XG4gIGNvbnN0IG1lcmdlZE9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0T3B0aW9ucywgb3B0aW9ucylcbiAgY29uc3QgcmVzdWx0ID0gc3Bhd25TeW5jKGNvbW1hbmQsIGFyZ3MsIG9wdGlvbnMpXG4gIGlmIChyZXN1bHQuZXJyb3IgfHwgcmVzdWx0LnN0YXR1cyAhPT0gMCkge1xuICAgIGlmIChtZXJnZWRPcHRpb25zLmxvZ1N0ZEVyck9uRXJyb3IpIHtcbiAgICAgIGNvbnNvbGUubG9nKGBDb21tYW5kIGZhaWxlZDogJHtjb21tYW5kfSAke2FyZ3MgPyBhcmdzLmpvaW4oXCIgXCIpIDogXCJcIn1gKVxuICAgICAgaWYgKHJlc3VsdC5zdGRlcnIpIHtcbiAgICAgICAgY29uc29sZS5sb2cocmVzdWx0LnN0ZGVyci50b1N0cmluZygpKVxuICAgICAgfSBlbHNlIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5sb2cocmVzdWx0LmVycm9yKVxuICAgICAgfVxuICAgICAgaWYgKHJlc3VsdC5zdGRvdXQpIHtcbiAgICAgICAgY29uc29sZS5sb2cocmVzdWx0LnN0ZG91dC50b1N0cmluZygpKVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAobWVyZ2VkT3B0aW9ucy50aHJvd09uRXJyb3IpIHtcbiAgICAgIHRocm93IHJlc3VsdFxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG4iXX0=