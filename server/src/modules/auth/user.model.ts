import { Schema, model } from "mongoose";

export interface UserRecord {
  email: string;
  name: string;
  passwordHash: string;
}

const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false }
  },
  { timestamps: true }
);

export const User = model<UserRecord>("User", userSchema);
