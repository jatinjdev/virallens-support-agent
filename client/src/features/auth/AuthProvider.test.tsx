import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

function AuthState() {
  const { loading, login, sessionUnavailable, user } = useAuth();
  return <>
    <span>{loading ? "loading" : sessionUnavailable ? "unavailable" : user?.name ?? "ready"}</span>
    <button onClick={() => void login("ada@example.com", "correct-horse")}>Sign in</button>
  </>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthProvider", () => {
  it("checks the authoritative session cookie on every startup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." }
    }), { status: 401, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthProvider><AuthState /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/auth/session", expect.objectContaining({ credentials: "include" }));
  });

  it("does not treat a session availability failure as a confirmed sign-out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<AuthProvider><AuthState /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("unavailable")).toBeInTheDocument());
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
  });

  it("restores a session from its cookie without a local-storage hint", async () => {
    const user = { id: "user-1", name: "Ada", email: "ada@example.com" };
    let sessionChecks = 0;
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      if (path === "/auth/session" && sessionChecks++ === 0) {
        return Promise.resolve(new Response(JSON.stringify({
          error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." }
        }), { status: 401, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const firstVisit = render(<AuthProvider><AuthState /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText("Ada")).toBeInTheDocument());
    firstVisit.unmount();
    localStorage.clear();

    render(<AuthProvider><AuthState /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("Ada")).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/auth/session");
  });
});
