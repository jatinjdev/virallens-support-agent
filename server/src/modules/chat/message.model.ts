import { Schema, model, type Types } from "mongoose";

type MessageRole = "user" | "assistant";
type MessageStatus = "completed" | "failed";

export interface MessageRecord {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: Date;
}

const messageSchema = new Schema<MessageRecord>(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: "Conversation", immutable: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", immutable: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "", maxlength: 12_000 },
    status: { type: String, enum: ["completed", "failed"], required: true },
    createdAt: { type: Date, default: Date.now, immutable: true }
  },
  { versionKey: false }
);

messageSchema.index({ userId: 1, conversationId: 1, _id: -1 });

export const Message = model<MessageRecord>("Message", messageSchema);
