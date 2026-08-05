import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "./ChatPage";

const authState = vi.hoisted(() => ({
  user: { id: "user-1", name: "Ada", email: "ada@example.com" } as null | { id: string; name: string; email: string }
}));
const authActions = vi.hoisted(() => ({
  login: vi.fn(async () => {}),
  signup: vi.fn(async () => {}),
  logout: vi.fn(async () => {})
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: authState.user,
    ...authActions
  })
}));

const conversationId = "507f1f77bcf86cd799439011";
const summary = {
  id: conversationId,
  title: "Delivery question",
  lastMessage: "Deep-linked answer",
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:01:00.000Z"
};
const conversation = {
  ...summary,
  messages: [{
    id: "message-1",
    role: "assistant",
    content: "Deep-linked answer",
    status: "completed",
    createdAt: "2026-08-04T00:01:00.000Z"
  }]
};

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  authState.user = { id: "user-1", name: "Ada", email: "ada@example.com" };
  vi.clearAllMocks();
  cleanup();
  vi.unstubAllGlobals();
});

function renderChat(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<><ChatPage /><span data-testid="route-state">root</span></>} />
        <Route path="/c/:conversationId" element={<><ChatPage /><span data-testid="route-state">conversation</span></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("chat routing", () => {
  it("opens login over the guest chat shell from the composer and new-chat button", async () => {
    authState.user = null;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const view = renderChat("/");

    view.container.querySelector("textarea")!.focus();
    fireEvent.click(view.container.querySelector("textarea")!);
    expect(await screen.findByRole("dialog", { name: "Sign in to Beacon" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close login" }));
    await waitFor(() => expect(view.container.querySelector("textarea")).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(await screen.findByRole("dialog", { name: "Sign in to Beacon" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns to a new chat after account creation from a guest conversation URL", async () => {
    authState.user = null;
    vi.stubGlobal("fetch", vi.fn());
    const view = renderChat(`/c/${conversationId}`);

    view.container.querySelector("textarea")!.focus();
    fireEvent.click(view.container.querySelector("textarea")!);
    fireEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Grace Hopper" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "grace@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(authActions.signup).toHaveBeenCalledWith(
      "Grace Hopper",
      "grace@example.com",
      "password123"
    ));
    await waitFor(() => expect(screen.getByTestId("route-state")).toHaveTextContent("root"));
  });

  it("does not expose technical authentication errors", async () => {
    authState.user = null;
    authActions.login.mockRejectedValueOnce(new Error("Internal authentication diagnostic"));
    vi.stubGlobal("fetch", vi.fn());
    const view = renderChat("/");

    view.container.querySelector("textarea")!.focus();
    fireEvent.click(view.container.querySelector("textarea")!);
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(view.container).not.toHaveTextContent("Internal authentication diagnostic");
  });

  it("renders history entries as navigable chat URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      conversations: [summary],
      pagination: { hasMore: false, nextCursor: null }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })));

    renderChat("/");

    const link = await screen.findByRole("link", { name: /Delivery question/ });
    expect(link).toHaveAttribute("href", `/c/${conversationId}`);
  });

  it("loads the selected conversation from a direct URL", async () => {
    const fetchMock = vi.fn().mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(
      path === "/chat/history?limit=20"
        ? { conversations: [summary], pagination: { hasMore: false, nextCursor: null } }
        : { conversation, pagination: { hasMore: false, nextCursor: null } }
    ), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat(`/c/${conversationId}`);

    await waitFor(() => expect(view.container.querySelector(".message p")?.textContent).toBe("Deep-linked answer"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls.map((call) => call[0])).toContain(`/chat/history/${conversationId}?limit=30`);
  });

  it("opens a long conversation at its latest messages", async () => {
    const fetchMock = vi.fn().mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(
      path === "/chat/history?limit=20"
        ? { conversations: [summary], pagination: { hasMore: false, nextCursor: null } }
        : { conversation, pagination: { hasMore: false, nextCursor: null } }
    ), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat(`/c/${conversationId}`);
    const messageRegion = view.container.querySelector(".message-region") as HTMLDivElement;
    Object.defineProperties(messageRegion, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: {
        configurable: true,
        get: () => messageRegion.querySelector(".messages") ? 1_200 : 40
      }
    });

    await waitFor(() => expect(view.container.querySelector(".message p")?.textContent).toBe("Deep-linked answer"));
    await waitFor(() => expect(messageRegion.scrollTop).toBe(1_200));
  });

  it("loads an older page when the message region is scrolled to the top", async () => {
    const olderMessage = {
      ...conversation.messages[0],
      id: "message-older",
      content: "Earlier answer"
    };
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      const body = path === "/chat/history?limit=20"
        ? { conversations: [summary], pagination: { hasMore: false, nextCursor: null } }
        : path.includes("before=")
          ? {
              conversation: { ...conversation, messages: [olderMessage] },
              pagination: { hasMore: false, nextCursor: null }
            }
          : {
              conversation,
              pagination: { hasMore: true, nextCursor: "507f1f77bcf86cd799439012" }
            };
      return Promise.resolve(new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat(`/c/${conversationId}`);
    await waitFor(() => expect(view.container.querySelector(".message p")?.textContent).toBe("Deep-linked answer"));
    const messageRegion = view.container.querySelector(".message-region")!;
    fireEvent.scroll(messageRegion, { target: { scrollTop: 120 } });
    fireEvent.scroll(messageRegion, { target: { scrollTop: 0 } });

    await waitFor(() => expect(view.container.textContent).toContain("Earlier answer"));
    expect(fetchMock.mock.calls.map((call) => call[0])).toContain(
      `/chat/history/${conversationId}?before=507f1f77bcf86cd799439012&limit=30`
    );
  });

  it("loads older conversation summaries near the bottom of the sidebar", async () => {
    const olderSummary = {
      ...summary,
      id: "507f1f77bcf86cd799439099",
      title: "Older conversation"
    };
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      const body = path.includes("before=history-cursor")
        ? { conversations: [olderSummary], pagination: { hasMore: false, nextCursor: null } }
        : { conversations: [summary], pagination: { hasMore: true, nextCursor: "history-cursor" } };
      return Promise.resolve(new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat("/");
    await waitFor(() => expect(view.container.querySelector(".conversation-title")?.textContent).toBe("Delivery question"));
    const history = view.container.querySelector(".conversation-list")!;
    Object.defineProperties(history, {
      scrollHeight: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 400 }
    });
    fireEvent.scroll(history, { target: { scrollTop: 150 } });

    await waitFor(() => expect(view.container.textContent).toContain("Older conversation"));
    expect(fetchMock.mock.calls.map((call) => call[0])).toContain(
      "/chat/history?before=history-cursor&limit=20"
    );
  });

  it("clears the typing row when a response connection fails", async () => {
    const encoder = new TextEncoder();
    let sentStarted = false;
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      if (path === "/chat/history?limit=20") {
        return Promise.resolve(new Response(JSON.stringify({
          conversations: [],
          pagination: { hasMore: false, nextCursor: null }
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      const body = new ReadableStream({
        pull(controller) {
          if (!sentStarted) {
            sentStarted = true;
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({
                type: "start",
                messageId: "assistant-1",
                messageMetadata: { conversation: { ...summary, lastMessage: "Will this finish?" } }
              })}\n\n`
            ));
          } else {
            controller.error(new Error("connection reset"));
          }
        }
      });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat("/");
    const composer = view.container.querySelector("textarea")!;
    fireEvent.change(composer, { target: { value: "Will this finish?" } });
    fireEvent.submit(view.container.querySelector(".composer")!);

    await waitFor(() => expect(view.container.textContent).toContain("We couldn't complete the response. Please try again."));
    expect(view.container.querySelector(".typing")).toBeNull();
    expect(view.container.textContent).toContain("Will this finish?");
    await waitFor(() => expect(screen.getByTestId("route-state")).toHaveTextContent("conversation"));
    expect(view.container.querySelector(".conversation-preview")).toHaveTextContent("Will this finish?");
  });

  it("shows a stop control while streaming and cancels the request", async () => {
    let sendSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/chat/history?limit=20") {
        return Promise.resolve(new Response(JSON.stringify({
          conversations: [],
          pagination: { hasMore: false, nextCursor: null }
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      sendSignal = options?.signal ?? undefined;
      return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          sendSignal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
        }
      }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat("/");
    fireEvent.change(view.container.querySelector("textarea")!, { target: { value: "Please keep going" } });
    fireEvent.submit(view.container.querySelector(".composer")!);

    const stopButton = await screen.findByRole("button", { name: "Stop generating" });
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    fireEvent.click(stopButton);

    await waitFor(() => expect(sendSignal?.aborted).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument());
  });

  it("isolates a new chat from a response still streaming in the previous chat", async () => {
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    let sendSignal: AbortSignal | undefined;
    const fetchMock = vi.fn().mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/chat/history?limit=20") {
        return Promise.resolve(new Response(JSON.stringify({
          conversations: [summary],
          pagination: { hasMore: false, nextCursor: null }
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (path === `/chat/history/${conversationId}?limit=30`) {
        return Promise.resolve(new Response(JSON.stringify({
          conversation,
          pagination: { hasMore: false, nextCursor: null }
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      sendSignal = options?.signal ?? undefined;
      return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(controller) { streamController = controller; }
      }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderChat(`/c/${conversationId}`);
    await waitFor(() => expect(view.container.textContent).toContain("Deep-linked answer"));
    fireEvent.change(view.container.querySelector("textarea")!, { target: { value: "First question" } });
    fireEvent.submit(view.container.querySelector(".composer")!);
    await waitFor(() => expect(streamController).toBeDefined());
    streamController!.enqueue(encoder.encode(
      `data: ${JSON.stringify({ type: "start", messageId: "assistant-1", messageMetadata: { conversation: summary } })}\n\n`
    ));
    await waitFor(() => expect(view.container.textContent).toContain("First question"));

    fireEvent.click(screen.getByRole("link", { name: /New chat/ }));
    await waitFor(() => expect(screen.getByTestId("route-state")).toHaveTextContent("root"));
    await waitFor(() => expect(view.container.textContent).toContain("How can we help?"));

    await waitFor(() => expect(sendSignal?.aborted).toBe(true));
    expect(view.container.textContent).toContain("How can we help?");
    expect(view.container.textContent).not.toContain("Late reply from the previous chat");
    fireEvent.change(view.container.querySelector("textarea")!, { target: { value: "Second question" } });
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("moves focus into the mobile navigation and restores it when closed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      conversations: [],
      pagination: { hasMore: false, nextCursor: null }
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const view = renderChat("/");
    const menuButton = screen.getByRole("button", { name: "Open menu" });

    fireEvent.click(menuButton);

    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();
    expect(view.container.querySelector(".chat-panel")).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    await waitFor(() => expect(menuButton).toHaveFocus());
    expect(view.container.querySelector(".chat-panel")).not.toHaveAttribute("inert");
  });
});
