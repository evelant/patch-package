"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPatchSequenceError = exports.makePatch = void 0;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = __importDefault(require("console"));
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const rimraf_1 = require("rimraf");
const tmp_1 = require("tmp");
const zlib_1 = require("zlib");
const applyPatches_1 = require("./applyPatches");
const createIssue_1 = require("./createIssue");
const filterFiles_1 = require("./filterFiles");
const getPackageResolution_1 = require("./getPackageResolution");
const getPackageVersion_1 = require("./getPackageVersion");
const hash_1 = require("./hash");
const PackageDetails_1 = require("./PackageDetails");
const parse_1 = require("./patch/parse");
const patchFs_1 = require("./patchFs");
const path_1 = require("./path");
const resolveRelativeFileDependencies_1 = require("./resolveRelativeFileDependencies");
const spawnSafe_1 = require("./spawnSafe");
const stateFile_1 = require("./stateFile");
function printNoPackageFoundError(packageName, packageJsonPath) {
    console_1.default.log(`No such package ${packageName}

  File not found: ${packageJsonPath}`);
}
function makePatch({ packagePathSpecifier, appPath, packageManager, includePaths, excludePaths, patchDir, createIssue, mode, }) {
    var _a, _b, _c, _d, _e;
    const packageDetails = PackageDetails_1.getPatchDetailsFromCliString(packagePathSpecifier);
    if (!packageDetails) {
        console_1.default.log("No such package", packagePathSpecifier);
        return;
    }
    const state = stateFile_1.getPatchApplicationState(packageDetails);
    const isRebasing = (_a = state === null || state === void 0 ? void 0 : state.isRebasing) !== null && _a !== void 0 ? _a : false;
    // If we are rebasing and no patches have been applied, --append is the only valid option because
    // there are no previous patches to overwrite/update
    if (isRebasing &&
        (state === null || state === void 0 ? void 0 : state.patches.filter((p) => p.didApply).length) === 0 &&
        mode.type === "overwrite_last") {
        mode = { type: "append", name: "initial" };
    }
    if (isRebasing && state) {
        stateFile_1.verifyAppliedPatches({ appPath, patchDir, state });
    }
    if (mode.type === "overwrite_last" &&
        isRebasing &&
        (state === null || state === void 0 ? void 0 : state.patches.length) === 0) {
        mode = { type: "append", name: "initial" };
    }
    const existingPatches = patchFs_1.getGroupedPatches(patchDir).pathSpecifierToPatchFiles[packageDetails.pathSpecifier] || [];
    // apply all existing patches if appending
    // otherwise apply all but the last
    const previouslyAppliedPatches = state === null || state === void 0 ? void 0 : state.patches.filter((p) => p.didApply);
    const patchesToApplyBeforeDiffing = isRebasing
        ? mode.type === "append"
            ? existingPatches.slice(0, previouslyAppliedPatches.length)
            : state.patches[state.patches.length - 1].didApply
                ? existingPatches.slice(0, previouslyAppliedPatches.length - 1)
                : existingPatches.slice(0, previouslyAppliedPatches.length)
        : mode.type === "append"
            ? existingPatches
            : existingPatches.slice(0, -1);
    if (createIssue && mode.type === "append") {
        console_1.default.log("--create-issue is not compatible with --append.");
        process.exit(1);
    }
    if (createIssue && isRebasing) {
        console_1.default.log("--create-issue is not compatible with rebasing.");
        process.exit(1);
    }
    const numPatchesAfterCreate = mode.type === "append" || existingPatches.length === 0
        ? existingPatches.length + 1
        : existingPatches.length;
    const vcs = createIssue_1.getPackageVCSDetails(packageDetails);
    const canCreateIssue = !isRebasing &&
        createIssue_1.shouldRecommendIssue(vcs) &&
        numPatchesAfterCreate === 1 &&
        mode.type !== "append";
    const appPackageJson = require(path_1.join(appPath, "package.json"));
    const packagePath = path_1.join(appPath, packageDetails.path);
    const packageJsonPath = path_1.join(packagePath, "package.json");
    if (!fs_extra_1.existsSync(packageJsonPath)) {
        printNoPackageFoundError(packagePathSpecifier, packageJsonPath);
        process.exit(1);
    }
    const tmpRepo = tmp_1.dirSync({ unsafeCleanup: true });
    const tmpRepoPackagePath = path_1.join(tmpRepo.name, packageDetails.path);
    const tmpRepoNpmRoot = tmpRepoPackagePath.slice(0, -`/node_modules/${packageDetails.name}`.length);
    const tmpRepoPackageJsonPath = path_1.join(tmpRepoNpmRoot, "package.json");
    try {
        const patchesDir = path_1.resolve(path_1.join(appPath, patchDir));
        console_1.default.info(chalk_1.default.grey("•"), "Creating temporary folder");
        // make a blank package.json
        fs_extra_1.mkdirpSync(tmpRepoNpmRoot);
        fs_extra_1.writeFileSync(tmpRepoPackageJsonPath, JSON.stringify({
            dependencies: {
                [packageDetails.name]: getPackageResolution_1.getPackageResolution({
                    packageDetails,
                    packageManager,
                    appPath,
                }),
            },
            resolutions: resolveRelativeFileDependencies_1.resolveRelativeFileDependencies(appPath, appPackageJson.resolutions || {}),
        }));
        const packageVersion = getPackageVersion_1.getPackageVersion(path_1.join(path_1.resolve(packageDetails.path), "package.json"));
        [".npmrc", ".yarnrc", ".yarn"].forEach((rcFile) => {
            const rcPath = path_1.join(appPath, rcFile);
            if (fs_extra_1.existsSync(rcPath)) {
                fs_extra_1.copySync(rcPath, path_1.join(tmpRepo.name, rcFile), { dereference: true });
            }
        });
        if (packageManager === "yarn") {
            console_1.default.info(chalk_1.default.grey("•"), `Installing ${packageDetails.name}@${packageVersion} with yarn`);
            try {
                // try first without ignoring scripts in case they are required
                // this works in 99.99% of cases
                spawnSafe_1.spawnSafeSync(`yarn`, ["install", "--ignore-engines"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: false,
                });
            }
            catch (e) {
                // try again while ignoring scripts in case the script depends on
                // an implicit context which we haven't reproduced
                spawnSafe_1.spawnSafeSync(`yarn`, ["install", "--ignore-engines", "--ignore-scripts"], {
                    cwd: tmpRepoNpmRoot,
                });
            }
        }
        else if (packageManager === "bun") {
            console_1.default.info(chalk_1.default.grey("•"), `Installing ${packageDetails.name}@${packageVersion} with bun`);
            try {
                // Try installing with bun first
                spawnSafe_1.spawnSafeSync(`bun`, ["install", "--no-save"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: true,
                    env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" }),
                });
            }
            catch (e) {
                console_1.default.info(chalk_1.default.yellow("⚠"), `Bun installation failed, falling back to npm`);
                try {
                    // Fall back to npm if bun fails
                    spawnSafe_1.spawnSafeSync(`npm`, ["i", "--force", "--no-fund", "--no-audit"], {
                        cwd: tmpRepoNpmRoot,
                        logStdErrOnError: true,
                        env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" }),
                    });
                }
                catch (e) {
                    // try again while ignoring scripts
                    spawnSafe_1.spawnSafeSync(`npm`, ["i", "--ignore-scripts", "--force", "--no-fund", "--no-audit"], {
                        cwd: tmpRepoNpmRoot,
                        logStdErrOnError: true,
                        env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" }),
                    });
                }
            }
        }
        else {
            console_1.default.info(chalk_1.default.grey("•"), `Installing ${packageDetails.name}@${packageVersion} with npm`);
            try {
                // try first without ignoring scripts in case they are required
                // this works in 99.99% of cases
                spawnSafe_1.spawnSafeSync(`npm`, ["i", "--force", "--no-fund", "--no-audit"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: true,
                    env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" }),
                });
            }
            catch (e) {
                // try again while ignoring scripts in case the script depends on
                // an implicit context which we haven't reproduced
                spawnSafe_1.spawnSafeSync(`npm`, ["i", "--ignore-scripts", "--force", "--no-fund", "--no-audit"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: true,
                    env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" }),
                });
            }
        }
        const git = (...args) => spawnSafe_1.spawnSafeSync("git", args, {
            cwd: tmpRepo.name,
            env: Object.assign(Object.assign({}, process.env), { HOME: tmpRepo.name }),
            maxBuffer: 1024 * 1024 * 100,
        });
        // remove nested node_modules just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // remove .git just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, ".git"));
        // remove patch-package state file
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, stateFile_1.STATE_FILE_NAME));
        // commit the package
        console_1.default.info(chalk_1.default.grey("•"), "Diffing your files with clean files");
        fs_extra_1.writeFileSync(path_1.join(tmpRepo.name, ".gitignore"), "!/node_modules\n\n");
        git("init");
        git("config", "--local", "user.name", "patch-package");
        git("config", "--local", "user.email", "patch@pack.age");
        // remove ignored files first
        filterFiles_1.removeIgnoredFiles(tmpRepoPackagePath, includePaths, excludePaths);
        for (const patchDetails of patchesToApplyBeforeDiffing) {
            if (!applyPatches_1.applyPatch({
                patchDetails,
                patchDir,
                patchFilePath: path_1.join(appPath, patchDir, patchDetails.patchFilename),
                reverse: false,
                cwd: tmpRepo.name,
                bestEffort: false,
            })) {
                // TODO: add better error message once --rebase is implemented
                console_1.default.log(`Failed to apply patch ${patchDetails.patchFilename} to ${packageDetails.pathSpecifier}`);
                process.exit(1);
            }
        }
        git("add", "-f", packageDetails.path);
        git("commit", "--allow-empty", "-m", "init");
        // replace package with user's version
        rimraf_1.sync(tmpRepoPackagePath);
        // pnpm installs packages as symlinks, copySync would copy only the symlink
        fs_extra_1.copySync(fs_extra_1.realpathSync(packagePath), tmpRepoPackagePath);
        // remove nested node_modules just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // remove .git just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, ".git"));
        // remove patch-package state file
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, stateFile_1.STATE_FILE_NAME));
        // also remove ignored files like before
        filterFiles_1.removeIgnoredFiles(tmpRepoPackagePath, includePaths, excludePaths);
        // stage all files
        git("add", "-f", packageDetails.path);
        // get diff of changes
        const diffResult = git("diff", "--cached", "--no-color", "--ignore-space-at-eol", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/");
        if (diffResult.stdout.length === 0) {
            console_1.default.log(`⁉️  Not creating patch file for package '${packagePathSpecifier}'`);
            console_1.default.log(`⁉️  There don't appear to be any changes.`);
            if (isRebasing && mode.type === "overwrite_last") {
                console_1.default.log("\n💡 To remove a patch file, delete it and then reinstall node_modules from scratch.");
            }
            process.exit(1);
            return;
        }
        try {
            parse_1.parsePatchFile(diffResult.stdout.toString());
        }
        catch (e) {
            if (e.message.includes("Unexpected file mode string: 120000")) {
                console_1.default.log(`
⛔️ ${chalk_1.default.red.bold("ERROR")}

  Your changes involve creating symlinks. patch-package does not yet support
  symlinks.

  ️Please use ${chalk_1.default.bold("--include")} and/or ${chalk_1.default.bold("--exclude")} to narrow the scope of your patch if
  this was unintentional.
`);
            }
            else {
                const outPath = "./patch-package-error.json.gz";
                fs_extra_1.writeFileSync(outPath, zlib_1.gzipSync(JSON.stringify({
                    error: { message: e.message, stack: e.stack },
                    patch: diffResult.stdout.toString(),
                })));
                console_1.default.log(`
⛔️ ${chalk_1.default.red.bold("ERROR")}

  patch-package was unable to read the patch-file made by git. This should not
  happen.

  A diagnostic file was written to

    ${outPath}

  Please attach it to a github issue

    https://github.com/ds300/patch-package/issues/new?title=New+patch+parse+failed&body=Please+attach+the+diagnostic+file+by+dragging+it+into+here+🙏

  Note that this diagnostic file will contain code from the package you were
  attempting to patch.

`);
            }
            process.exit(1);
            return;
        }
        // maybe delete existing
        if (mode.type === "append" && !isRebasing && existingPatches.length === 1) {
            // if we are appending to an existing patch that doesn't have a sequence number let's rename it
            const prevPatch = existingPatches[0];
            if (prevPatch.sequenceNumber === undefined) {
                const newFileName = createPatchFileName({
                    packageDetails,
                    packageVersion,
                    sequenceNumber: 1,
                    sequenceName: (_b = prevPatch.sequenceName) !== null && _b !== void 0 ? _b : "initial",
                });
                const oldPath = path_1.join(appPath, patchDir, prevPatch.patchFilename);
                const newPath = path_1.join(appPath, patchDir, newFileName);
                fs_1.renameSync(oldPath, newPath);
                prevPatch.sequenceNumber = 1;
                prevPatch.patchFilename = newFileName;
                prevPatch.sequenceName = (_c = prevPatch.sequenceName) !== null && _c !== void 0 ? _c : "initial";
            }
        }
        const lastPatch = existingPatches[state ? state.patches.length - 1 : existingPatches.length - 1];
        const sequenceName = mode.type === "append" ? mode.name : lastPatch === null || lastPatch === void 0 ? void 0 : lastPatch.sequenceName;
        const sequenceNumber = mode.type === "append"
            ? ((_d = lastPatch === null || lastPatch === void 0 ? void 0 : lastPatch.sequenceNumber) !== null && _d !== void 0 ? _d : 0) + 1
            : lastPatch === null || lastPatch === void 0 ? void 0 : lastPatch.sequenceNumber;
        const patchFileName = createPatchFileName({
            packageDetails,
            packageVersion,
            sequenceName,
            sequenceNumber,
        });
        const patchPath = path_1.join(patchesDir, patchFileName);
        if (!fs_extra_1.existsSync(path_1.dirname(patchPath))) {
            // scoped package
            fs_extra_1.mkdirSync(path_1.dirname(patchPath));
        }
        // if we are inserting a new patch into a sequence we most likely need to update the sequence numbers
        if (isRebasing && mode.type === "append") {
            const patchesToNudge = existingPatches.slice(state.patches.length);
            if (sequenceNumber === undefined) {
                throw new Error("sequenceNumber is undefined while rebasing");
            }
            if (((_e = patchesToNudge[0]) === null || _e === void 0 ? void 0 : _e.sequenceNumber) !== undefined &&
                patchesToNudge[0].sequenceNumber <= sequenceNumber) {
                let next = sequenceNumber + 1;
                for (const p of patchesToNudge) {
                    const newName = createPatchFileName({
                        packageDetails,
                        packageVersion,
                        sequenceName: p.sequenceName,
                        sequenceNumber: next++,
                    });
                    console_1.default.log("Renaming", chalk_1.default.bold(p.patchFilename), "to", chalk_1.default.bold(newName));
                    const oldPath = path_1.join(appPath, patchDir, p.patchFilename);
                    const newPath = path_1.join(appPath, patchDir, newName);
                    fs_1.renameSync(oldPath, newPath);
                }
            }
        }
        fs_extra_1.writeFileSync(patchPath, diffResult.stdout);
        console_1.default.log(`${chalk_1.default.green("✔")} Created file ${path_1.join(patchDir, patchFileName)}\n`);
        const prevState = patchesToApplyBeforeDiffing.map((p) => ({
            patchFilename: p.patchFilename,
            didApply: true,
            patchContentHash: hash_1.hashFile(path_1.join(appPath, patchDir, p.patchFilename)),
        }));
        const nextState = [
            ...prevState,
            {
                patchFilename: patchFileName,
                didApply: true,
                patchContentHash: hash_1.hashFile(patchPath),
            },
        ];
        // if any patches come after this one we just made, we should reapply them
        let didFailWhileFinishingRebase = false;
        if (isRebasing) {
            const currentPatches = patchFs_1.getGroupedPatches(path_1.join(appPath, patchDir))
                .pathSpecifierToPatchFiles[packageDetails.pathSpecifier];
            const previouslyUnappliedPatches = currentPatches.slice(nextState.length);
            if (previouslyUnappliedPatches.length) {
                console_1.default.log(`Fast forwarding...`);
                for (const patch of previouslyUnappliedPatches) {
                    const patchFilePath = path_1.join(appPath, patchDir, patch.patchFilename);
                    if (!applyPatches_1.applyPatch({
                        patchDetails: patch,
                        patchDir,
                        patchFilePath,
                        reverse: false,
                        cwd: process.cwd(),
                        bestEffort: false,
                    })) {
                        didFailWhileFinishingRebase = true;
                        logPatchSequenceError({ patchDetails: patch });
                        nextState.push({
                            patchFilename: patch.patchFilename,
                            didApply: false,
                            patchContentHash: hash_1.hashFile(patchFilePath),
                        });
                        break;
                    }
                    else {
                        console_1.default.log(`  ${chalk_1.default.green("✔")} ${patch.patchFilename}`);
                        nextState.push({
                            patchFilename: patch.patchFilename,
                            didApply: true,
                            patchContentHash: hash_1.hashFile(patchFilePath),
                        });
                    }
                }
            }
        }
        if (isRebasing || numPatchesAfterCreate > 1) {
            stateFile_1.savePatchApplicationState({
                packageDetails,
                patches: nextState,
                isRebasing: didFailWhileFinishingRebase,
            });
        }
        else {
            stateFile_1.clearPatchApplicationState(packageDetails);
        }
        if (canCreateIssue) {
            if (createIssue) {
                createIssue_1.openIssueCreationLink({
                    packageDetails,
                    patchFileContents: diffResult.stdout.toString(),
                    packageVersion,
                });
            }
            else {
                createIssue_1.maybePrintIssueCreationPrompt(vcs, packageDetails, packageManager);
            }
        }
    }
    catch (e) {
        console_1.default.log(e);
        throw e;
    }
    finally {
        tmpRepo.removeCallback();
    }
}
exports.makePatch = makePatch;
function createPatchFileName({ packageDetails, packageVersion, sequenceNumber, sequenceName, }) {
    const packageNames = packageDetails.packageNames
        .map((name) => name.replace(/\//g, "+"))
        .join("++");
    const nameAndVersion = `${packageNames}+${packageVersion}`;
    const num = sequenceNumber === undefined
        ? ""
        : `+${sequenceNumber.toString().padStart(3, "0")}`;
    const name = !sequenceName ? "" : `+${sequenceName}`;
    return `${nameAndVersion}${num}${name}.patch`;
}
function logPatchSequenceError({ patchDetails, }) {
    console_1.default.log(`
${chalk_1.default.red.bold("⛔ ERROR")}

Failed to apply patch file ${chalk_1.default.bold(patchDetails.patchFilename)}.

If this patch file is no longer useful, delete it and run

  ${chalk_1.default.bold(`patch-package`)}

To partially apply the patch (if possible) and output a log of errors to fix, run

  ${chalk_1.default.bold(`patch-package --partial`)}

After which you should make any required changes inside ${patchDetails.path}, and finally run

  ${chalk_1.default.bold(`patch-package ${patchDetails.pathSpecifier}`)}

to update the patch file.
`);
}
exports.logPatchSequenceError = logPatchSequenceError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFrZVBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL21ha2VQYXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBeUI7QUFDekIsc0RBQTZCO0FBQzdCLDJCQUErQjtBQUMvQix1Q0FPaUI7QUFDakIsbUNBQXVDO0FBQ3ZDLDZCQUE2QjtBQUM3QiwrQkFBK0I7QUFDL0IsaURBQTJDO0FBQzNDLCtDQUtzQjtBQUV0QiwrQ0FBa0Q7QUFDbEQsaUVBQTZEO0FBQzdELDJEQUF1RDtBQUN2RCxpQ0FBaUM7QUFDakMscURBSXlCO0FBQ3pCLHlDQUE4QztBQUM5Qyx1Q0FBNkM7QUFDN0MsaUNBQStDO0FBQy9DLHVGQUFtRjtBQUNuRiwyQ0FBMkM7QUFDM0MsMkNBT29CO0FBRXBCLFNBQVMsd0JBQXdCLENBQy9CLFdBQW1CLEVBQ25CLGVBQXVCO0lBRXZCLGlCQUFPLENBQUMsR0FBRyxDQUNULG1CQUFtQixXQUFXOztvQkFFZCxlQUFlLEVBQUUsQ0FDbEMsQ0FBQTtBQUNILENBQUM7QUFFRCxTQUFnQixTQUFTLENBQUMsRUFDeEIsb0JBQW9CLEVBQ3BCLE9BQU8sRUFDUCxjQUFjLEVBQ2QsWUFBWSxFQUNaLFlBQVksRUFDWixRQUFRLEVBQ1IsV0FBVyxFQUNYLElBQUksR0FVTDs7SUFDQyxNQUFNLGNBQWMsR0FBRyw2Q0FBNEIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFBO0lBRXpFLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDbkIsaUJBQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQTtRQUNwRCxPQUFNO0tBQ1A7SUFFRCxNQUFNLEtBQUssR0FBRyxvQ0FBd0IsQ0FBQyxjQUFjLENBQUMsQ0FBQTtJQUN0RCxNQUFNLFVBQVUsR0FBRyxNQUFBLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxVQUFVLG1DQUFJLEtBQUssQ0FBQTtJQUU3QyxpR0FBaUc7SUFDakcsb0RBQW9EO0lBQ3BELElBQ0UsVUFBVTtRQUNWLENBQUEsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxNQUFLLENBQUM7UUFDckQsSUFBSSxDQUFDLElBQUksS0FBSyxnQkFBZ0IsRUFDOUI7UUFDQSxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQTtLQUMzQztJQUVELElBQUksVUFBVSxJQUFJLEtBQUssRUFBRTtRQUN2QixnQ0FBb0IsQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTtLQUNuRDtJQUVELElBQ0UsSUFBSSxDQUFDLElBQUksS0FBSyxnQkFBZ0I7UUFDOUIsVUFBVTtRQUNWLENBQUEsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLE9BQU8sQ0FBQyxNQUFNLE1BQUssQ0FBQyxFQUMzQjtRQUNBLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFBO0tBQzNDO0lBRUQsTUFBTSxlQUFlLEdBQ25CLDJCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLHlCQUF5QixDQUNuRCxjQUFjLENBQUMsYUFBYSxDQUM3QixJQUFJLEVBQUUsQ0FBQTtJQUVULDBDQUEwQztJQUMxQyxtQ0FBbUM7SUFDbkMsTUFBTSx3QkFBd0IsR0FBRyxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFBO0lBQ3pFLE1BQU0sMkJBQTJCLEdBQTRCLFVBQVU7UUFDckUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUTtZQUN0QixDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsd0JBQXlCLENBQUMsTUFBTSxDQUFDO1lBQzVELENBQUMsQ0FBQyxLQUFNLENBQUMsT0FBTyxDQUFDLEtBQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVE7Z0JBQ3BELENBQUMsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSx3QkFBeUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2dCQUNoRSxDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsd0JBQXlCLENBQUMsTUFBTSxDQUFDO1FBQzlELENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVE7WUFDeEIsQ0FBQyxDQUFDLGVBQWU7WUFDakIsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7SUFFaEMsSUFBSSxXQUFXLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDekMsaUJBQU8sQ0FBQyxHQUFHLENBQUMsaURBQWlELENBQUMsQ0FBQTtRQUM5RCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO0tBQ2hCO0lBRUQsSUFBSSxXQUFXLElBQUksVUFBVSxFQUFFO1FBQzdCLGlCQUFPLENBQUMsR0FBRyxDQUFDLGlEQUFpRCxDQUFDLENBQUE7UUFDOUQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNoQjtJQUVELE1BQU0scUJBQXFCLEdBQ3pCLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQztRQUNwRCxDQUFDLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBQzVCLENBQUMsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFBO0lBQzVCLE1BQU0sR0FBRyxHQUFHLGtDQUFvQixDQUFDLGNBQWMsQ0FBQyxDQUFBO0lBQ2hELE1BQU0sY0FBYyxHQUNsQixDQUFDLFVBQVU7UUFDWCxrQ0FBb0IsQ0FBQyxHQUFHLENBQUM7UUFDekIscUJBQXFCLEtBQUssQ0FBQztRQUMzQixJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQTtJQUV4QixNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsV0FBSSxDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFBO0lBQzdELE1BQU0sV0FBVyxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3RELE1BQU0sZUFBZSxHQUFHLFdBQUksQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUE7SUFFekQsSUFBSSxDQUFDLHFCQUFVLENBQUMsZUFBZSxDQUFDLEVBQUU7UUFDaEMsd0JBQXdCLENBQUMsb0JBQW9CLEVBQUUsZUFBZSxDQUFDLENBQUE7UUFDL0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNoQjtJQUVELE1BQU0sT0FBTyxHQUFHLGFBQU8sQ0FBQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO0lBQ2hELE1BQU0sa0JBQWtCLEdBQUcsV0FBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ2xFLE1BQU0sY0FBYyxHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FDN0MsQ0FBQyxFQUNELENBQUMsaUJBQWlCLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQy9DLENBQUE7SUFFRCxNQUFNLHNCQUFzQixHQUFHLFdBQUksQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUE7SUFFbkUsSUFBSTtRQUNGLE1BQU0sVUFBVSxHQUFHLGNBQU8sQ0FBQyxXQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUE7UUFFbkQsaUJBQU8sQ0FBQyxJQUFJLENBQUMsZUFBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSwyQkFBMkIsQ0FBQyxDQUFBO1FBRTFELDRCQUE0QjtRQUM1QixxQkFBVSxDQUFDLGNBQWMsQ0FBQyxDQUFBO1FBQzFCLHdCQUFhLENBQ1gsc0JBQXNCLEVBQ3RCLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDYixZQUFZLEVBQUU7Z0JBQ1osQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsMkNBQW9CLENBQUM7b0JBQzFDLGNBQWM7b0JBQ2QsY0FBYztvQkFDZCxPQUFPO2lCQUNSLENBQUM7YUFDSDtZQUNELFdBQVcsRUFBRSxpRUFBK0IsQ0FDMUMsT0FBTyxFQUNQLGNBQWMsQ0FBQyxXQUFXLElBQUksRUFBRSxDQUNqQztTQUNGLENBQUMsQ0FDSCxDQUFBO1FBRUQsTUFBTSxjQUFjLEdBQUcscUNBQWlCLENBQ3RDLFdBQUksQ0FBQyxjQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUNuRCxDQUtBO1FBQUEsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ2pELE1BQU0sTUFBTSxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUE7WUFDcEMsSUFBSSxxQkFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN0QixtQkFBUSxDQUFDLE1BQU0sRUFBRSxXQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO2FBQ3BFO1FBQ0gsQ0FBQyxDQUFDLENBQUE7UUFFRixJQUFJLGNBQWMsS0FBSyxNQUFNLEVBQUU7WUFDN0IsaUJBQU8sQ0FBQyxJQUFJLENBQ1YsZUFBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFDZixjQUFjLGNBQWMsQ0FBQyxJQUFJLElBQUksY0FBYyxZQUFZLENBQ2hFLENBQUE7WUFDRCxJQUFJO2dCQUNGLCtEQUErRDtnQkFDL0QsZ0NBQWdDO2dCQUNoQyx5QkFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQyxFQUFFO29CQUNyRCxHQUFHLEVBQUUsY0FBYztvQkFDbkIsZ0JBQWdCLEVBQUUsS0FBSztpQkFDeEIsQ0FBQyxDQUFBO2FBQ0g7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDVixpRUFBaUU7Z0JBQ2pFLGtEQUFrRDtnQkFDbEQseUJBQWEsQ0FDWCxNQUFNLEVBQ04sQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLENBQUMsRUFDbkQ7b0JBQ0UsR0FBRyxFQUFFLGNBQWM7aUJBQ3BCLENBQ0YsQ0FBQTthQUNGO1NBQ0Y7YUFBTSxJQUFJLGNBQWMsS0FBSyxLQUFLLEVBQUU7WUFDbkMsaUJBQU8sQ0FBQyxJQUFJLENBQ1YsZUFBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFDZixjQUFjLGNBQWMsQ0FBQyxJQUFJLElBQUksY0FBYyxXQUFXLENBQy9ELENBQUE7WUFDRCxJQUFJO2dCQUNGLGdDQUFnQztnQkFDaEMseUJBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLEVBQUU7b0JBQzdDLEdBQUcsRUFBRSxjQUFjO29CQUNuQixnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QixHQUFHLGtDQUFPLE9BQU8sQ0FBQyxHQUFHLEtBQUUsUUFBUSxFQUFFLGFBQWEsR0FBRTtpQkFDakQsQ0FBQyxDQUFBO2FBQ0g7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDVixpQkFBTyxDQUFDLElBQUksQ0FDVixlQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUNqQiw4Q0FBOEMsQ0FDL0MsQ0FBQTtnQkFDRCxJQUFJO29CQUNGLGdDQUFnQztvQkFDaEMseUJBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsRUFBRTt3QkFDaEUsR0FBRyxFQUFFLGNBQWM7d0JBQ25CLGdCQUFnQixFQUFFLElBQUk7d0JBQ3RCLEdBQUcsa0NBQU8sT0FBTyxDQUFDLEdBQUcsS0FBRSxRQUFRLEVBQUUsYUFBYSxHQUFFO3FCQUNqRCxDQUFDLENBQUE7aUJBQ0g7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1YsbUNBQW1DO29CQUNuQyx5QkFBYSxDQUNYLEtBQUssRUFDTCxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQyxFQUMvRDt3QkFDRSxHQUFHLEVBQUUsY0FBYzt3QkFDbkIsZ0JBQWdCLEVBQUUsSUFBSTt3QkFDdEIsR0FBRyxrQ0FBTyxPQUFPLENBQUMsR0FBRyxLQUFFLFFBQVEsRUFBRSxhQUFhLEdBQUU7cUJBQ2pELENBQ0YsQ0FBQTtpQkFDRjthQUNGO1NBQ0Y7YUFBTTtZQUNMLGlCQUFPLENBQUMsSUFBSSxDQUNWLGVBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQ2YsY0FBYyxjQUFjLENBQUMsSUFBSSxJQUFJLGNBQWMsV0FBVyxDQUMvRCxDQUFBO1lBQ0QsSUFBSTtnQkFDRiwrREFBK0Q7Z0JBQy9ELGdDQUFnQztnQkFDaEMseUJBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsRUFBRTtvQkFDaEUsR0FBRyxFQUFFLGNBQWM7b0JBQ25CLGdCQUFnQixFQUFFLElBQUk7b0JBQ3RCLEdBQUcsa0NBQU8sT0FBTyxDQUFDLEdBQUcsS0FBRSxRQUFRLEVBQUUsYUFBYSxHQUFFO2lCQUNqRCxDQUFDLENBQUE7YUFDSDtZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLGlFQUFpRTtnQkFDakUsa0RBQWtEO2dCQUNsRCx5QkFBYSxDQUNYLEtBQUssRUFDTCxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQyxFQUMvRDtvQkFDRSxHQUFHLEVBQUUsY0FBYztvQkFDbkIsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsR0FBRyxrQ0FBTyxPQUFPLENBQUMsR0FBRyxLQUFFLFFBQVEsRUFBRSxhQUFhLEdBQUU7aUJBQ2pELENBQ0YsQ0FBQTthQUNGO1NBQ0Y7UUFFRCxNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBYyxFQUFFLEVBQUUsQ0FDaEMseUJBQWEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFO1lBQ3pCLEdBQUcsRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNqQixHQUFHLGtDQUFPLE9BQU8sQ0FBQyxHQUFHLEtBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEdBQUU7WUFDM0MsU0FBUyxFQUFFLElBQUksR0FBRyxJQUFJLEdBQUcsR0FBRztTQUM3QixDQUFDLENBQUE7UUFFSiw2Q0FBNkM7UUFDN0MsYUFBTSxDQUFDLFdBQUksQ0FBQyxrQkFBa0IsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFBO1FBQ2hELDhCQUE4QjtRQUM5QixhQUFNLENBQUMsV0FBSSxDQUFDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7UUFDeEMsa0NBQWtDO1FBQ2xDLGFBQU0sQ0FBQyxXQUFJLENBQUMsa0JBQWtCLEVBQUUsMkJBQWUsQ0FBQyxDQUFDLENBQUE7UUFFakQscUJBQXFCO1FBQ3JCLGlCQUFPLENBQUMsSUFBSSxDQUFDLGVBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUscUNBQXFDLENBQUMsQ0FBQTtRQUNwRSx3QkFBYSxDQUFDLFdBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxFQUFFLG9CQUFvQixDQUFDLENBQUE7UUFDckUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFBO1FBQ1gsR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxDQUFBO1FBQ3RELEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO1FBRXhELDZCQUE2QjtRQUM3QixnQ0FBa0IsQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUE7UUFFbEUsS0FBSyxNQUFNLFlBQVksSUFBSSwyQkFBMkIsRUFBRTtZQUN0RCxJQUNFLENBQUMseUJBQVUsQ0FBQztnQkFDVixZQUFZO2dCQUNaLFFBQVE7Z0JBQ1IsYUFBYSxFQUFFLFdBQUksQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxhQUFhLENBQUM7Z0JBQ2xFLE9BQU8sRUFBRSxLQUFLO2dCQUNkLEdBQUcsRUFBRSxPQUFPLENBQUMsSUFBSTtnQkFDakIsVUFBVSxFQUFFLEtBQUs7YUFDbEIsQ0FBQyxFQUNGO2dCQUNBLDhEQUE4RDtnQkFDOUQsaUJBQU8sQ0FBQyxHQUFHLENBQ1QseUJBQXlCLFlBQVksQ0FBQyxhQUFhLE9BQU8sY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUN6RixDQUFBO2dCQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7YUFDaEI7U0FDRjtRQUNELEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNyQyxHQUFHLENBQUMsUUFBUSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUE7UUFFNUMsc0NBQXNDO1FBQ3RDLGFBQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO1FBRTFCLDJFQUEyRTtRQUMzRSxtQkFBUSxDQUFDLHVCQUFZLENBQUMsV0FBVyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQTtRQUV2RCw2Q0FBNkM7UUFDN0MsYUFBTSxDQUFDLFdBQUksQ0FBQyxrQkFBa0IsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFBO1FBQ2hELDhCQUE4QjtRQUM5QixhQUFNLENBQUMsV0FBSSxDQUFDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUE7UUFDeEMsa0NBQWtDO1FBQ2xDLGFBQU0sQ0FBQyxXQUFJLENBQUMsa0JBQWtCLEVBQUUsMkJBQWUsQ0FBQyxDQUFDLENBQUE7UUFFakQsd0NBQXdDO1FBQ3hDLGdDQUFrQixDQUFDLGtCQUFrQixFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsQ0FBQTtRQUVsRSxrQkFBa0I7UUFDbEIsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBRXJDLHNCQUFzQjtRQUN0QixNQUFNLFVBQVUsR0FBRyxHQUFHLENBQ3BCLE1BQU0sRUFDTixVQUFVLEVBQ1YsWUFBWSxFQUNaLHVCQUF1QixFQUN2QixlQUFlLEVBQ2YsaUJBQWlCLEVBQ2pCLGlCQUFpQixDQUNsQixDQUFBO1FBRUQsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDbEMsaUJBQU8sQ0FBQyxHQUFHLENBQ1QsNENBQTRDLG9CQUFvQixHQUFHLENBQ3BFLENBQUE7WUFDRCxpQkFBTyxDQUFDLEdBQUcsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFBO1lBQ3hELElBQUksVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssZ0JBQWdCLEVBQUU7Z0JBQ2hELGlCQUFPLENBQUMsR0FBRyxDQUNULHNGQUFzRixDQUN2RixDQUFBO2FBQ0Y7WUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBQ2YsT0FBTTtTQUNQO1FBRUQsSUFBSTtZQUNGLHNCQUFjLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO1NBQzdDO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixJQUNHLENBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLHFDQUFxQyxDQUFDLEVBQ3BFO2dCQUNBLGlCQUFPLENBQUMsR0FBRyxDQUFDO0tBQ2YsZUFBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDOzs7OztnQkFLWixlQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLGVBQUssQ0FBQyxJQUFJLENBQ2xELFdBQVcsQ0FDWjs7Q0FFUixDQUFDLENBQUE7YUFDSztpQkFBTTtnQkFDTCxNQUFNLE9BQU8sR0FBRywrQkFBK0IsQ0FBQTtnQkFDL0Msd0JBQWEsQ0FDWCxPQUFPLEVBQ1AsZUFBUSxDQUNOLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQ2IsS0FBSyxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxLQUFLLEVBQUU7b0JBQzdDLEtBQUssRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRTtpQkFDcEMsQ0FBQyxDQUNILENBQ0YsQ0FBQTtnQkFDRCxpQkFBTyxDQUFDLEdBQUcsQ0FBQztLQUNmLGVBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQzs7Ozs7OztNQU90QixPQUFPOzs7Ozs7Ozs7Q0FTWixDQUFDLENBQUE7YUFDSztZQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFDZixPQUFNO1NBQ1A7UUFFRCx3QkFBd0I7UUFDeEIsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLFVBQVUsSUFBSSxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN6RSwrRkFBK0Y7WUFDL0YsTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFBO1lBQ3BDLElBQUksU0FBUyxDQUFDLGNBQWMsS0FBSyxTQUFTLEVBQUU7Z0JBQzFDLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFDO29CQUN0QyxjQUFjO29CQUNkLGNBQWM7b0JBQ2QsY0FBYyxFQUFFLENBQUM7b0JBQ2pCLFlBQVksRUFBRSxNQUFBLFNBQVMsQ0FBQyxZQUFZLG1DQUFJLFNBQVM7aUJBQ2xELENBQUMsQ0FBQTtnQkFDRixNQUFNLE9BQU8sR0FBRyxXQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUE7Z0JBQ2hFLE1BQU0sT0FBTyxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFBO2dCQUNwRCxlQUFVLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFBO2dCQUM1QixTQUFTLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQTtnQkFDNUIsU0FBUyxDQUFDLGFBQWEsR0FBRyxXQUFXLENBQUE7Z0JBQ3JDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsTUFBQSxTQUFTLENBQUMsWUFBWSxtQ0FBSSxTQUFTLENBQUE7YUFDN0Q7U0FDRjtRQUVELE1BQU0sU0FBUyxHQUFHLGVBQWUsQ0FDL0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUN6QixDQUFBO1FBQ3RDLE1BQU0sWUFBWSxHQUNoQixJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLFlBQVksQ0FBQTtRQUM5RCxNQUFNLGNBQWMsR0FDbEIsSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRO1lBQ3BCLENBQUMsQ0FBQyxDQUFDLE1BQUEsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLGNBQWMsbUNBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUN0QyxDQUFDLENBQUMsU0FBUyxhQUFULFNBQVMsdUJBQVQsU0FBUyxDQUFFLGNBQWMsQ0FBQTtRQUUvQixNQUFNLGFBQWEsR0FBRyxtQkFBbUIsQ0FBQztZQUN4QyxjQUFjO1lBQ2QsY0FBYztZQUNkLFlBQVk7WUFDWixjQUFjO1NBQ2YsQ0FBQyxDQUFBO1FBRUYsTUFBTSxTQUFTLEdBQUcsV0FBSSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQTtRQUNqRCxJQUFJLENBQUMscUJBQVUsQ0FBQyxjQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRTtZQUNuQyxpQkFBaUI7WUFDakIsb0JBQVMsQ0FBQyxjQUFPLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQTtTQUM5QjtRQUVELHFHQUFxRztRQUNyRyxJQUFJLFVBQVUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtZQUN4QyxNQUFNLGNBQWMsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUE7WUFDbkUsSUFBSSxjQUFjLEtBQUssU0FBUyxFQUFFO2dCQUNoQyxNQUFNLElBQUksS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUE7YUFDOUQ7WUFDRCxJQUNFLENBQUEsTUFBQSxjQUFjLENBQUMsQ0FBQyxDQUFDLDBDQUFFLGNBQWMsTUFBSyxTQUFTO2dCQUMvQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxJQUFJLGNBQWMsRUFDbEQ7Z0JBQ0EsSUFBSSxJQUFJLEdBQUcsY0FBYyxHQUFHLENBQUMsQ0FBQTtnQkFDN0IsS0FBSyxNQUFNLENBQUMsSUFBSSxjQUFjLEVBQUU7b0JBQzlCLE1BQU0sT0FBTyxHQUFHLG1CQUFtQixDQUFDO3dCQUNsQyxjQUFjO3dCQUNkLGNBQWM7d0JBQ2QsWUFBWSxFQUFFLENBQUMsQ0FBQyxZQUFZO3dCQUM1QixjQUFjLEVBQUUsSUFBSSxFQUFFO3FCQUN2QixDQUFDLENBQUE7b0JBQ0YsaUJBQU8sQ0FBQyxHQUFHLENBQ1QsVUFBVSxFQUNWLGVBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxFQUMzQixJQUFJLEVBQ0osZUFBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FDcEIsQ0FBQTtvQkFDRCxNQUFNLE9BQU8sR0FBRyxXQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUE7b0JBQ3hELE1BQU0sT0FBTyxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFBO29CQUNoRCxlQUFVLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFBO2lCQUM3QjthQUNGO1NBQ0Y7UUFFRCx3QkFBYSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUE7UUFDM0MsaUJBQU8sQ0FBQyxHQUFHLENBQ1QsR0FBRyxlQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsV0FBSSxDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUMsSUFBSSxDQUN0RSxDQUFBO1FBRUQsTUFBTSxTQUFTLEdBQWlCLDJCQUEyQixDQUFDLEdBQUcsQ0FDN0QsQ0FBQyxDQUFDLEVBQWMsRUFBRSxDQUFDLENBQUM7WUFDbEIsYUFBYSxFQUFFLENBQUMsQ0FBQyxhQUFhO1lBQzlCLFFBQVEsRUFBRSxJQUFJO1lBQ2QsZ0JBQWdCLEVBQUUsZUFBUSxDQUFDLFdBQUksQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUNyRSxDQUFDLENBQ0gsQ0FBQTtRQUNELE1BQU0sU0FBUyxHQUFpQjtZQUM5QixHQUFHLFNBQVM7WUFDWjtnQkFDRSxhQUFhLEVBQUUsYUFBYTtnQkFDNUIsUUFBUSxFQUFFLElBQUk7Z0JBQ2QsZ0JBQWdCLEVBQUUsZUFBUSxDQUFDLFNBQVMsQ0FBQzthQUN0QztTQUNGLENBQUE7UUFFRCwwRUFBMEU7UUFDMUUsSUFBSSwyQkFBMkIsR0FBRyxLQUFLLENBQUE7UUFDdkMsSUFBSSxVQUFVLEVBQUU7WUFDZCxNQUFNLGNBQWMsR0FBRywyQkFBaUIsQ0FBQyxXQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUM5RCx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUE7WUFFMUQsTUFBTSwwQkFBMEIsR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQTtZQUN6RSxJQUFJLDBCQUEwQixDQUFDLE1BQU0sRUFBRTtnQkFDckMsaUJBQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQTtnQkFDakMsS0FBSyxNQUFNLEtBQUssSUFBSSwwQkFBMEIsRUFBRTtvQkFDOUMsTUFBTSxhQUFhLEdBQUcsV0FBSSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFBO29CQUNsRSxJQUNFLENBQUMseUJBQVUsQ0FBQzt3QkFDVixZQUFZLEVBQUUsS0FBSzt3QkFDbkIsUUFBUTt3QkFDUixhQUFhO3dCQUNiLE9BQU8sRUFBRSxLQUFLO3dCQUNkLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO3dCQUNsQixVQUFVLEVBQUUsS0FBSztxQkFDbEIsQ0FBQyxFQUNGO3dCQUNBLDJCQUEyQixHQUFHLElBQUksQ0FBQTt3QkFDbEMscUJBQXFCLENBQUMsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQTt3QkFDOUMsU0FBUyxDQUFDLElBQUksQ0FBQzs0QkFDYixhQUFhLEVBQUUsS0FBSyxDQUFDLGFBQWE7NEJBQ2xDLFFBQVEsRUFBRSxLQUFLOzRCQUNmLGdCQUFnQixFQUFFLGVBQVEsQ0FBQyxhQUFhLENBQUM7eUJBQzFDLENBQUMsQ0FBQTt3QkFDRixNQUFLO3FCQUNOO3lCQUFNO3dCQUNMLGlCQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssZUFBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQTt3QkFDM0QsU0FBUyxDQUFDLElBQUksQ0FBQzs0QkFDYixhQUFhLEVBQUUsS0FBSyxDQUFDLGFBQWE7NEJBQ2xDLFFBQVEsRUFBRSxJQUFJOzRCQUNkLGdCQUFnQixFQUFFLGVBQVEsQ0FBQyxhQUFhLENBQUM7eUJBQzFDLENBQUMsQ0FBQTtxQkFDSDtpQkFDRjthQUNGO1NBQ0Y7UUFFRCxJQUFJLFVBQVUsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLEVBQUU7WUFDM0MscUNBQXlCLENBQUM7Z0JBQ3hCLGNBQWM7Z0JBQ2QsT0FBTyxFQUFFLFNBQVM7Z0JBQ2xCLFVBQVUsRUFBRSwyQkFBMkI7YUFDeEMsQ0FBQyxDQUFBO1NBQ0g7YUFBTTtZQUNMLHNDQUEwQixDQUFDLGNBQWMsQ0FBQyxDQUFBO1NBQzNDO1FBRUQsSUFBSSxjQUFjLEVBQUU7WUFDbEIsSUFBSSxXQUFXLEVBQUU7Z0JBQ2YsbUNBQXFCLENBQUM7b0JBQ3BCLGNBQWM7b0JBQ2QsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7b0JBQy9DLGNBQWM7aUJBQ2YsQ0FBQyxDQUFBO2FBQ0g7aUJBQU07Z0JBQ0wsMkNBQTZCLENBQUMsR0FBRyxFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQTthQUNuRTtTQUNGO0tBQ0Y7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLGlCQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ2QsTUFBTSxDQUFDLENBQUE7S0FDUjtZQUFTO1FBQ1IsT0FBTyxDQUFDLGNBQWMsRUFBRSxDQUFBO0tBQ3pCO0FBQ0gsQ0FBQztBQXpoQkQsOEJBeWhCQztBQUVELFNBQVMsbUJBQW1CLENBQUMsRUFDM0IsY0FBYyxFQUNkLGNBQWMsRUFDZCxjQUFjLEVBQ2QsWUFBWSxHQU1iO0lBQ0MsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDLFlBQVk7U0FDN0MsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7SUFFYixNQUFNLGNBQWMsR0FBRyxHQUFHLFlBQVksSUFBSSxjQUFjLEVBQUUsQ0FBQTtJQUMxRCxNQUFNLEdBQUcsR0FDUCxjQUFjLEtBQUssU0FBUztRQUMxQixDQUFDLENBQUMsRUFBRTtRQUNKLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUE7SUFDdEQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQTtJQUVwRCxPQUFPLEdBQUcsY0FBYyxHQUFHLEdBQUcsR0FBRyxJQUFJLFFBQVEsQ0FBQTtBQUMvQyxDQUFDO0FBRUQsU0FBZ0IscUJBQXFCLENBQUMsRUFDcEMsWUFBWSxHQUdiO0lBQ0MsaUJBQU8sQ0FBQyxHQUFHLENBQUM7RUFDWixlQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7OzZCQUVFLGVBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQzs7OztJQUkvRCxlQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQzs7OztJQUkzQixlQUFLLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDOzswREFHckMsWUFBWSxDQUFDLElBQ2Y7O0lBRUUsZUFBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsWUFBWSxDQUFDLGFBQWEsRUFBRSxDQUFDOzs7Q0FHNUQsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQTFCRCxzREEwQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCJcbmltcG9ydCBjb25zb2xlIGZyb20gXCJjb25zb2xlXCJcbmltcG9ydCB7IHJlbmFtZVN5bmMgfSBmcm9tIFwiZnNcIlxuaW1wb3J0IHtcbiAgY29weVN5bmMsXG4gIGV4aXN0c1N5bmMsXG4gIG1rZGlycFN5bmMsXG4gIG1rZGlyU3luYyxcbiAgcmVhbHBhdGhTeW5jLFxuICB3cml0ZUZpbGVTeW5jLFxufSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgc3luYyBhcyByaW1yYWYgfSBmcm9tIFwicmltcmFmXCJcbmltcG9ydCB7IGRpclN5bmMgfSBmcm9tIFwidG1wXCJcbmltcG9ydCB7IGd6aXBTeW5jIH0gZnJvbSBcInpsaWJcIlxuaW1wb3J0IHsgYXBwbHlQYXRjaCB9IGZyb20gXCIuL2FwcGx5UGF0Y2hlc1wiXG5pbXBvcnQge1xuICBnZXRQYWNrYWdlVkNTRGV0YWlscyxcbiAgbWF5YmVQcmludElzc3VlQ3JlYXRpb25Qcm9tcHQsXG4gIG9wZW5Jc3N1ZUNyZWF0aW9uTGluayxcbiAgc2hvdWxkUmVjb21tZW5kSXNzdWUsXG59IGZyb20gXCIuL2NyZWF0ZUlzc3VlXCJcbmltcG9ydCB7IFBhY2thZ2VNYW5hZ2VyIH0gZnJvbSBcIi4vZGV0ZWN0UGFja2FnZU1hbmFnZXJcIlxuaW1wb3J0IHsgcmVtb3ZlSWdub3JlZEZpbGVzIH0gZnJvbSBcIi4vZmlsdGVyRmlsZXNcIlxuaW1wb3J0IHsgZ2V0UGFja2FnZVJlc29sdXRpb24gfSBmcm9tIFwiLi9nZXRQYWNrYWdlUmVzb2x1dGlvblwiXG5pbXBvcnQgeyBnZXRQYWNrYWdlVmVyc2lvbiB9IGZyb20gXCIuL2dldFBhY2thZ2VWZXJzaW9uXCJcbmltcG9ydCB7IGhhc2hGaWxlIH0gZnJvbSBcIi4vaGFzaFwiXG5pbXBvcnQge1xuICBnZXRQYXRjaERldGFpbHNGcm9tQ2xpU3RyaW5nLFxuICBQYWNrYWdlRGV0YWlscyxcbiAgUGF0Y2hlZFBhY2thZ2VEZXRhaWxzLFxufSBmcm9tIFwiLi9QYWNrYWdlRGV0YWlsc1wiXG5pbXBvcnQgeyBwYXJzZVBhdGNoRmlsZSB9IGZyb20gXCIuL3BhdGNoL3BhcnNlXCJcbmltcG9ydCB7IGdldEdyb3VwZWRQYXRjaGVzIH0gZnJvbSBcIi4vcGF0Y2hGc1wiXG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luLCByZXNvbHZlIH0gZnJvbSBcIi4vcGF0aFwiXG5pbXBvcnQgeyByZXNvbHZlUmVsYXRpdmVGaWxlRGVwZW5kZW5jaWVzIH0gZnJvbSBcIi4vcmVzb2x2ZVJlbGF0aXZlRmlsZURlcGVuZGVuY2llc1wiXG5pbXBvcnQgeyBzcGF3blNhZmVTeW5jIH0gZnJvbSBcIi4vc3Bhd25TYWZlXCJcbmltcG9ydCB7XG4gIGNsZWFyUGF0Y2hBcHBsaWNhdGlvblN0YXRlLFxuICBnZXRQYXRjaEFwcGxpY2F0aW9uU3RhdGUsXG4gIFBhdGNoU3RhdGUsXG4gIHNhdmVQYXRjaEFwcGxpY2F0aW9uU3RhdGUsXG4gIFNUQVRFX0ZJTEVfTkFNRSxcbiAgdmVyaWZ5QXBwbGllZFBhdGNoZXMsXG59IGZyb20gXCIuL3N0YXRlRmlsZVwiXG5cbmZ1bmN0aW9uIHByaW50Tm9QYWNrYWdlRm91bmRFcnJvcihcbiAgcGFja2FnZU5hbWU6IHN0cmluZyxcbiAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmcsXG4pIHtcbiAgY29uc29sZS5sb2coXG4gICAgYE5vIHN1Y2ggcGFja2FnZSAke3BhY2thZ2VOYW1lfVxuXG4gIEZpbGUgbm90IGZvdW5kOiAke3BhY2thZ2VKc29uUGF0aH1gLFxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUGF0Y2goe1xuICBwYWNrYWdlUGF0aFNwZWNpZmllcixcbiAgYXBwUGF0aCxcbiAgcGFja2FnZU1hbmFnZXIsXG4gIGluY2x1ZGVQYXRocyxcbiAgZXhjbHVkZVBhdGhzLFxuICBwYXRjaERpcixcbiAgY3JlYXRlSXNzdWUsXG4gIG1vZGUsXG59OiB7XG4gIHBhY2thZ2VQYXRoU3BlY2lmaWVyOiBzdHJpbmdcbiAgYXBwUGF0aDogc3RyaW5nXG4gIHBhY2thZ2VNYW5hZ2VyOiBQYWNrYWdlTWFuYWdlclxuICBpbmNsdWRlUGF0aHM6IFJlZ0V4cFxuICBleGNsdWRlUGF0aHM6IFJlZ0V4cFxuICBwYXRjaERpcjogc3RyaW5nXG4gIGNyZWF0ZUlzc3VlOiBib29sZWFuXG4gIG1vZGU6IHsgdHlwZTogXCJvdmVyd3JpdGVfbGFzdFwiIH0gfCB7IHR5cGU6IFwiYXBwZW5kXCI7IG5hbWU/OiBzdHJpbmcgfVxufSkge1xuICBjb25zdCBwYWNrYWdlRGV0YWlscyA9IGdldFBhdGNoRGV0YWlsc0Zyb21DbGlTdHJpbmcocGFja2FnZVBhdGhTcGVjaWZpZXIpXG5cbiAgaWYgKCFwYWNrYWdlRGV0YWlscykge1xuICAgIGNvbnNvbGUubG9nKFwiTm8gc3VjaCBwYWNrYWdlXCIsIHBhY2thZ2VQYXRoU3BlY2lmaWVyKVxuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3Qgc3RhdGUgPSBnZXRQYXRjaEFwcGxpY2F0aW9uU3RhdGUocGFja2FnZURldGFpbHMpXG4gIGNvbnN0IGlzUmViYXNpbmcgPSBzdGF0ZT8uaXNSZWJhc2luZyA/PyBmYWxzZVxuXG4gIC8vIElmIHdlIGFyZSByZWJhc2luZyBhbmQgbm8gcGF0Y2hlcyBoYXZlIGJlZW4gYXBwbGllZCwgLS1hcHBlbmQgaXMgdGhlIG9ubHkgdmFsaWQgb3B0aW9uIGJlY2F1c2VcbiAgLy8gdGhlcmUgYXJlIG5vIHByZXZpb3VzIHBhdGNoZXMgdG8gb3ZlcndyaXRlL3VwZGF0ZVxuICBpZiAoXG4gICAgaXNSZWJhc2luZyAmJlxuICAgIHN0YXRlPy5wYXRjaGVzLmZpbHRlcigocCkgPT4gcC5kaWRBcHBseSkubGVuZ3RoID09PSAwICYmXG4gICAgbW9kZS50eXBlID09PSBcIm92ZXJ3cml0ZV9sYXN0XCJcbiAgKSB7XG4gICAgbW9kZSA9IHsgdHlwZTogXCJhcHBlbmRcIiwgbmFtZTogXCJpbml0aWFsXCIgfVxuICB9XG5cbiAgaWYgKGlzUmViYXNpbmcgJiYgc3RhdGUpIHtcbiAgICB2ZXJpZnlBcHBsaWVkUGF0Y2hlcyh7IGFwcFBhdGgsIHBhdGNoRGlyLCBzdGF0ZSB9KVxuICB9XG5cbiAgaWYgKFxuICAgIG1vZGUudHlwZSA9PT0gXCJvdmVyd3JpdGVfbGFzdFwiICYmXG4gICAgaXNSZWJhc2luZyAmJlxuICAgIHN0YXRlPy5wYXRjaGVzLmxlbmd0aCA9PT0gMFxuICApIHtcbiAgICBtb2RlID0geyB0eXBlOiBcImFwcGVuZFwiLCBuYW1lOiBcImluaXRpYWxcIiB9XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1BhdGNoZXMgPVxuICAgIGdldEdyb3VwZWRQYXRjaGVzKHBhdGNoRGlyKS5wYXRoU3BlY2lmaWVyVG9QYXRjaEZpbGVzW1xuICAgICAgcGFja2FnZURldGFpbHMucGF0aFNwZWNpZmllclxuICAgIF0gfHwgW11cblxuICAvLyBhcHBseSBhbGwgZXhpc3RpbmcgcGF0Y2hlcyBpZiBhcHBlbmRpbmdcbiAgLy8gb3RoZXJ3aXNlIGFwcGx5IGFsbCBidXQgdGhlIGxhc3RcbiAgY29uc3QgcHJldmlvdXNseUFwcGxpZWRQYXRjaGVzID0gc3RhdGU/LnBhdGNoZXMuZmlsdGVyKChwKSA9PiBwLmRpZEFwcGx5KVxuICBjb25zdCBwYXRjaGVzVG9BcHBseUJlZm9yZURpZmZpbmc6IFBhdGNoZWRQYWNrYWdlRGV0YWlsc1tdID0gaXNSZWJhc2luZ1xuICAgID8gbW9kZS50eXBlID09PSBcImFwcGVuZFwiXG4gICAgICA/IGV4aXN0aW5nUGF0Y2hlcy5zbGljZSgwLCBwcmV2aW91c2x5QXBwbGllZFBhdGNoZXMhLmxlbmd0aClcbiAgICAgIDogc3RhdGUhLnBhdGNoZXNbc3RhdGUhLnBhdGNoZXMubGVuZ3RoIC0gMV0uZGlkQXBwbHlcbiAgICAgID8gZXhpc3RpbmdQYXRjaGVzLnNsaWNlKDAsIHByZXZpb3VzbHlBcHBsaWVkUGF0Y2hlcyEubGVuZ3RoIC0gMSlcbiAgICAgIDogZXhpc3RpbmdQYXRjaGVzLnNsaWNlKDAsIHByZXZpb3VzbHlBcHBsaWVkUGF0Y2hlcyEubGVuZ3RoKVxuICAgIDogbW9kZS50eXBlID09PSBcImFwcGVuZFwiXG4gICAgPyBleGlzdGluZ1BhdGNoZXNcbiAgICA6IGV4aXN0aW5nUGF0Y2hlcy5zbGljZSgwLCAtMSlcblxuICBpZiAoY3JlYXRlSXNzdWUgJiYgbW9kZS50eXBlID09PSBcImFwcGVuZFwiKSB7XG4gICAgY29uc29sZS5sb2coXCItLWNyZWF0ZS1pc3N1ZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIC0tYXBwZW5kLlwiKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgaWYgKGNyZWF0ZUlzc3VlICYmIGlzUmViYXNpbmcpIHtcbiAgICBjb25zb2xlLmxvZyhcIi0tY3JlYXRlLWlzc3VlIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggcmViYXNpbmcuXCIpXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cblxuICBjb25zdCBudW1QYXRjaGVzQWZ0ZXJDcmVhdGUgPVxuICAgIG1vZGUudHlwZSA9PT0gXCJhcHBlbmRcIiB8fCBleGlzdGluZ1BhdGNoZXMubGVuZ3RoID09PSAwXG4gICAgICA/IGV4aXN0aW5nUGF0Y2hlcy5sZW5ndGggKyAxXG4gICAgICA6IGV4aXN0aW5nUGF0Y2hlcy5sZW5ndGhcbiAgY29uc3QgdmNzID0gZ2V0UGFja2FnZVZDU0RldGFpbHMocGFja2FnZURldGFpbHMpXG4gIGNvbnN0IGNhbkNyZWF0ZUlzc3VlID1cbiAgICAhaXNSZWJhc2luZyAmJlxuICAgIHNob3VsZFJlY29tbWVuZElzc3VlKHZjcykgJiZcbiAgICBudW1QYXRjaGVzQWZ0ZXJDcmVhdGUgPT09IDEgJiZcbiAgICBtb2RlLnR5cGUgIT09IFwiYXBwZW5kXCJcblxuICBjb25zdCBhcHBQYWNrYWdlSnNvbiA9IHJlcXVpcmUoam9pbihhcHBQYXRoLCBcInBhY2thZ2UuanNvblwiKSlcbiAgY29uc3QgcGFja2FnZVBhdGggPSBqb2luKGFwcFBhdGgsIHBhY2thZ2VEZXRhaWxzLnBhdGgpXG4gIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IGpvaW4ocGFja2FnZVBhdGgsIFwicGFja2FnZS5qc29uXCIpXG5cbiAgaWYgKCFleGlzdHNTeW5jKHBhY2thZ2VKc29uUGF0aCkpIHtcbiAgICBwcmludE5vUGFja2FnZUZvdW5kRXJyb3IocGFja2FnZVBhdGhTcGVjaWZpZXIsIHBhY2thZ2VKc29uUGF0aClcbiAgICBwcm9jZXNzLmV4aXQoMSlcbiAgfVxuXG4gIGNvbnN0IHRtcFJlcG8gPSBkaXJTeW5jKHsgdW5zYWZlQ2xlYW51cDogdHJ1ZSB9KVxuICBjb25zdCB0bXBSZXBvUGFja2FnZVBhdGggPSBqb2luKHRtcFJlcG8ubmFtZSwgcGFja2FnZURldGFpbHMucGF0aClcbiAgY29uc3QgdG1wUmVwb05wbVJvb3QgPSB0bXBSZXBvUGFja2FnZVBhdGguc2xpY2UoXG4gICAgMCxcbiAgICAtYC9ub2RlX21vZHVsZXMvJHtwYWNrYWdlRGV0YWlscy5uYW1lfWAubGVuZ3RoLFxuICApXG5cbiAgY29uc3QgdG1wUmVwb1BhY2thZ2VKc29uUGF0aCA9IGpvaW4odG1wUmVwb05wbVJvb3QsIFwicGFja2FnZS5qc29uXCIpXG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXRjaGVzRGlyID0gcmVzb2x2ZShqb2luKGFwcFBhdGgsIHBhdGNoRGlyKSlcblxuICAgIGNvbnNvbGUuaW5mbyhjaGFsay5ncmV5KFwi4oCiXCIpLCBcIkNyZWF0aW5nIHRlbXBvcmFyeSBmb2xkZXJcIilcblxuICAgIC8vIG1ha2UgYSBibGFuayBwYWNrYWdlLmpzb25cbiAgICBta2RpcnBTeW5jKHRtcFJlcG9OcG1Sb290KVxuICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICB0bXBSZXBvUGFja2FnZUpzb25QYXRoLFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBkZXBlbmRlbmNpZXM6IHtcbiAgICAgICAgICBbcGFja2FnZURldGFpbHMubmFtZV06IGdldFBhY2thZ2VSZXNvbHV0aW9uKHtcbiAgICAgICAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgICAgICAgcGFja2FnZU1hbmFnZXIsXG4gICAgICAgICAgICBhcHBQYXRoLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICByZXNvbHV0aW9uczogcmVzb2x2ZVJlbGF0aXZlRmlsZURlcGVuZGVuY2llcyhcbiAgICAgICAgICBhcHBQYXRoLFxuICAgICAgICAgIGFwcFBhY2thZ2VKc29uLnJlc29sdXRpb25zIHx8IHt9LFxuICAgICAgICApLFxuICAgICAgfSksXG4gICAgKVxuXG4gICAgY29uc3QgcGFja2FnZVZlcnNpb24gPSBnZXRQYWNrYWdlVmVyc2lvbihcbiAgICAgIGpvaW4ocmVzb2x2ZShwYWNrYWdlRGV0YWlscy5wYXRoKSwgXCJwYWNrYWdlLmpzb25cIiksXG4gICAgKVxuXG4gICAgLy8gY29weSAubnBtcmMvLnlhcm5yYyBpbiBjYXNlIHBhY2thZ2VzIGFyZSBob3N0ZWQgaW4gcHJpdmF0ZSByZWdpc3RyeVxuICAgIC8vIGNvcHkgLnlhcm4gZGlyZWN0b3J5IGFzIHdlbGwgdG8gZW5zdXJlIGluc3RhbGxhdGlvbnMgd29yayBpbiB5YXJuIDJcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6YWxpZ25cbiAgICA7W1wiLm5wbXJjXCIsIFwiLnlhcm5yY1wiLCBcIi55YXJuXCJdLmZvckVhY2goKHJjRmlsZSkgPT4ge1xuICAgICAgY29uc3QgcmNQYXRoID0gam9pbihhcHBQYXRoLCByY0ZpbGUpXG4gICAgICBpZiAoZXhpc3RzU3luYyhyY1BhdGgpKSB7XG4gICAgICAgIGNvcHlTeW5jKHJjUGF0aCwgam9pbih0bXBSZXBvLm5hbWUsIHJjRmlsZSksIHsgZGVyZWZlcmVuY2U6IHRydWUgfSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgaWYgKHBhY2thZ2VNYW5hZ2VyID09PSBcInlhcm5cIikge1xuICAgICAgY29uc29sZS5pbmZvKFxuICAgICAgICBjaGFsay5ncmV5KFwi4oCiXCIpLFxuICAgICAgICBgSW5zdGFsbGluZyAke3BhY2thZ2VEZXRhaWxzLm5hbWV9QCR7cGFja2FnZVZlcnNpb259IHdpdGggeWFybmAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyB0cnkgZmlyc3Qgd2l0aG91dCBpZ25vcmluZyBzY3JpcHRzIGluIGNhc2UgdGhleSBhcmUgcmVxdWlyZWRcbiAgICAgICAgLy8gdGhpcyB3b3JrcyBpbiA5OS45OSUgb2YgY2FzZXNcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgeWFybmAsIFtcImluc3RhbGxcIiwgXCItLWlnbm9yZS1lbmdpbmVzXCJdLCB7XG4gICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgfSlcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gdHJ5IGFnYWluIHdoaWxlIGlnbm9yaW5nIHNjcmlwdHMgaW4gY2FzZSB0aGUgc2NyaXB0IGRlcGVuZHMgb25cbiAgICAgICAgLy8gYW4gaW1wbGljaXQgY29udGV4dCB3aGljaCB3ZSBoYXZlbid0IHJlcHJvZHVjZWRcbiAgICAgICAgc3Bhd25TYWZlU3luYyhcbiAgICAgICAgICBgeWFybmAsXG4gICAgICAgICAgW1wiaW5zdGFsbFwiLCBcIi0taWdub3JlLWVuZ2luZXNcIiwgXCItLWlnbm9yZS1zY3JpcHRzXCJdLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGN3ZDogdG1wUmVwb05wbVJvb3QsXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocGFja2FnZU1hbmFnZXIgPT09IFwiYnVuXCIpIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgICAgY2hhbGsuZ3JleShcIuKAolwiKSxcbiAgICAgICAgYEluc3RhbGxpbmcgJHtwYWNrYWdlRGV0YWlscy5uYW1lfUAke3BhY2thZ2VWZXJzaW9ufSB3aXRoIGJ1bmAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyBUcnkgaW5zdGFsbGluZyB3aXRoIGJ1biBmaXJzdFxuICAgICAgICBzcGF3blNhZmVTeW5jKGBidW5gLCBbXCJpbnN0YWxsXCIsIFwiLS1uby1zYXZlXCJdLCB7XG4gICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiB0cnVlLFxuICAgICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgTk9ERV9FTlY6IFwiZGV2ZWxvcG1lbnRcIiB9LFxuICAgICAgICB9KVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmluZm8oXG4gICAgICAgICAgY2hhbGsueWVsbG93KFwi4pqgXCIpLFxuICAgICAgICAgIGBCdW4gaW5zdGFsbGF0aW9uIGZhaWxlZCwgZmFsbGluZyBiYWNrIHRvIG5wbWAsXG4gICAgICAgIClcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBGYWxsIGJhY2sgdG8gbnBtIGlmIGJ1biBmYWlsc1xuICAgICAgICAgIHNwYXduU2FmZVN5bmMoYG5wbWAsIFtcImlcIiwgXCItLWZvcmNlXCIsIFwiLS1uby1mdW5kXCIsIFwiLS1uby1hdWRpdFwiXSwge1xuICAgICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICAgIGxvZ1N0ZEVyck9uRXJyb3I6IHRydWUsXG4gICAgICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIE5PREVfRU5WOiBcImRldmVsb3BtZW50XCIgfSxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gdHJ5IGFnYWluIHdoaWxlIGlnbm9yaW5nIHNjcmlwdHNcbiAgICAgICAgICBzcGF3blNhZmVTeW5jKFxuICAgICAgICAgICAgYG5wbWAsXG4gICAgICAgICAgICBbXCJpXCIsIFwiLS1pZ25vcmUtc2NyaXB0c1wiLCBcIi0tZm9yY2VcIiwgXCItLW5vLWZ1bmRcIiwgXCItLW5vLWF1ZGl0XCJdLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjd2Q6IHRtcFJlcG9OcG1Sb290LFxuICAgICAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiB0cnVlLFxuICAgICAgICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIE5PREVfRU5WOiBcImRldmVsb3BtZW50XCIgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgICAgY2hhbGsuZ3JleShcIuKAolwiKSxcbiAgICAgICAgYEluc3RhbGxpbmcgJHtwYWNrYWdlRGV0YWlscy5uYW1lfUAke3BhY2thZ2VWZXJzaW9ufSB3aXRoIG5wbWAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyB0cnkgZmlyc3Qgd2l0aG91dCBpZ25vcmluZyBzY3JpcHRzIGluIGNhc2UgdGhleSBhcmUgcmVxdWlyZWRcbiAgICAgICAgLy8gdGhpcyB3b3JrcyBpbiA5OS45OSUgb2YgY2FzZXNcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgbnBtYCwgW1wiaVwiLCBcIi0tZm9yY2VcIiwgXCItLW5vLWZ1bmRcIiwgXCItLW5vLWF1ZGl0XCJdLCB7XG4gICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiB0cnVlLFxuICAgICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgTk9ERV9FTlY6IFwiZGV2ZWxvcG1lbnRcIiB9LFxuICAgICAgICB9KVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyB0cnkgYWdhaW4gd2hpbGUgaWdub3Jpbmcgc2NyaXB0cyBpbiBjYXNlIHRoZSBzY3JpcHQgZGVwZW5kcyBvblxuICAgICAgICAvLyBhbiBpbXBsaWNpdCBjb250ZXh0IHdoaWNoIHdlIGhhdmVuJ3QgcmVwcm9kdWNlZFxuICAgICAgICBzcGF3blNhZmVTeW5jKFxuICAgICAgICAgIGBucG1gLFxuICAgICAgICAgIFtcImlcIiwgXCItLWlnbm9yZS1zY3JpcHRzXCIsIFwiLS1mb3JjZVwiLCBcIi0tbm8tZnVuZFwiLCBcIi0tbm8tYXVkaXRcIl0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICAgIGxvZ1N0ZEVyck9uRXJyb3I6IHRydWUsXG4gICAgICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIE5PREVfRU5WOiBcImRldmVsb3BtZW50XCIgfSxcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ2l0ID0gKC4uLmFyZ3M6IHN0cmluZ1tdKSA9PlxuICAgICAgc3Bhd25TYWZlU3luYyhcImdpdFwiLCBhcmdzLCB7XG4gICAgICAgIGN3ZDogdG1wUmVwby5uYW1lLFxuICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIEhPTUU6IHRtcFJlcG8ubmFtZSB9LFxuICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMTAwLFxuICAgICAgfSlcblxuICAgIC8vIHJlbW92ZSBuZXN0ZWQgbm9kZV9tb2R1bGVzIGp1c3QgdG8gYmUgc2FmZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgXCJub2RlX21vZHVsZXNcIikpXG4gICAgLy8gcmVtb3ZlIC5naXQganVzdCB0byBiZSBzYWZlXG4gICAgcmltcmFmKGpvaW4odG1wUmVwb1BhY2thZ2VQYXRoLCBcIi5naXRcIikpXG4gICAgLy8gcmVtb3ZlIHBhdGNoLXBhY2thZ2Ugc3RhdGUgZmlsZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgU1RBVEVfRklMRV9OQU1FKSlcblxuICAgIC8vIGNvbW1pdCB0aGUgcGFja2FnZVxuICAgIGNvbnNvbGUuaW5mbyhjaGFsay5ncmV5KFwi4oCiXCIpLCBcIkRpZmZpbmcgeW91ciBmaWxlcyB3aXRoIGNsZWFuIGZpbGVzXCIpXG4gICAgd3JpdGVGaWxlU3luYyhqb2luKHRtcFJlcG8ubmFtZSwgXCIuZ2l0aWdub3JlXCIpLCBcIiEvbm9kZV9tb2R1bGVzXFxuXFxuXCIpXG4gICAgZ2l0KFwiaW5pdFwiKVxuICAgIGdpdChcImNvbmZpZ1wiLCBcIi0tbG9jYWxcIiwgXCJ1c2VyLm5hbWVcIiwgXCJwYXRjaC1wYWNrYWdlXCIpXG4gICAgZ2l0KFwiY29uZmlnXCIsIFwiLS1sb2NhbFwiLCBcInVzZXIuZW1haWxcIiwgXCJwYXRjaEBwYWNrLmFnZVwiKVxuXG4gICAgLy8gcmVtb3ZlIGlnbm9yZWQgZmlsZXMgZmlyc3RcbiAgICByZW1vdmVJZ25vcmVkRmlsZXModG1wUmVwb1BhY2thZ2VQYXRoLCBpbmNsdWRlUGF0aHMsIGV4Y2x1ZGVQYXRocylcblxuICAgIGZvciAoY29uc3QgcGF0Y2hEZXRhaWxzIG9mIHBhdGNoZXNUb0FwcGx5QmVmb3JlRGlmZmluZykge1xuICAgICAgaWYgKFxuICAgICAgICAhYXBwbHlQYXRjaCh7XG4gICAgICAgICAgcGF0Y2hEZXRhaWxzLFxuICAgICAgICAgIHBhdGNoRGlyLFxuICAgICAgICAgIHBhdGNoRmlsZVBhdGg6IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIsIHBhdGNoRGV0YWlscy5wYXRjaEZpbGVuYW1lKSxcbiAgICAgICAgICByZXZlcnNlOiBmYWxzZSxcbiAgICAgICAgICBjd2Q6IHRtcFJlcG8ubmFtZSxcbiAgICAgICAgICBiZXN0RWZmb3J0OiBmYWxzZSxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICAvLyBUT0RPOiBhZGQgYmV0dGVyIGVycm9yIG1lc3NhZ2Ugb25jZSAtLXJlYmFzZSBpcyBpbXBsZW1lbnRlZFxuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICBgRmFpbGVkIHRvIGFwcGx5IHBhdGNoICR7cGF0Y2hEZXRhaWxzLnBhdGNoRmlsZW5hbWV9IHRvICR7cGFja2FnZURldGFpbHMucGF0aFNwZWNpZmllcn1gLFxuICAgICAgICApXG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgfVxuICAgIH1cbiAgICBnaXQoXCJhZGRcIiwgXCItZlwiLCBwYWNrYWdlRGV0YWlscy5wYXRoKVxuICAgIGdpdChcImNvbW1pdFwiLCBcIi0tYWxsb3ctZW1wdHlcIiwgXCItbVwiLCBcImluaXRcIilcblxuICAgIC8vIHJlcGxhY2UgcGFja2FnZSB3aXRoIHVzZXIncyB2ZXJzaW9uXG4gICAgcmltcmFmKHRtcFJlcG9QYWNrYWdlUGF0aClcblxuICAgIC8vIHBucG0gaW5zdGFsbHMgcGFja2FnZXMgYXMgc3ltbGlua3MsIGNvcHlTeW5jIHdvdWxkIGNvcHkgb25seSB0aGUgc3ltbGlua1xuICAgIGNvcHlTeW5jKHJlYWxwYXRoU3luYyhwYWNrYWdlUGF0aCksIHRtcFJlcG9QYWNrYWdlUGF0aClcblxuICAgIC8vIHJlbW92ZSBuZXN0ZWQgbm9kZV9tb2R1bGVzIGp1c3QgdG8gYmUgc2FmZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgXCJub2RlX21vZHVsZXNcIikpXG4gICAgLy8gcmVtb3ZlIC5naXQganVzdCB0byBiZSBzYWZlXG4gICAgcmltcmFmKGpvaW4odG1wUmVwb1BhY2thZ2VQYXRoLCBcIi5naXRcIikpXG4gICAgLy8gcmVtb3ZlIHBhdGNoLXBhY2thZ2Ugc3RhdGUgZmlsZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgU1RBVEVfRklMRV9OQU1FKSlcblxuICAgIC8vIGFsc28gcmVtb3ZlIGlnbm9yZWQgZmlsZXMgbGlrZSBiZWZvcmVcbiAgICByZW1vdmVJZ25vcmVkRmlsZXModG1wUmVwb1BhY2thZ2VQYXRoLCBpbmNsdWRlUGF0aHMsIGV4Y2x1ZGVQYXRocylcblxuICAgIC8vIHN0YWdlIGFsbCBmaWxlc1xuICAgIGdpdChcImFkZFwiLCBcIi1mXCIsIHBhY2thZ2VEZXRhaWxzLnBhdGgpXG5cbiAgICAvLyBnZXQgZGlmZiBvZiBjaGFuZ2VzXG4gICAgY29uc3QgZGlmZlJlc3VsdCA9IGdpdChcbiAgICAgIFwiZGlmZlwiLFxuICAgICAgXCItLWNhY2hlZFwiLFxuICAgICAgXCItLW5vLWNvbG9yXCIsXG4gICAgICBcIi0taWdub3JlLXNwYWNlLWF0LWVvbFwiLFxuICAgICAgXCItLW5vLWV4dC1kaWZmXCIsXG4gICAgICBcIi0tc3JjLXByZWZpeD1hL1wiLFxuICAgICAgXCItLWRzdC1wcmVmaXg9Yi9cIixcbiAgICApXG5cbiAgICBpZiAoZGlmZlJlc3VsdC5zdGRvdXQubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYOKBie+4jyAgTm90IGNyZWF0aW5nIHBhdGNoIGZpbGUgZm9yIHBhY2thZ2UgJyR7cGFja2FnZVBhdGhTcGVjaWZpZXJ9J2AsXG4gICAgICApXG4gICAgICBjb25zb2xlLmxvZyhg4oGJ77iPICBUaGVyZSBkb24ndCBhcHBlYXIgdG8gYmUgYW55IGNoYW5nZXMuYClcbiAgICAgIGlmIChpc1JlYmFzaW5nICYmIG1vZGUudHlwZSA9PT0gXCJvdmVyd3JpdGVfbGFzdFwiKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIFwiXFxu8J+SoSBUbyByZW1vdmUgYSBwYXRjaCBmaWxlLCBkZWxldGUgaXQgYW5kIHRoZW4gcmVpbnN0YWxsIG5vZGVfbW9kdWxlcyBmcm9tIHNjcmF0Y2guXCIsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIHBhcnNlUGF0Y2hGaWxlKGRpZmZSZXN1bHQuc3Rkb3V0LnRvU3RyaW5nKCkpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKFxuICAgICAgICAoZSBhcyBFcnJvcikubWVzc2FnZS5pbmNsdWRlcyhcIlVuZXhwZWN0ZWQgZmlsZSBtb2RlIHN0cmluZzogMTIwMDAwXCIpXG4gICAgICApIHtcbiAgICAgICAgY29uc29sZS5sb2coYFxu4puU77iPICR7Y2hhbGsucmVkLmJvbGQoXCJFUlJPUlwiKX1cblxuICBZb3VyIGNoYW5nZXMgaW52b2x2ZSBjcmVhdGluZyBzeW1saW5rcy4gcGF0Y2gtcGFja2FnZSBkb2VzIG5vdCB5ZXQgc3VwcG9ydFxuICBzeW1saW5rcy5cblxuICDvuI9QbGVhc2UgdXNlICR7Y2hhbGsuYm9sZChcIi0taW5jbHVkZVwiKX0gYW5kL29yICR7Y2hhbGsuYm9sZChcbiAgICAgICAgICBcIi0tZXhjbHVkZVwiLFxuICAgICAgICApfSB0byBuYXJyb3cgdGhlIHNjb3BlIG9mIHlvdXIgcGF0Y2ggaWZcbiAgdGhpcyB3YXMgdW5pbnRlbnRpb25hbC5cbmApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBvdXRQYXRoID0gXCIuL3BhdGNoLXBhY2thZ2UtZXJyb3IuanNvbi5nelwiXG4gICAgICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICAgICAgb3V0UGF0aCxcbiAgICAgICAgICBnemlwU3luYyhcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6IHsgbWVzc2FnZTogZS5tZXNzYWdlLCBzdGFjazogZS5zdGFjayB9LFxuICAgICAgICAgICAgICBwYXRjaDogZGlmZlJlc3VsdC5zdGRvdXQudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICksXG4gICAgICAgIClcbiAgICAgICAgY29uc29sZS5sb2coYFxu4puU77iPICR7Y2hhbGsucmVkLmJvbGQoXCJFUlJPUlwiKX1cblxuICBwYXRjaC1wYWNrYWdlIHdhcyB1bmFibGUgdG8gcmVhZCB0aGUgcGF0Y2gtZmlsZSBtYWRlIGJ5IGdpdC4gVGhpcyBzaG91bGQgbm90XG4gIGhhcHBlbi5cblxuICBBIGRpYWdub3N0aWMgZmlsZSB3YXMgd3JpdHRlbiB0b1xuXG4gICAgJHtvdXRQYXRofVxuXG4gIFBsZWFzZSBhdHRhY2ggaXQgdG8gYSBnaXRodWIgaXNzdWVcblxuICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9kczMwMC9wYXRjaC1wYWNrYWdlL2lzc3Vlcy9uZXc/dGl0bGU9TmV3K3BhdGNoK3BhcnNlK2ZhaWxlZCZib2R5PVBsZWFzZSthdHRhY2grdGhlK2RpYWdub3N0aWMrZmlsZStieStkcmFnZ2luZytpdCtpbnRvK2hlcmUr8J+Zj1xuXG4gIE5vdGUgdGhhdCB0aGlzIGRpYWdub3N0aWMgZmlsZSB3aWxsIGNvbnRhaW4gY29kZSBmcm9tIHRoZSBwYWNrYWdlIHlvdSB3ZXJlXG4gIGF0dGVtcHRpbmcgdG8gcGF0Y2guXG5cbmApXG4gICAgICB9XG4gICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIG1heWJlIGRlbGV0ZSBleGlzdGluZ1xuICAgIGlmIChtb2RlLnR5cGUgPT09IFwiYXBwZW5kXCIgJiYgIWlzUmViYXNpbmcgJiYgZXhpc3RpbmdQYXRjaGVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gaWYgd2UgYXJlIGFwcGVuZGluZyB0byBhbiBleGlzdGluZyBwYXRjaCB0aGF0IGRvZXNuJ3QgaGF2ZSBhIHNlcXVlbmNlIG51bWJlciBsZXQncyByZW5hbWUgaXRcbiAgICAgIGNvbnN0IHByZXZQYXRjaCA9IGV4aXN0aW5nUGF0Y2hlc1swXVxuICAgICAgaWYgKHByZXZQYXRjaC5zZXF1ZW5jZU51bWJlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IG5ld0ZpbGVOYW1lID0gY3JlYXRlUGF0Y2hGaWxlTmFtZSh7XG4gICAgICAgICAgcGFja2FnZURldGFpbHMsXG4gICAgICAgICAgcGFja2FnZVZlcnNpb24sXG4gICAgICAgICAgc2VxdWVuY2VOdW1iZXI6IDEsXG4gICAgICAgICAgc2VxdWVuY2VOYW1lOiBwcmV2UGF0Y2guc2VxdWVuY2VOYW1lID8/IFwiaW5pdGlhbFwiLFxuICAgICAgICB9KVxuICAgICAgICBjb25zdCBvbGRQYXRoID0gam9pbihhcHBQYXRoLCBwYXRjaERpciwgcHJldlBhdGNoLnBhdGNoRmlsZW5hbWUpXG4gICAgICAgIGNvbnN0IG5ld1BhdGggPSBqb2luKGFwcFBhdGgsIHBhdGNoRGlyLCBuZXdGaWxlTmFtZSlcbiAgICAgICAgcmVuYW1lU3luYyhvbGRQYXRoLCBuZXdQYXRoKVxuICAgICAgICBwcmV2UGF0Y2guc2VxdWVuY2VOdW1iZXIgPSAxXG4gICAgICAgIHByZXZQYXRjaC5wYXRjaEZpbGVuYW1lID0gbmV3RmlsZU5hbWVcbiAgICAgICAgcHJldlBhdGNoLnNlcXVlbmNlTmFtZSA9IHByZXZQYXRjaC5zZXF1ZW5jZU5hbWUgPz8gXCJpbml0aWFsXCJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBsYXN0UGF0Y2ggPSBleGlzdGluZ1BhdGNoZXNbXG4gICAgICBzdGF0ZSA/IHN0YXRlLnBhdGNoZXMubGVuZ3RoIC0gMSA6IGV4aXN0aW5nUGF0Y2hlcy5sZW5ndGggLSAxXG4gICAgXSBhcyBQYXRjaGVkUGFja2FnZURldGFpbHMgfCB1bmRlZmluZWRcbiAgICBjb25zdCBzZXF1ZW5jZU5hbWUgPVxuICAgICAgbW9kZS50eXBlID09PSBcImFwcGVuZFwiID8gbW9kZS5uYW1lIDogbGFzdFBhdGNoPy5zZXF1ZW5jZU5hbWVcbiAgICBjb25zdCBzZXF1ZW5jZU51bWJlciA9XG4gICAgICBtb2RlLnR5cGUgPT09IFwiYXBwZW5kXCJcbiAgICAgICAgPyAobGFzdFBhdGNoPy5zZXF1ZW5jZU51bWJlciA/PyAwKSArIDFcbiAgICAgICAgOiBsYXN0UGF0Y2g/LnNlcXVlbmNlTnVtYmVyXG5cbiAgICBjb25zdCBwYXRjaEZpbGVOYW1lID0gY3JlYXRlUGF0Y2hGaWxlTmFtZSh7XG4gICAgICBwYWNrYWdlRGV0YWlscyxcbiAgICAgIHBhY2thZ2VWZXJzaW9uLFxuICAgICAgc2VxdWVuY2VOYW1lLFxuICAgICAgc2VxdWVuY2VOdW1iZXIsXG4gICAgfSlcblxuICAgIGNvbnN0IHBhdGNoUGF0aCA9IGpvaW4ocGF0Y2hlc0RpciwgcGF0Y2hGaWxlTmFtZSlcbiAgICBpZiAoIWV4aXN0c1N5bmMoZGlybmFtZShwYXRjaFBhdGgpKSkge1xuICAgICAgLy8gc2NvcGVkIHBhY2thZ2VcbiAgICAgIG1rZGlyU3luYyhkaXJuYW1lKHBhdGNoUGF0aCkpXG4gICAgfVxuXG4gICAgLy8gaWYgd2UgYXJlIGluc2VydGluZyBhIG5ldyBwYXRjaCBpbnRvIGEgc2VxdWVuY2Ugd2UgbW9zdCBsaWtlbHkgbmVlZCB0byB1cGRhdGUgdGhlIHNlcXVlbmNlIG51bWJlcnNcbiAgICBpZiAoaXNSZWJhc2luZyAmJiBtb2RlLnR5cGUgPT09IFwiYXBwZW5kXCIpIHtcbiAgICAgIGNvbnN0IHBhdGNoZXNUb051ZGdlID0gZXhpc3RpbmdQYXRjaGVzLnNsaWNlKHN0YXRlIS5wYXRjaGVzLmxlbmd0aClcbiAgICAgIGlmIChzZXF1ZW5jZU51bWJlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInNlcXVlbmNlTnVtYmVyIGlzIHVuZGVmaW5lZCB3aGlsZSByZWJhc2luZ1wiKVxuICAgICAgfVxuICAgICAgaWYgKFxuICAgICAgICBwYXRjaGVzVG9OdWRnZVswXT8uc2VxdWVuY2VOdW1iZXIgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICBwYXRjaGVzVG9OdWRnZVswXS5zZXF1ZW5jZU51bWJlciA8PSBzZXF1ZW5jZU51bWJlclxuICAgICAgKSB7XG4gICAgICAgIGxldCBuZXh0ID0gc2VxdWVuY2VOdW1iZXIgKyAxXG4gICAgICAgIGZvciAoY29uc3QgcCBvZiBwYXRjaGVzVG9OdWRnZSkge1xuICAgICAgICAgIGNvbnN0IG5ld05hbWUgPSBjcmVhdGVQYXRjaEZpbGVOYW1lKHtcbiAgICAgICAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgICAgICAgcGFja2FnZVZlcnNpb24sXG4gICAgICAgICAgICBzZXF1ZW5jZU5hbWU6IHAuc2VxdWVuY2VOYW1lLFxuICAgICAgICAgICAgc2VxdWVuY2VOdW1iZXI6IG5leHQrKyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgXCJSZW5hbWluZ1wiLFxuICAgICAgICAgICAgY2hhbGsuYm9sZChwLnBhdGNoRmlsZW5hbWUpLFxuICAgICAgICAgICAgXCJ0b1wiLFxuICAgICAgICAgICAgY2hhbGsuYm9sZChuZXdOYW1lKSxcbiAgICAgICAgICApXG4gICAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIsIHAucGF0Y2hGaWxlbmFtZSlcbiAgICAgICAgICBjb25zdCBuZXdQYXRoID0gam9pbihhcHBQYXRoLCBwYXRjaERpciwgbmV3TmFtZSlcbiAgICAgICAgICByZW5hbWVTeW5jKG9sZFBhdGgsIG5ld1BhdGgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB3cml0ZUZpbGVTeW5jKHBhdGNoUGF0aCwgZGlmZlJlc3VsdC5zdGRvdXQpXG4gICAgY29uc29sZS5sb2coXG4gICAgICBgJHtjaGFsay5ncmVlbihcIuKclFwiKX0gQ3JlYXRlZCBmaWxlICR7am9pbihwYXRjaERpciwgcGF0Y2hGaWxlTmFtZSl9XFxuYCxcbiAgICApXG5cbiAgICBjb25zdCBwcmV2U3RhdGU6IFBhdGNoU3RhdGVbXSA9IHBhdGNoZXNUb0FwcGx5QmVmb3JlRGlmZmluZy5tYXAoXG4gICAgICAocCk6IFBhdGNoU3RhdGUgPT4gKHtcbiAgICAgICAgcGF0Y2hGaWxlbmFtZTogcC5wYXRjaEZpbGVuYW1lLFxuICAgICAgICBkaWRBcHBseTogdHJ1ZSxcbiAgICAgICAgcGF0Y2hDb250ZW50SGFzaDogaGFzaEZpbGUoam9pbihhcHBQYXRoLCBwYXRjaERpciwgcC5wYXRjaEZpbGVuYW1lKSksXG4gICAgICB9KSxcbiAgICApXG4gICAgY29uc3QgbmV4dFN0YXRlOiBQYXRjaFN0YXRlW10gPSBbXG4gICAgICAuLi5wcmV2U3RhdGUsXG4gICAgICB7XG4gICAgICAgIHBhdGNoRmlsZW5hbWU6IHBhdGNoRmlsZU5hbWUsXG4gICAgICAgIGRpZEFwcGx5OiB0cnVlLFxuICAgICAgICBwYXRjaENvbnRlbnRIYXNoOiBoYXNoRmlsZShwYXRjaFBhdGgpLFxuICAgICAgfSxcbiAgICBdXG5cbiAgICAvLyBpZiBhbnkgcGF0Y2hlcyBjb21lIGFmdGVyIHRoaXMgb25lIHdlIGp1c3QgbWFkZSwgd2Ugc2hvdWxkIHJlYXBwbHkgdGhlbVxuICAgIGxldCBkaWRGYWlsV2hpbGVGaW5pc2hpbmdSZWJhc2UgPSBmYWxzZVxuICAgIGlmIChpc1JlYmFzaW5nKSB7XG4gICAgICBjb25zdCBjdXJyZW50UGF0Y2hlcyA9IGdldEdyb3VwZWRQYXRjaGVzKGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIpKVxuICAgICAgICAucGF0aFNwZWNpZmllclRvUGF0Y2hGaWxlc1twYWNrYWdlRGV0YWlscy5wYXRoU3BlY2lmaWVyXVxuXG4gICAgICBjb25zdCBwcmV2aW91c2x5VW5hcHBsaWVkUGF0Y2hlcyA9IGN1cnJlbnRQYXRjaGVzLnNsaWNlKG5leHRTdGF0ZS5sZW5ndGgpXG4gICAgICBpZiAocHJldmlvdXNseVVuYXBwbGllZFBhdGNoZXMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBGYXN0IGZvcndhcmRpbmcuLi5gKVxuICAgICAgICBmb3IgKGNvbnN0IHBhdGNoIG9mIHByZXZpb3VzbHlVbmFwcGxpZWRQYXRjaGVzKSB7XG4gICAgICAgICAgY29uc3QgcGF0Y2hGaWxlUGF0aCA9IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIsIHBhdGNoLnBhdGNoRmlsZW5hbWUpXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIWFwcGx5UGF0Y2goe1xuICAgICAgICAgICAgICBwYXRjaERldGFpbHM6IHBhdGNoLFxuICAgICAgICAgICAgICBwYXRjaERpcixcbiAgICAgICAgICAgICAgcGF0Y2hGaWxlUGF0aCxcbiAgICAgICAgICAgICAgcmV2ZXJzZTogZmFsc2UsXG4gICAgICAgICAgICAgIGN3ZDogcHJvY2Vzcy5jd2QoKSxcbiAgICAgICAgICAgICAgYmVzdEVmZm9ydDogZmFsc2UsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgZGlkRmFpbFdoaWxlRmluaXNoaW5nUmViYXNlID0gdHJ1ZVxuICAgICAgICAgICAgbG9nUGF0Y2hTZXF1ZW5jZUVycm9yKHsgcGF0Y2hEZXRhaWxzOiBwYXRjaCB9KVxuICAgICAgICAgICAgbmV4dFN0YXRlLnB1c2goe1xuICAgICAgICAgICAgICBwYXRjaEZpbGVuYW1lOiBwYXRjaC5wYXRjaEZpbGVuYW1lLFxuICAgICAgICAgICAgICBkaWRBcHBseTogZmFsc2UsXG4gICAgICAgICAgICAgIHBhdGNoQ29udGVudEhhc2g6IGhhc2hGaWxlKHBhdGNoRmlsZVBhdGgpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGAgICR7Y2hhbGsuZ3JlZW4oXCLinJRcIil9ICR7cGF0Y2gucGF0Y2hGaWxlbmFtZX1gKVxuICAgICAgICAgICAgbmV4dFN0YXRlLnB1c2goe1xuICAgICAgICAgICAgICBwYXRjaEZpbGVuYW1lOiBwYXRjaC5wYXRjaEZpbGVuYW1lLFxuICAgICAgICAgICAgICBkaWRBcHBseTogdHJ1ZSxcbiAgICAgICAgICAgICAgcGF0Y2hDb250ZW50SGFzaDogaGFzaEZpbGUocGF0Y2hGaWxlUGF0aCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpc1JlYmFzaW5nIHx8IG51bVBhdGNoZXNBZnRlckNyZWF0ZSA+IDEpIHtcbiAgICAgIHNhdmVQYXRjaEFwcGxpY2F0aW9uU3RhdGUoe1xuICAgICAgICBwYWNrYWdlRGV0YWlscyxcbiAgICAgICAgcGF0Y2hlczogbmV4dFN0YXRlLFxuICAgICAgICBpc1JlYmFzaW5nOiBkaWRGYWlsV2hpbGVGaW5pc2hpbmdSZWJhc2UsXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBjbGVhclBhdGNoQXBwbGljYXRpb25TdGF0ZShwYWNrYWdlRGV0YWlscylcbiAgICB9XG5cbiAgICBpZiAoY2FuQ3JlYXRlSXNzdWUpIHtcbiAgICAgIGlmIChjcmVhdGVJc3N1ZSkge1xuICAgICAgICBvcGVuSXNzdWVDcmVhdGlvbkxpbmsoe1xuICAgICAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgICAgIHBhdGNoRmlsZUNvbnRlbnRzOiBkaWZmUmVzdWx0LnN0ZG91dC50b1N0cmluZygpLFxuICAgICAgICAgIHBhY2thZ2VWZXJzaW9uLFxuICAgICAgICB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWF5YmVQcmludElzc3VlQ3JlYXRpb25Qcm9tcHQodmNzLCBwYWNrYWdlRGV0YWlscywgcGFja2FnZU1hbmFnZXIpXG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS5sb2coZSlcbiAgICB0aHJvdyBlXG4gIH0gZmluYWxseSB7XG4gICAgdG1wUmVwby5yZW1vdmVDYWxsYmFjaygpXG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlUGF0Y2hGaWxlTmFtZSh7XG4gIHBhY2thZ2VEZXRhaWxzLFxuICBwYWNrYWdlVmVyc2lvbixcbiAgc2VxdWVuY2VOdW1iZXIsXG4gIHNlcXVlbmNlTmFtZSxcbn06IHtcbiAgcGFja2FnZURldGFpbHM6IFBhY2thZ2VEZXRhaWxzXG4gIHBhY2thZ2VWZXJzaW9uOiBzdHJpbmdcbiAgc2VxdWVuY2VOdW1iZXI/OiBudW1iZXJcbiAgc2VxdWVuY2VOYW1lPzogc3RyaW5nXG59KSB7XG4gIGNvbnN0IHBhY2thZ2VOYW1lcyA9IHBhY2thZ2VEZXRhaWxzLnBhY2thZ2VOYW1lc1xuICAgIC5tYXAoKG5hbWUpID0+IG5hbWUucmVwbGFjZSgvXFwvL2csIFwiK1wiKSlcbiAgICAuam9pbihcIisrXCIpXG5cbiAgY29uc3QgbmFtZUFuZFZlcnNpb24gPSBgJHtwYWNrYWdlTmFtZXN9KyR7cGFja2FnZVZlcnNpb259YFxuICBjb25zdCBudW0gPVxuICAgIHNlcXVlbmNlTnVtYmVyID09PSB1bmRlZmluZWRcbiAgICAgID8gXCJcIlxuICAgICAgOiBgKyR7c2VxdWVuY2VOdW1iZXIudG9TdHJpbmcoKS5wYWRTdGFydCgzLCBcIjBcIil9YFxuICBjb25zdCBuYW1lID0gIXNlcXVlbmNlTmFtZSA/IFwiXCIgOiBgKyR7c2VxdWVuY2VOYW1lfWBcblxuICByZXR1cm4gYCR7bmFtZUFuZFZlcnNpb259JHtudW19JHtuYW1lfS5wYXRjaGBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ1BhdGNoU2VxdWVuY2VFcnJvcih7XG4gIHBhdGNoRGV0YWlscyxcbn06IHtcbiAgcGF0Y2hEZXRhaWxzOiBQYXRjaGVkUGFja2FnZURldGFpbHNcbn0pIHtcbiAgY29uc29sZS5sb2coYFxuJHtjaGFsay5yZWQuYm9sZChcIuKblCBFUlJPUlwiKX1cblxuRmFpbGVkIHRvIGFwcGx5IHBhdGNoIGZpbGUgJHtjaGFsay5ib2xkKHBhdGNoRGV0YWlscy5wYXRjaEZpbGVuYW1lKX0uXG5cbklmIHRoaXMgcGF0Y2ggZmlsZSBpcyBubyBsb25nZXIgdXNlZnVsLCBkZWxldGUgaXQgYW5kIHJ1blxuXG4gICR7Y2hhbGsuYm9sZChgcGF0Y2gtcGFja2FnZWApfVxuXG5UbyBwYXJ0aWFsbHkgYXBwbHkgdGhlIHBhdGNoIChpZiBwb3NzaWJsZSkgYW5kIG91dHB1dCBhIGxvZyBvZiBlcnJvcnMgdG8gZml4LCBydW5cblxuICAke2NoYWxrLmJvbGQoYHBhdGNoLXBhY2thZ2UgLS1wYXJ0aWFsYCl9XG5cbkFmdGVyIHdoaWNoIHlvdSBzaG91bGQgbWFrZSBhbnkgcmVxdWlyZWQgY2hhbmdlcyBpbnNpZGUgJHtcbiAgICBwYXRjaERldGFpbHMucGF0aFxuICB9LCBhbmQgZmluYWxseSBydW5cblxuICAke2NoYWxrLmJvbGQoYHBhdGNoLXBhY2thZ2UgJHtwYXRjaERldGFpbHMucGF0aFNwZWNpZmllcn1gKX1cblxudG8gdXBkYXRlIHRoZSBwYXRjaCBmaWxlLlxuYClcbn1cbiJdfQ==