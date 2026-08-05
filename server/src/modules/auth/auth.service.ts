import bcrypt from "bcryptjs";
import { mongo } from "mongoose";
import { AppError } from "../../http/errors.js";
import { User } from "./user.model.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

interface Credentials {
  email: string;
  password: string;
}

interface SignupInput extends Credentials {
  name: string;
}

function toAuthenticatedUser(user: { _id: unknown; email: string; name: string }): AuthenticatedUser {
  return { id: String(user._id), email: user.email, name: user.name };
}

export class AuthService {
  async signup(input: SignupInput): Promise<AuthenticatedUser> {
    try {
      const user = await User.create({
        email: input.email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, 12),
      });
      return toAuthenticatedUser(user);
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists.");
      }
      throw error;
    }
  }

  async login(input: Credentials): Promise<AuthenticatedUser> {
    const user = await User.findOne({ email: input.email }).select("+passwordHash");
    const matches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !matches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    return toAuthenticatedUser(user);
  }

  async session(userId: string): Promise<AuthenticatedUser> {
    const user = await User.findById(userId);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Your account could not be found.");
    return toAuthenticatedUser(user);
  }
}
