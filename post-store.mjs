import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_POSTS_FILE = path.join(ROOT_DIR, "public", "content", "posts.json");

export class PostStoreError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "PostStoreError";
        this.statusCode = statusCode;
    }
}

export function createPostStore(postsFile = DEFAULT_POSTS_FILE) {
    function list() {
        let posts;
        try {
            posts = JSON.parse(fs.readFileSync(postsFile, "utf-8"));
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new PostStoreError("The posts file contains invalid JSON", 500);
            }
            throw error;
        }

        if (!Array.isArray(posts)) {
            throw new PostStoreError("The posts file must contain a JSON array", 500);
        }
        return posts;
    }

    function save(posts) {
        posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const total = posts.length;
        posts.forEach((post, index) => {
            post.id = `post-${total - index}`;
        });
        fs.writeFileSync(postsFile, `${JSON.stringify(posts, null, 2)}\n`, "utf-8");
        return posts;
    }

    function normalizeInput(input, existingPost = null) {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            throw new PostStoreError("Post data must be a JSON object");
        }
        if (typeof input.title !== "string" || !input.title.trim()) {
            throw new PostStoreError("Title is required");
        }

        const date = input.date || existingPost?.date || new Date().toISOString().slice(0, 10);
        if (typeof date !== "string" || !isValidDate(date)) {
            throw new PostStoreError("Date must be a valid YYYY-MM-DD date");
        }

        let tags;
        if (input.tags === undefined || input.tags === null) {
            tags = [];
        } else if (Array.isArray(input.tags)) {
            if (!input.tags.every((tag) => typeof tag === "string")) {
                throw new PostStoreError("Tags must be strings");
            }
            // Preserve the existing behavior for array input; string input is normalized below.
            tags = input.tags;
        } else if (typeof input.tags === "string") {
            tags = input.tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
        } else {
            throw new PostStoreError("Tags must be a string or an array of strings");
        }

        const summary = readOptionalString(input.summary, "Summary");
        const content = readOptionalString(input.content, "Content");
        const coverImage = readCoverImage(input.coverImage);
        const links = readLinks(input.links);

        return {
            id: existingPost?.id || "",
            title: input.title.trim(),
            date,
            tags,
            summary,
            content,
            coverImage,
            links
        };
    }

    function create(input) {
        const posts = list();
        const post = normalizeInput(input);
        posts.push(post);
        save(posts);
        return post;
    }

    function update(id, input) {
        const posts = list();
        const index = posts.findIndex((post) => post.id === id);
        if (index === -1) {
            throw new PostStoreError(`Post with ID "${id}" not found`, 404);
        }

        const post = normalizeInput(input, posts[index]);
        posts[index] = post;
        save(posts);
        return post;
    }

    function remove(id) {
        const posts = list();
        const index = posts.findIndex((post) => post.id === id);
        if (index === -1) {
            throw new PostStoreError(`Post with ID "${id}" not found`, 404);
        }

        const [removedPost] = posts.splice(index, 1);
        save(posts);
        return removedPost;
    }

    function append(newPosts) {
        const posts = list();
        const normalizedPosts = newPosts.map((post) => normalizeInput(post));
        posts.push(...normalizedPosts);
        save(posts);
        return normalizedPosts;
    }

    return { list, create, update, remove, append };
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readOptionalString(value, label) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
        throw new PostStoreError(`${label} must be a string`);
    }
    return value.trim();
}

function readCoverImage(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") {
        throw new PostStoreError("Cover image must be a string or null");
    }
    const coverImage = value.trim();
    if (!coverImage) return null;
    if (coverImage.startsWith("/") && !coverImage.startsWith("//")) return coverImage;
    if (isHttpUrl(coverImage)) return coverImage;
    throw new PostStoreError("Cover image must be a site path or an HTTP(S) URL");
}

function readLinks(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
        throw new PostStoreError("Links must be an array");
    }

    return value.map((link) => {
        if (!link || typeof link !== "object" || Array.isArray(link)) {
            throw new PostStoreError("Each link must be an object");
        }
        const type = typeof link.type === "string" ? link.type.trim() : "";
        const label = typeof link.label === "string" ? link.label.trim() : "";
        const url = typeof link.url === "string" ? link.url.trim() : "";
        if (!type || !label || !url) {
            throw new PostStoreError("Each link needs a type, label, and URL");
        }
        if (!isHttpUrl(url) && !isMailtoUrl(url)) {
            throw new PostStoreError("Link URLs must use HTTP(S) or mailto");
        }
        return { type, label, url };
    });
}

function isHttpUrl(value) {
    try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
}

function isMailtoUrl(value) {
    try {
        return new URL(value).protocol === "mailto:";
    } catch {
        return false;
    }
}