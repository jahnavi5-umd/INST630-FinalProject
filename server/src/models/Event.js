import mongoose from "mongoose";
import { isAdminEmail } from "../config.js";

export const CATEGORIES = ["Social", "Career", "Arts & Music", "Academic", "Cultural", "Sports", "Technology"];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", index: true },
    orgName: { type: String, required: true, trim: true, maxlength: 140 },
    category: { type: String, enum: CATEGORIES, required: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    location: { type: String, required: true, trim: true, maxlength: 140 },
    attendees: { type: Number, default: 0, min: 0 },
    capacity: { type: Number, min: 1 },
    note: { type: String, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 4000 },
    image: { type: String, required: true, maxlength: 500 },
    featured: { type: Boolean, default: false },
    featuredLabel: { type: String, maxlength: 60 },
    featuredHeadline: { type: String, maxlength: 140 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdByName: { type: String, trim: true, maxlength: 120, default: "" },
    createdByEmail: { type: String, trim: true, lowercase: true, maxlength: 120, default: "" },
  },
  { timestamps: true },
);

eventSchema.methods.toClient = function toClient(viewer, managedOrgIds = new Set()) {
  const viewerId = viewer?._id ? String(viewer._id) : viewer?.id ? String(viewer.id) : null;
  const isCreator = Boolean(viewerId && this.createdBy && String(this.createdBy) === viewerId);
  const isOrgManager = Boolean(this.organization && managedOrgIds.has(String(this.organization)));
  const isAdmin = Boolean(viewer && (viewer.role === "admin" || isAdminEmail(viewer.email)));
  return {
    id: this._id.toString(),
    title: this.title,
    org: this.orgName,
    organizationId: this.organization ? String(this.organization) : null,
    category: this.category,
    startsAt: this.startsAt,
    endsAt: this.endsAt || null,
    location: this.location,
    attendees: this.attendees,
    capacity: this.capacity ?? null,
    note: this.note || "",
    description: this.description || "",
    image: this.image,
    featured: this.featured,
    featuredLabel: this.featuredLabel || "",
    featuredHeadline: this.featuredHeadline || "",
    createdBy: this.createdBy ? String(this.createdBy) : null,
    createdByName: this.createdByName || "",
    createdByEmail: this.createdByEmail || "",
    canManage: isCreator || isOrgManager || isAdmin,
  };
};

export const Event = mongoose.model("Event", eventSchema);
