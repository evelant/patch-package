"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPackageManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = require("./path");
const chalk_1 = __importDefault(require("chalk"));
const process_1 = __importDefault(require("process"));
const find_yarn_workspace_root_1 = __importDefault(require("find-yarn-workspace-root"));
function printNoYarnLockfileError() {
    console.log(`
${chalk_1.default.red.bold("**ERROR**")} ${chalk_1.default.red(`The --use-yarn option was specified but there is no yarn.lock file`)}
`);
}
function printNoBunLockfileError() {
    console.log(`
${chalk_1.default.red.bold("**ERROR**")} ${chalk_1.default.red(`The --use-bun option was specified but there is no bun.lockb file`)}
`);
}
function printNoLockfilesError() {
    console.log(`
${chalk_1.default.red.bold("**ERROR**")} ${chalk_1.default.red(`No package-lock.json, npm-shrinkwrap.json, yarn.lock, or bun.lockb file.

You must use either npm@>=5, yarn, npm-shrinkwrap, or bun to manage this project's
dependencies.`)}
`);
}
function printSelectingDefaultMessage() {
    console.info(`${chalk_1.default.bold("patch-package")}: you have multiple lockfiles, e.g. yarn.lock and package-lock.json
Defaulting to using ${chalk_1.default.bold("npm")}
You can override this setting by passing --use-yarn, --use-bun, or
deleting the conflicting lockfile if you don't need it
`);
}
function printSelectingDefaultYarnMessage() {
    console.info(`${chalk_1.default.bold("patch-package")}: you have both yarn.lock and bun.lockb lockfiles
Defaulting to using ${chalk_1.default.bold("yarn")}
You can override this setting by passing --use-bun, or
deleting yarn.lock if you don't need it
`);
}
function checkForYarnOverride(overridePackageManager) {
    if (overridePackageManager === "yarn") {
        printNoYarnLockfileError();
        process_1.default.exit(1);
    }
}
function checkForBunOverride(overridePackageManager) {
    if (overridePackageManager === "bun") {
        printNoBunLockfileError();
        process_1.default.exit(1);
    }
}
const detectPackageManager = (appRootPath, overridePackageManager) => {
    var _a, _b;
    const packageLockExists = fs_extra_1.default.existsSync(path_1.join(appRootPath, "package-lock.json"));
    const shrinkWrapExists = fs_extra_1.default.existsSync(path_1.join(appRootPath, "npm-shrinkwrap.json"));
    const yarnLockExists = fs_extra_1.default.existsSync(path_1.join((_a = find_yarn_workspace_root_1.default()) !== null && _a !== void 0 ? _a : appRootPath, "yarn.lock"));
    // Bun workspaces seem to work the same as yarn workspaces - https://bun.sh/docs/install/workspaces
    const bunLockbExists = fs_extra_1.default.existsSync(path_1.join((_b = find_yarn_workspace_root_1.default()) !== null && _b !== void 0 ? _b : appRootPath, "bun.lockb"));
    if ([
        packageLockExists || shrinkWrapExists,
        yarnLockExists,
        bunLockbExists,
    ].filter(Boolean).length > 1) {
        if (overridePackageManager) {
            return overridePackageManager;
        }
        if (!packageLockExists && !shrinkWrapExists) {
            // The only case where we don't want to default to npm is when we have both yarn and bun lockfiles.
            printSelectingDefaultYarnMessage();
            return "yarn";
        }
        printSelectingDefaultMessage();
        return shrinkWrapExists ? "npm-shrinkwrap" : "npm";
    }
    else if (packageLockExists || shrinkWrapExists) {
        checkForYarnOverride(overridePackageManager);
        checkForBunOverride(overridePackageManager);
        return shrinkWrapExists ? "npm-shrinkwrap" : "npm";
    }
    else if (yarnLockExists) {
        checkForBunOverride(overridePackageManager);
        return "yarn";
    }
    else if (bunLockbExists) {
        checkForYarnOverride(overridePackageManager);
        return "bun";
    }
    else {
        printNoLockfilesError();
        process_1.default.exit(1);
    }
    throw Error();
};
exports.detectPackageManager = detectPackageManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0ZWN0UGFja2FnZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGV0ZWN0UGFja2FnZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXlCO0FBQ3pCLGlDQUE2QjtBQUM3QixrREFBeUI7QUFDekIsc0RBQTZCO0FBQzdCLHdGQUF3RDtBQUl4RCxTQUFTLHdCQUF3QjtJQUMvQixPQUFPLENBQUMsR0FBRyxDQUFDO0VBQ1osZUFBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksZUFBSyxDQUFDLEdBQUcsQ0FDdEMsb0VBQW9FLENBQ3JFO0NBQ0YsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQUVELFNBQVMsdUJBQXVCO0lBQzlCLE9BQU8sQ0FBQyxHQUFHLENBQUM7RUFDWixlQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxlQUFLLENBQUMsR0FBRyxDQUN0QyxtRUFBbUUsQ0FDcEU7Q0FDRixDQUFDLENBQUE7QUFDRixDQUFDO0FBRUQsU0FBUyxxQkFBcUI7SUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQztFQUNaLGVBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLGVBQUssQ0FBQyxHQUFHLENBQ3RDOzs7Y0FHVSxDQUNYO0NBQ0YsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQUVELFNBQVMsNEJBQTRCO0lBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQ1YsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUNYLGVBQWUsQ0FDaEI7c0JBQ2lCLGVBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDOzs7Q0FHdEMsQ0FDRSxDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsZ0NBQWdDO0lBQ3ZDLE9BQU8sQ0FBQyxJQUFJLENBQ1YsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUNYLGVBQWUsQ0FDaEI7c0JBQ2lCLGVBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDOzs7Q0FHdkMsQ0FDRSxDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsc0JBQTZDO0lBQ3pFLElBQUksc0JBQXNCLEtBQUssTUFBTSxFQUFFO1FBQ3JDLHdCQUF3QixFQUFFLENBQUE7UUFDMUIsaUJBQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7S0FDaEI7QUFDSCxDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxzQkFBNkM7SUFDeEUsSUFBSSxzQkFBc0IsS0FBSyxLQUFLLEVBQUU7UUFDcEMsdUJBQXVCLEVBQUUsQ0FBQTtRQUN6QixpQkFBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNoQjtBQUNILENBQUM7QUFFTSxNQUFNLG9CQUFvQixHQUFHLENBQ2xDLFdBQW1CLEVBQ25CLHNCQUE2QyxFQUM3QixFQUFFOztJQUNsQixNQUFNLGlCQUFpQixHQUFHLGtCQUFFLENBQUMsVUFBVSxDQUNyQyxXQUFJLENBQUMsV0FBVyxFQUFFLG1CQUFtQixDQUFDLENBQ3ZDLENBQUE7SUFDRCxNQUFNLGdCQUFnQixHQUFHLGtCQUFFLENBQUMsVUFBVSxDQUNwQyxXQUFJLENBQUMsV0FBVyxFQUFFLHFCQUFxQixDQUFDLENBQ3pDLENBQUE7SUFDRCxNQUFNLGNBQWMsR0FBRyxrQkFBRSxDQUFDLFVBQVUsQ0FDbEMsV0FBSSxDQUFDLE1BQUEsa0NBQWlCLEVBQUUsbUNBQUksV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUN0RCxDQUFBO0lBQ0QsbUdBQW1HO0lBQ25HLE1BQU0sY0FBYyxHQUFHLGtCQUFFLENBQUMsVUFBVSxDQUNsQyxXQUFJLENBQUMsTUFBQSxrQ0FBaUIsRUFBRSxtQ0FBSSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQ3RELENBQUE7SUFDRCxJQUNFO1FBQ0UsaUJBQWlCLElBQUksZ0JBQWdCO1FBQ3JDLGNBQWM7UUFDZCxjQUFjO0tBQ2YsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFDNUI7UUFDQSxJQUFJLHNCQUFzQixFQUFFO1lBQzFCLE9BQU8sc0JBQXNCLENBQUE7U0FDOUI7UUFDRCxJQUFJLENBQUMsaUJBQWlCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUMzQyxtR0FBbUc7WUFDbkcsZ0NBQWdDLEVBQUUsQ0FBQTtZQUNsQyxPQUFPLE1BQU0sQ0FBQTtTQUNkO1FBQ0QsNEJBQTRCLEVBQUUsQ0FBQTtRQUM5QixPQUFPLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFBO0tBQ25EO1NBQU0sSUFBSSxpQkFBaUIsSUFBSSxnQkFBZ0IsRUFBRTtRQUNoRCxvQkFBb0IsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFBO1FBQzVDLG1CQUFtQixDQUFDLHNCQUFzQixDQUFDLENBQUE7UUFDM0MsT0FBTyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtLQUNuRDtTQUFNLElBQUksY0FBYyxFQUFFO1FBQ3pCLG1CQUFtQixDQUFDLHNCQUFzQixDQUFDLENBQUE7UUFDM0MsT0FBTyxNQUFNLENBQUE7S0FDZDtTQUFNLElBQUksY0FBYyxFQUFFO1FBQ3pCLG9CQUFvQixDQUFDLHNCQUFzQixDQUFDLENBQUE7UUFDNUMsT0FBTyxLQUFLLENBQUE7S0FDYjtTQUFNO1FBQ0wscUJBQXFCLEVBQUUsQ0FBQTtRQUN2QixpQkFBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNoQjtJQUNELE1BQU0sS0FBSyxFQUFFLENBQUE7QUFDZixDQUFDLENBQUE7QUFqRFksUUFBQSxvQkFBb0Isd0JBaURoQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgam9pbiB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiXG5pbXBvcnQgcHJvY2VzcyBmcm9tIFwicHJvY2Vzc1wiXG5pbXBvcnQgZmluZFdvcmtzcGFjZVJvb3QgZnJvbSBcImZpbmQteWFybi13b3Jrc3BhY2Utcm9vdFwiXG5cbmV4cG9ydCB0eXBlIFBhY2thZ2VNYW5hZ2VyID0gXCJ5YXJuXCIgfCBcIm5wbVwiIHwgXCJucG0tc2hyaW5rd3JhcFwiIHwgXCJidW5cIlxuXG5mdW5jdGlvbiBwcmludE5vWWFybkxvY2tmaWxlRXJyb3IoKSB7XG4gIGNvbnNvbGUubG9nKGBcbiR7Y2hhbGsucmVkLmJvbGQoXCIqKkVSUk9SKipcIil9ICR7Y2hhbGsucmVkKFxuICAgIGBUaGUgLS11c2UteWFybiBvcHRpb24gd2FzIHNwZWNpZmllZCBidXQgdGhlcmUgaXMgbm8geWFybi5sb2NrIGZpbGVgLFxuICApfVxuYClcbn1cblxuZnVuY3Rpb24gcHJpbnROb0J1bkxvY2tmaWxlRXJyb3IoKSB7XG4gIGNvbnNvbGUubG9nKGBcbiR7Y2hhbGsucmVkLmJvbGQoXCIqKkVSUk9SKipcIil9ICR7Y2hhbGsucmVkKFxuICAgIGBUaGUgLS11c2UtYnVuIG9wdGlvbiB3YXMgc3BlY2lmaWVkIGJ1dCB0aGVyZSBpcyBubyBidW4ubG9ja2IgZmlsZWAsXG4gICl9XG5gKVxufVxuXG5mdW5jdGlvbiBwcmludE5vTG9ja2ZpbGVzRXJyb3IoKSB7XG4gIGNvbnNvbGUubG9nKGBcbiR7Y2hhbGsucmVkLmJvbGQoXCIqKkVSUk9SKipcIil9ICR7Y2hhbGsucmVkKFxuICAgIGBObyBwYWNrYWdlLWxvY2suanNvbiwgbnBtLXNocmlua3dyYXAuanNvbiwgeWFybi5sb2NrLCBvciBidW4ubG9ja2IgZmlsZS5cblxuWW91IG11c3QgdXNlIGVpdGhlciBucG1APj01LCB5YXJuLCBucG0tc2hyaW5rd3JhcCwgb3IgYnVuIHRvIG1hbmFnZSB0aGlzIHByb2plY3Qnc1xuZGVwZW5kZW5jaWVzLmAsXG4gICl9XG5gKVxufVxuXG5mdW5jdGlvbiBwcmludFNlbGVjdGluZ0RlZmF1bHRNZXNzYWdlKCkge1xuICBjb25zb2xlLmluZm8oXG4gICAgYCR7Y2hhbGsuYm9sZChcbiAgICAgIFwicGF0Y2gtcGFja2FnZVwiLFxuICAgICl9OiB5b3UgaGF2ZSBtdWx0aXBsZSBsb2NrZmlsZXMsIGUuZy4geWFybi5sb2NrIGFuZCBwYWNrYWdlLWxvY2suanNvblxuRGVmYXVsdGluZyB0byB1c2luZyAke2NoYWxrLmJvbGQoXCJucG1cIil9XG5Zb3UgY2FuIG92ZXJyaWRlIHRoaXMgc2V0dGluZyBieSBwYXNzaW5nIC0tdXNlLXlhcm4sIC0tdXNlLWJ1biwgb3JcbmRlbGV0aW5nIHRoZSBjb25mbGljdGluZyBsb2NrZmlsZSBpZiB5b3UgZG9uJ3QgbmVlZCBpdFxuYCxcbiAgKVxufVxuXG5mdW5jdGlvbiBwcmludFNlbGVjdGluZ0RlZmF1bHRZYXJuTWVzc2FnZSgpIHtcbiAgY29uc29sZS5pbmZvKFxuICAgIGAke2NoYWxrLmJvbGQoXG4gICAgICBcInBhdGNoLXBhY2thZ2VcIixcbiAgICApfTogeW91IGhhdmUgYm90aCB5YXJuLmxvY2sgYW5kIGJ1bi5sb2NrYiBsb2NrZmlsZXNcbkRlZmF1bHRpbmcgdG8gdXNpbmcgJHtjaGFsay5ib2xkKFwieWFyblwiKX1cbllvdSBjYW4gb3ZlcnJpZGUgdGhpcyBzZXR0aW5nIGJ5IHBhc3NpbmcgLS11c2UtYnVuLCBvclxuZGVsZXRpbmcgeWFybi5sb2NrIGlmIHlvdSBkb24ndCBuZWVkIGl0XG5gLFxuICApXG59XG5cbmZ1bmN0aW9uIGNoZWNrRm9yWWFybk92ZXJyaWRlKG92ZXJyaWRlUGFja2FnZU1hbmFnZXI6IFBhY2thZ2VNYW5hZ2VyIHwgbnVsbCkge1xuICBpZiAob3ZlcnJpZGVQYWNrYWdlTWFuYWdlciA9PT0gXCJ5YXJuXCIpIHtcbiAgICBwcmludE5vWWFybkxvY2tmaWxlRXJyb3IoKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrRm9yQnVuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXIgfCBudWxsKSB7XG4gIGlmIChvdmVycmlkZVBhY2thZ2VNYW5hZ2VyID09PSBcImJ1blwiKSB7XG4gICAgcHJpbnROb0J1bkxvY2tmaWxlRXJyb3IoKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkZXRlY3RQYWNrYWdlTWFuYWdlciA9IChcbiAgYXBwUm9vdFBhdGg6IHN0cmluZyxcbiAgb3ZlcnJpZGVQYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXIgfCBudWxsLFxuKTogUGFja2FnZU1hbmFnZXIgPT4ge1xuICBjb25zdCBwYWNrYWdlTG9ja0V4aXN0cyA9IGZzLmV4aXN0c1N5bmMoXG4gICAgam9pbihhcHBSb290UGF0aCwgXCJwYWNrYWdlLWxvY2suanNvblwiKSxcbiAgKVxuICBjb25zdCBzaHJpbmtXcmFwRXhpc3RzID0gZnMuZXhpc3RzU3luYyhcbiAgICBqb2luKGFwcFJvb3RQYXRoLCBcIm5wbS1zaHJpbmt3cmFwLmpzb25cIiksXG4gIClcbiAgY29uc3QgeWFybkxvY2tFeGlzdHMgPSBmcy5leGlzdHNTeW5jKFxuICAgIGpvaW4oZmluZFdvcmtzcGFjZVJvb3QoKSA/PyBhcHBSb290UGF0aCwgXCJ5YXJuLmxvY2tcIiksXG4gIClcbiAgLy8gQnVuIHdvcmtzcGFjZXMgc2VlbSB0byB3b3JrIHRoZSBzYW1lIGFzIHlhcm4gd29ya3NwYWNlcyAtIGh0dHBzOi8vYnVuLnNoL2RvY3MvaW5zdGFsbC93b3Jrc3BhY2VzXG4gIGNvbnN0IGJ1bkxvY2tiRXhpc3RzID0gZnMuZXhpc3RzU3luYyhcbiAgICBqb2luKGZpbmRXb3Jrc3BhY2VSb290KCkgPz8gYXBwUm9vdFBhdGgsIFwiYnVuLmxvY2tiXCIpLFxuICApXG4gIGlmIChcbiAgICBbXG4gICAgICBwYWNrYWdlTG9ja0V4aXN0cyB8fCBzaHJpbmtXcmFwRXhpc3RzLFxuICAgICAgeWFybkxvY2tFeGlzdHMsXG4gICAgICBidW5Mb2NrYkV4aXN0cyxcbiAgICBdLmZpbHRlcihCb29sZWFuKS5sZW5ndGggPiAxXG4gICkge1xuICAgIGlmIChvdmVycmlkZVBhY2thZ2VNYW5hZ2VyKSB7XG4gICAgICByZXR1cm4gb3ZlcnJpZGVQYWNrYWdlTWFuYWdlclxuICAgIH1cbiAgICBpZiAoIXBhY2thZ2VMb2NrRXhpc3RzICYmICFzaHJpbmtXcmFwRXhpc3RzKSB7XG4gICAgICAvLyBUaGUgb25seSBjYXNlIHdoZXJlIHdlIGRvbid0IHdhbnQgdG8gZGVmYXVsdCB0byBucG0gaXMgd2hlbiB3ZSBoYXZlIGJvdGggeWFybiBhbmQgYnVuIGxvY2tmaWxlcy5cbiAgICAgIHByaW50U2VsZWN0aW5nRGVmYXVsdFlhcm5NZXNzYWdlKClcbiAgICAgIHJldHVybiBcInlhcm5cIlxuICAgIH1cbiAgICBwcmludFNlbGVjdGluZ0RlZmF1bHRNZXNzYWdlKClcbiAgICByZXR1cm4gc2hyaW5rV3JhcEV4aXN0cyA/IFwibnBtLXNocmlua3dyYXBcIiA6IFwibnBtXCJcbiAgfSBlbHNlIGlmIChwYWNrYWdlTG9ja0V4aXN0cyB8fCBzaHJpbmtXcmFwRXhpc3RzKSB7XG4gICAgY2hlY2tGb3JZYXJuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcilcbiAgICBjaGVja0ZvckJ1bk92ZXJyaWRlKG92ZXJyaWRlUGFja2FnZU1hbmFnZXIpXG4gICAgcmV0dXJuIHNocmlua1dyYXBFeGlzdHMgPyBcIm5wbS1zaHJpbmt3cmFwXCIgOiBcIm5wbVwiXG4gIH0gZWxzZSBpZiAoeWFybkxvY2tFeGlzdHMpIHtcbiAgICBjaGVja0ZvckJ1bk92ZXJyaWRlKG92ZXJyaWRlUGFja2FnZU1hbmFnZXIpXG4gICAgcmV0dXJuIFwieWFyblwiXG4gIH0gZWxzZSBpZiAoYnVuTG9ja2JFeGlzdHMpIHtcbiAgICBjaGVja0Zvcllhcm5PdmVycmlkZShvdmVycmlkZVBhY2thZ2VNYW5hZ2VyKVxuICAgIHJldHVybiBcImJ1blwiXG4gIH0gZWxzZSB7XG4gICAgcHJpbnROb0xvY2tmaWxlc0Vycm9yKClcbiAgICBwcm9jZXNzLmV4aXQoMSlcbiAgfVxuICB0aHJvdyBFcnJvcigpXG59XG4iXX0=