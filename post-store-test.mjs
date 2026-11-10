import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPostStore, PostStoreError } from "./post-store.mjs";

function makeStore(t, initialPosts = []) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-site-posts-"));
    const postsFile = path.join(directory, "posts.json");
    fs.writeFileSync(postsFile, `${JSON.stringify(initialPosts, null, 2)}\n`);
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return { store: createPostStore(postsFile), postsFile };
}

test("create, list, update, and delete posts through the store", (t) => {
    const { store } = makeStore(t, [
        { id: "post-1", title: "Older", date: "2025-01-01", tags: [], summary: "", content: "", coverImage: null, links: [] }
    ]);

    const created = store.create({
        title: " New post ",
        date: "2026-03-10",
        tags: "Audio, Ambient",
        summary: " Summary ",
        content: " Notes ",
        coverImage: "/assets/sample-artwork.svg",
        links: [
            { type: "external", label: "Example", url: "https://example.com" },
            { type: "external", label: "Email", url: "mailto:hello@example.com" }
        ]
    });

    assert.equal(created.id, "post-2");
    assert.equal(created.links[1].url, "mailto:hello@example.com");
    assert.deepEqual(created.tags, ["audio", "ambient"]);
    assert.equal(created.title, "New post");
    assert.deepEqual(store.list().map(({ title }) => title), ["New post", "Older"]);

    const updated = store.update("post-2", {
        title: "Updated",
        date: "",
        tags: ["Mixed Case"],
        summary: "",
        content: "Updated notes",
        coverImage: null,
        links: []
    });
    assert.equal(updated.title, "Updated");
    assert.equal(updated.date, "2026-03-10");
    assert.deepEqual(updated.tags, ["Mixed Case"]);

    const removed = store.remove("post-2");
    assert.equal(removed.title, "Updated");
    assert.deepEqual(store.list().map(({ id, title }) => ({ id, title })), [
        { id: "post-1", title: "Older" }
    ]);
});

test("append imports through the shared sorting and ID assignment", (t) => {
    const { store } = makeStore(t);
    const [added] = store.append([{
        title: "Imported",
        date: "2026-01-02",
        tags: ["audio"],
        summary: "",
        content: "",
        coverImage: "https://example.com/art.jpg",
        links: [{ type: "soundcloud", label: "Listen", url: "https://soundcloud.com/example" }]
    }]);

    assert.equal(added.id, "post-1");
    assert.equal(store.list()[0].title, "Imported");
});

test("reject invalid post fields without changing stored posts", (t) => {
    const initialPosts = [
        { id: "post-1", title: "Existing", date: "2025-01-01", tags: [], summary: "", content: "", coverImage: null, links: [] }
    ];
    const { store, postsFile } = makeStore(t, initialPosts);

    const invalidInputs = [
        { title: "   " },
        { title: "Bad date", date: "2025-02-30" },
        { title: "Bad tags", tags: [3] },
        { title: "Bad links", links: [{ type: "external", label: "Unsafe", url: "javascript:alert(1)" }] }
    ];
    for (const input of invalidInputs) {
        assert.throws(() => store.create(input), PostStoreError);
    }

    assert.deepEqual(JSON.parse(fs.readFileSync(postsFile, "utf-8")), initialPosts);
});

test("report missing IDs as not found", (t) => {
    const { store } = makeStore(t);

    assert.throws(
        () => store.update("missing", { title: "Update" }),
        (error) => error instanceof PostStoreError && error.statusCode === 404
    );
    assert.throws(
        () => store.remove("missing"),
        (error) => error instanceof PostStoreError && error.statusCode === 404
    );
});