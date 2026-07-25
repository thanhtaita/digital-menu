import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = sendMock;
  }
  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class DeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return { S3Client, PutObjectCommand, DeleteObjectCommand };
});

const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL"
] as const;

function setValidR2Env() {
  process.env.R2_ACCOUNT_ID = "acct123";
  process.env.R2_ACCESS_KEY_ID = "key123";
  process.env.R2_SECRET_ACCESS_KEY = "secret123";
  process.env.R2_BUCKET = "my-bucket";
  process.env.R2_PUBLIC_BASE_URL = "https://media.example.com";
}

function clearR2Env() {
  for (const key of R2_ENV_KEYS) delete process.env[key];
}

describe("r2MediaStorage", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
    clearR2Env();
  });

  afterEach(() => {
    clearR2Env();
  });

  it("throws a clear error when required R2 env vars are missing", async () => {
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    await expect(r2MediaStorage.save(Buffer.from("x"), "image/png", "dishes")).rejects.toThrow(
      /R2_ACCOUNT_ID/
    );
  });

  it("saves an image and returns a public URL built from R2_PUBLIC_BASE_URL", async () => {
    setValidR2Env();
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    const result = await r2MediaStorage.save(Buffer.from("hello"), "image/png", "dishes");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.kind).toBe("image");
    expect(result.url).toMatch(
      /^https:\/\/media\.example\.com\/dishes\/[0-9a-f-]{36}\.png$/
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const putCommand = sendMock.mock.calls[0][0];
    expect(putCommand.input.Bucket).toBe("my-bucket");
    expect(putCommand.input.Key).toMatch(/^dishes\/[0-9a-f-]{36}\.png$/);
    expect(putCommand.input.ContentType).toBe("image/png");
  });

  it("rejects unsupported media types without calling S3", async () => {
    setValidR2Env();
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    const result = await r2MediaStorage.save(Buffer.from("x"), "application/pdf", "dishes");

    expect(result).toEqual({
      ok: false,
      status: 415,
      error: "Unsupported media type",
      code: "UNSUPPORTED_TYPE"
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects oversized files without calling S3", async () => {
    setValidR2Env();
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    const { MAX_IMAGE_BYTES } = await import("../lib/uploads.js");
    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    const result = await r2MediaStorage.save(oversized, "image/png", "dishes");

    expect(result).toEqual({
      ok: false,
      status: 413,
      error: "File too large",
      code: "FILE_TOO_LARGE"
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("deletes an object when the URL matches R2_PUBLIC_BASE_URL", async () => {
    setValidR2Env();
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    await r2MediaStorage.deleteByPublicUrl("https://media.example.com/dishes/abc.png");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const deleteCommand = sendMock.mock.calls[0][0];
    expect(deleteCommand.input.Bucket).toBe("my-bucket");
    expect(deleteCommand.input.Key).toBe("dishes/abc.png");
  });

  it("no-ops deleting a URL that does not match R2_PUBLIC_BASE_URL", async () => {
    setValidR2Env();
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    await r2MediaStorage.deleteByPublicUrl("/uploads/dishes/abc.png");

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws when deleting without required R2 env vars configured", async () => {
    const { r2MediaStorage } = await import("../lib/uploads-r2.js");
    await expect(
      r2MediaStorage.deleteByPublicUrl("https://media.example.com/dishes/abc.png")
    ).rejects.toThrow(/R2_ACCOUNT_ID/);
  });
});
