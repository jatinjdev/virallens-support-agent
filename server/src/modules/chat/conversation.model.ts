import { Schema, model, type Types } from "mongoose";

export interface ConversationRecord {
  userId: Types.ObjectId;
  title: string;
  lastMessagePreview: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    lastMessagePreview: { type: String, default: null, maxlength: 500 }
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, updatedAt: -1, _id: -1 });

export const Conversation = model<ConversationRecord>("Conversation", conversationSchema);
