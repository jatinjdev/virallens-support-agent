import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; email: string },
  sessionUnavailable: false
}));

vi.mock("../features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: authState.user, loading: false, sessionUnavailable: authState.sessionUnavailable })
}));
vi.mock("../features/chat/ChatPage", () => ({ ChatPage: () => <div>Chat shell</div> }));

afterEach(() => {
  authState.user = null;
  authState.sessionUnavailable = false;
  cleanup();
});

describe("app routing", () => {
  it("shows the chat shell to signed-out visitors", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    expect(screen.getByText("Chat shell")).toBeInTheDocument();
  });

  it("does not expose a separate login page", async () => {
    render(<MemoryRouter initialEntries={["/login"]}><App /></MemoryRouter>);
    expect(await screen.findByText("Chat shell")).toBeInTheDocument();
  });

  it("shows an availability state instead of a signed-out shell when session restoration fails", () => {
    authState.sessionUnavailable = true;
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByText("Chat shell")).not.toBeInTheDocument();
  });
});
