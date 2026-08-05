import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageList } from "./MessageList";

describe("MessageList", () => {
  it("renders assistant Markdown as structured content", async () => {
    render(
      <MessageList
        regionRef={createRef<HTMLDivElement>()}
        messages={[{
          id: "assistant-1",
          role: "assistant",
          metadata: { status: "failed" },
          parts: [{
            type: "text",
            text: "### Order update<br>**Status:** Ready\n\n| Item | State |\n| --- | --- |\n| Parcel | Shipped |\n\n**Incomplete"
          }]
        }]}
        status="ready"
        loading={false}
        loadingOlder={false}
        canLoadOlder={false}
        onLoadOlder={() => undefined}
      />
    );

    expect(await screen.findByRole("heading", { name: "Order update" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.queryByText(/### Order update/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*Incomplete/)).not.toBeInTheDocument();
  });
});
