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
        { id: "post-1", title: "Older", date: "2025-01-01", tags: [], content: "", coverImage: null, links: [] }
    ]);

    const created = store.create({
        title: " New post ",
        date: "2026-03-10",
        tags: "Audio, Ambient",
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
        content: "",
        coverImage: "https://example.com/art.jpg",
        links: [{ type: "soundcloud", label: "Listen", url: "https://soundcloud.com/example" }]
    }]);

    assert.equal(added.id, "post-1");
    assert.equal(store.list()[0].title, "Imported");
});

test("reject invalid post fields without changing stored posts", (t) => {
    const initialPosts = [
        { id: "post-1", title: "Existing", date: "2025-01-01", tags: [], content: "", coverImage: null, links: [] }
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

test("sort posts on the same date with newer posts placed first", (t) => {
    const { store } = makeStore(t);

    const firstPostOfDay = store.create({
        title: "Morning Post",
        date: "2026-11-08"
    });
    assert.equal(firstPostOfDay.id, "post-1");

    const secondPostOfDay = store.create({
        title: "Afternoon Post",
        date: "2026-11-08"
    });
    assert.equal(secondPostOfDay.id, "post-2");

    // Newer post on the same day should rank first
    const list = store.list();
    assert.deepEqual(
        list.map(({ id, title }) => ({ id, title })),
        [
            { id: "post-2", title: "Afternoon Post" },
            { id: "post-1", title: "Morning Post" }
        ]
    );

    // Adding a post from a previous date should place it at the bottom
    const olderPost = store.create({
        title: "Previous Day Post",
        date: "2026-11-07"
    });
    assert.equal(olderPost.id, "post-1");

    assert.deepEqual(
        store.list().map(({ id, title }) => ({ id, title })),
        [
            { id: "post-3", title: "Afternoon Post" },
            { id: "post-2", title: "Morning Post" },
            { id: "post-1", title: "Previous Day Post" }
        ]
    );
});

test("validate cover image formats and error handling", (t) => {
    const { store } = makeStore(t);

    // Valid site path and https URL
    const localCover = store.create({ title: "Local Cover", coverImage: "/assets/banner.svg" });
    assert.equal(localCover.coverImage, "/assets/banner.svg");

    const remoteCover = store.create({ title: "Remote Cover", coverImage: "https://example.com/img.png" });
    assert.equal(remoteCover.coverImage, "https://example.com/img.png");

    // Empty or whitespace strings should become null
    const emptyCover = store.create({ title: "Empty Cover", coverImage: "   " });
    assert.equal(emptyCover.coverImage, null);

    // Protocol-relative and invalid formats should throw
    assert.throws(() => store.create({ title: "Bad Cover", coverImage: "//evil.com/img.png" }), PostStoreError);
    assert.throws(() => store.create({ title: "Bad Cover", coverImage: "ftp://example.com/img.png" }), PostStoreError);
    assert.throws(() => store.create({ title: "Bad Cover", coverImage: 12345 }), PostStoreError);
});

test("validate link structure and permitted protocols", (t) => {
    const { store } = makeStore(t);

    // Valid http, https, and mailto links
    const postWithLinks = store.create({
        title: "Linked Post",
        links: [
            { type: "soundcloud", label: "Music", url: "https://soundcloud.com/artist/track" },
            { type: "website", label: "Blog", url: "http://example.com" },
            { type: "external", label: "Contact", url: "mailto:user@example.com" }
        ]
    });
    assert.equal(postWithLinks.links.length, 3);

    // Invalid link structures and protocols
    assert.throws(() => store.create({ title: "Bad", links: "not-an-array" }), PostStoreError);
    assert.throws(() => store.create({ title: "Bad", links: ["not-an-object"] }), PostStoreError);
    assert.throws(() => store.create({ title: "Bad", links: [{ type: "test", label: "Missing URL" }] }), PostStoreError);
    assert.throws(() => store.create({ title: "Bad", links: [{ type: "test", label: "Link", url: "file:///etc/passwd" }] }), PostStoreError);
});

test("handle corrupt or invalid posts file gracefully", (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "personal-site-corrupt-"));
    const postsFile = path.join(directory, "posts.json");
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    // Non-array JSON
    fs.writeFileSync(postsFile, `{"not": "an array"}\n`);
    const notArrayStore = createPostStore(postsFile);
    assert.throws(
        () => notArrayStore.list(),
        (err) => err instanceof PostStoreError && err.statusCode === 500
    );

    // Malformed JSON syntax
    fs.writeFileSync(postsFile, `[ invalid json `);
    const syntaxErrorStore = createPostStore(postsFile);
    assert.throws(
        () => syntaxErrorStore.list(),
        (err) => err instanceof PostStoreError && err.statusCode === 500
    );
});