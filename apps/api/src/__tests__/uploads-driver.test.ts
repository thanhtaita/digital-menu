import { afterEach, describe, expect, it, vi } from "vitest";

const previousStorageDriver = process.env.STORAGE_DRIVER;

afterEach(() => {
  if (previousStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
  else process.env.STORAGE_DRIVER = previousStorageDriver;
  vi.resetModules();
});

describe("mediaStorage driver selector", () => {
  it("defaults to localMediaStorage when STORAGE_DRIVER is unset", async () => {
    delete process.env.STORAGE_DRIVER;
    vi.resetModules();
    const { mediaStorage, localMediaStorage } = await import("../lib/uploads.js");
    expect(mediaStorage).toBe(localMediaStorage);
  });

  it("defaults to localMediaStorage for any non-r2 value", async () => {
    process.env.STORAGE_DRIVER = "something-else";
    vi.resetModules();
    const { mediaStorage, localMediaStorage } = await import("../lib/uploads.js");
    expect(mediaStorage).toBe(localMediaStorage);
  });

  it("selects r2MediaStorage when STORAGE_DRIVER=r2", async () => {
    process.env.STORAGE_DRIVER = "r2";
    vi.resetModules();
    const { mediaStorage, localMediaStorage } = await import("../lib/uploads.js");
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    expect(mediaStorage).toBe(r2MediaStorage);
    expect(mediaStorage).not.toBe(localMediaStorage);
  });
});
