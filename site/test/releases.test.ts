import assert from "node:assert/strict";
import test from "node:test";
import { safeReleaseEntryPath } from "../../src/integration/release-archive.ts";

test("accepts normal relative paths in release archives", () => {
    assert.equal(safeReleaseEntryPath("src/index.ts"), "src/index.ts");
    assert.equal(safeReleaseEntryPath("src\\index.ts"), "src/index.ts");
});

test("rejects traversal and absolute paths in release archives", () => {
    for (const path of ["../secret.txt", "src/../../secret.txt", "/etc/passwd", "C:/secret.txt", "C:\\secret.txt"]) {
        assert.throws(() => safeReleaseEntryPath(path), /caminho inseguro/);
    }
});
