import mongoose from "mongoose";
import { isAdminEmail } from "../config.js";

export const ORG_CATEGORIES = [
  "Technology",
  "Arts",
  "Community",
  "Academic",
  "Cultural",
  "Career",
  "Social",
  "Sports",
  "Entertainment",
];

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 140 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    members: { type: Number, default: 1, min: 0 },
    color: { type: String, enum: ["yellow", "red", "black"], default: "red" },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdByName: { type: String, trim: true, maxlength: 120, default: "Campus Directory" },
    createdByEmail: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedByEmail: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    // Lower = shown first in the home-screen spotlight.
    rank: { type: Number, default: 100 },
  },
  { timestamps: true },
);

organizationSchema.methods.toClient = function toClient(viewer) {
  const viewerId = viewer?._id ? String(viewer._id) : viewer?.id ? String(viewer.id) : null;
  const isOwner = Boolean(viewerId && this.createdBy && String(this.createdBy) === viewerId);
  const isAdmin = Boolean(viewer && (viewer.role === "admin" || isAdminEmail(viewer.email)));
  return {
    id: this._id.toString(),
    name: this.name,
    category: this.category,
    members: this.members,
    color: this.color,
    letter: (this.name.trim()[0] || "T").toUpperCase(),
    description: this.description || "",
    status: this.status || "approved",
    createdBy: this.createdBy ? String(this.createdBy) : null,
    createdByName: this.createdByName || "Campus Directory",
    createdByEmail: this.createdByEmail || "",
    reviewedByEmail: this.reviewedByEmail || "",
    reviewedAt: this.reviewedAt || null,
    rejectionReason: this.rejectionReason || "",
    createdAt: this.createdAt || null,
    isOwner,
    canManage: isOwner || isAdmin,
  };
};

export const Organization = mongoose.model("Organization", organizationSchema);
