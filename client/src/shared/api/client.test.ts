import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("includes cookies and decodes JSON responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/health", expect.objectContaining({ credentials: "include" }));
  });

  it("surfaces the server's safe error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }
    }), { status: 401, headers: { "Content-Type": "application/json" } })));

    await expect(api("/auth/login")).rejects.toEqual(
      new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")
    );
  });
});
