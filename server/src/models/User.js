import mongoose from "mongoose";
import { isAdminEmail } from "../config.js";

const rsvpSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    passCode: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    givenName: { type: String, trim: true, maxlength: 60 },
    familyName: { type: String, trim: true, maxlength: 60 },
    picture: { type: String, maxlength: 500 },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    savedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    rsvps: [rsvpSchema],
    followedOrgs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Organization" }],
    // Bumping this invalidates every session issued for the user.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toClient = function toClient() {
  const initials = this.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  const isAdmin = this.role === "admin" || isAdminEmail(this.email);
  return {
    id: this._id.toString(),
    name: this.name,
    givenName: this.givenName || this.name.split(" ")[0],
    email: this.email,
    picture: this.picture || null,
    initials,
    role: isAdmin ? "admin" : this.role,
    isAdmin,
    savedEvents: this.savedEvents.map(String),
    rsvps: this.rsvps.map((r) => ({ eventId: String(r.event), passCode: r.passCode, createdAt: r.createdAt })),
    followedOrgs: this.followedOrgs.map(String),
  };
};

export const User = mongoose.model("User", userSchema);
