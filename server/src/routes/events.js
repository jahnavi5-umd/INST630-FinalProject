import crypto from "node:crypto";
import mongoose from "mongoose";
import { Router } from "express";
import { isAdminEmail } from "../config.js";
import { Event, CATEGORIES } from "../models/Event.js";
import { Organization } from "../models/Organization.js";
import { User } from "../models/User.js";
import { validateObjectId } from "../middleware/security.js";

const router = Router();

export const PRESET_IMAGES = [
  { label: "Outdoor Movie / Lawn", url: "/images/movie-night.jpg" },
  { label: "Live Concert / Stage", url: "/images/terps-after-dark.jpg" },
  { label: "Career Mixer / Networking", url: "/images/career-mixer.jpg" },
  { label: "Campus Festival / Crowd", url: "/images/featured-maryland-day.jpg" },
];

function isValidImageUrl(img) {
  if (typeof img !== "string" || !img.trim()) return false;
  const s = img.trim();
  if (s.startsWith("/images/")) return true;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function getManagedOrgIds(user) {
  const isAdmin = user.role === "admin" || isAdminEmail(user.email);
  const orgs = await Organization.find();
  if (isAdmin) {
    return new Set(orgs.map((o) => String(o._id)));
  }
  return new Set(
    orgs.filter((o) => o.createdBy && String(o.createdBy) === String(user._id)).map((o) => String(o._id)),
  );
}

// GET /api/events - all events from MongoDB
router.get("/", async (req, res, next) => {
  try {
    const [events, managedOrgIds] = await Promise.all([
      Event.find().sort({ startsAt: 1 }).limit(300),
      getManagedOrgIds(req.user),
    ]);
    res.json({
      events: events.map((e) => e.toClient(req.user, managedOrgIds)),
      categories: CATEGORIES,
      presetImages: PRESET_IMAGES,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", validateObjectId(), async (req, res, next) => {
  try {
    const [event, managedOrgIds] = await Promise.all([
      Event.findById(req.params.id),
      getManagedOrgIds(req.user),
    ]);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json({ event: event.toClient(req.user, managedOrgIds) });
  } catch (err) {
    next(err);
  }
});

// Create a new event under an approved organization
router.post("/", async (req, res, next) => {
  try {
    const isAdmin = req.user.role === "admin" || isAdminEmail(req.user.email);
    const organizationId = req.body?.organizationId;
    if (!organizationId || !mongoose.isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Please select an approved organization to host this event." });
    }

    const org = await Organization.findById(organizationId);
    if (!org) {
      return res.status(404).json({ error: "Selected organization was not found." });
    }
    if (org.status && org.status !== "approved") {
      return res.status(403).json({
        error: `“${org.name}” is currently ${org.status}. It must be approved by Admin (jahnavi5@umd.edu) before posting events.`,
      });
    }
    const isOrgOwner = org.createdBy && String(org.createdBy) === String(req.user._id);
    if (!isOrgOwner && !isAdmin) {
      return res.status(403).json({
        error: "You can only create events for organizations that you created and manage.",
      });
    }

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const category = req.body?.category;
    const location = typeof req.body?.location === "string" ? req.body.location.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 60) : "";
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 4000) : "";
    const image = isValidImageUrl(req.body?.image) ? req.body.image.trim() : "/images/movie-night.jpg";
    const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body?.endsAt ? new Date(req.body.endsAt) : null;
    const capacityRaw = req.body?.capacity;
    const capacity =
      capacityRaw !== undefined && capacityRaw !== null && capacityRaw !== "" ? Number(capacityRaw) : undefined;

    if (title.length < 2 || title.length > 140) {
      return res.status(400).json({ error: "Event title must be between 2 and 140 characters." });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Please choose a valid event category." });
    }
    if (!startsAt || Number.isNaN(+startsAt)) {
      return res.status(400).json({ error: "Please provide a valid start date and time." });
    }
    if (endsAt && (Number.isNaN(+endsAt) || +endsAt < +startsAt)) {
      return res.status(400).json({ error: "End time must be after the start time." });
    }
    if (location.length < 2 || location.length > 140) {
      return res.status(400).json({ error: "Please provide a valid campus location." });
    }
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
      return res.status(400).json({ error: "Capacity must be a positive whole number." });
    }

    const wantFeatured = Boolean(isAdmin && req.body?.featured);
    if (wantFeatured) {
      const existingFeatured = await Event.find({ featured: true });
      await Promise.all(
        existingFeatured.map((ev) => Event.findByIdAndUpdate(ev._id, { $set: { featured: false } })),
      );
    }

    const [created] = await Event.insertMany([
      {
        title,
        organization: org._id,
        orgName: org.name,
        category,
        startsAt,
        endsAt: endsAt || undefined,
        location,
        attendees: 1,
        capacity,
        note,
        description,
        image,
        featured: wantFeatured,
        featuredLabel: wantFeatured ? req.body?.featuredLabel || "FEATURED ON CAMPUS" : "",
        featuredHeadline: wantFeatured
          ? req.body?.featuredHeadline || `${title}\non campus.`
          : "",
        createdBy: req.user._id,
        createdByName: req.user.name,
        createdByEmail: req.user.email,
      },
    ]);

    const managedOrgIds = await getManagedOrgIds(req.user);
    res.status(201).json({ event: created.toClient(req.user, managedOrgIds) });
  } catch (err) {
    next(err);
  }
});

// Update an existing event (creator, organization owner, or App Admin)
router.put("/:id", validateObjectId(), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const managedOrgIds = await getManagedOrgIds(req.user);
    const isAdmin = req.user.role === "admin" || isAdminEmail(req.user.email);
    const isCreator = event.createdBy && String(event.createdBy) === String(req.user._id);
    const isOrgManager = event.organization && managedOrgIds.has(String(event.organization));

    if (!isAdmin && !isCreator && !isOrgManager) {
      return res.status(403).json({ error: "You do not have permission to edit this event." });
    }

    const update = {};
    if (typeof req.body?.title === "string") {
      const title = req.body.title.trim();
      if (title.length < 2 || title.length > 140) {
        return res.status(400).json({ error: "Event title must be between 2 and 140 characters." });
      }
      update.title = title;
    }
    if (req.body?.category !== undefined) {
      if (!CATEGORIES.includes(req.body.category)) {
        return res.status(400).json({ error: "Invalid category." });
      }
      update.category = req.body.category;
    }
    if (typeof req.body?.location === "string") {
      const location = req.body.location.trim();
      if (location.length < 2 || location.length > 140) {
        return res.status(400).json({ error: "Invalid location." });
      }
      update.location = location;
    }
    if (req.body?.startsAt !== undefined) {
      const d = new Date(req.body.startsAt);
      if (Number.isNaN(+d)) return res.status(400).json({ error: "Invalid start date." });
      update.startsAt = d;
    }
    if (req.body?.endsAt !== undefined) {
      update.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    }
    if (typeof req.body?.note === "string") {
      update.note = req.body.note.trim().slice(0, 60);
    }
    if (typeof req.body?.description === "string") {
      update.description = req.body.description.trim().slice(0, 4000);
    }
    if (req.body?.image !== undefined && isValidImageUrl(req.body.image)) {
      update.image = req.body.image.trim();
    }
    if (req.body?.capacity !== undefined) {
      const cap =
        req.body.capacity === null || req.body.capacity === "" ? null : Number(req.body.capacity);
      if (cap !== null && (!Number.isInteger(cap) || cap < 1)) {
        return res.status(400).json({ error: "Capacity must be a positive whole number." });
      }
      update.capacity = cap;
    }
    if (req.body?.organizationId && mongoose.isValidObjectId(req.body.organizationId)) {
      const org = await Organization.findById(req.body.organizationId);
      if (org && org.status === "approved" && (isAdmin || managedOrgIds.has(String(org._id)))) {
        update.organization = org._id;
        update.orgName = org.name;
      }
    }
    if (isAdmin && typeof req.body?.featured === "boolean") {
      if (req.body.featured) {
        const existingFeatured = await Event.find({ featured: true });
        await Promise.all(
          existingFeatured.map((ev) => Event.findByIdAndUpdate(ev._id, { $set: { featured: false } })),
        );
      }
      update.featured = req.body.featured;
      if (req.body.featured && !event.featuredHeadline) {
        update.featuredLabel = "FEATURED ON CAMPUS";
        update.featuredHeadline = req.body?.featuredHeadline || `${update.title || event.title}\non campus.`;
      }
    }

    const updated = await Event.findByIdAndUpdate(event._id, { $set: update }, { new: true });
    res.json({ event: updated.toClient(req.user, managedOrgIds) });
  } catch (err) {
    next(err);
  }
});

// Delete an event (creator, organization owner, or App Admin)
router.delete("/:id", validateObjectId(), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const managedOrgIds = await getManagedOrgIds(req.user);
    const isAdmin = req.user.role === "admin" || isAdminEmail(req.user.email);
    const isCreator = event.createdBy && String(event.createdBy) === String(req.user._id);
    const isOrgManager = event.organization && managedOrgIds.has(String(event.organization));

    if (!isAdmin && !isCreator && !isOrgManager) {
      return res.status(403).json({ error: "You do not have permission to delete this event." });
    }

    await Event.deleteMany({ _id: event._id });
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { savedEvents: event._id, rsvps: { event: event._id } } },
      { new: true },
    );

    res.json({ ok: true, user: (updatedUser || req.user).toClient() });
  } catch (err) {
    next(err);
  }
});

// Save / unsave (bookmark)
router.put("/:id/save", validateObjectId(), async (req, res, next) => {
  try {
    if (!(await Event.exists({ _id: req.params.id }))) return res.status(404).json({ error: "Event not found" });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { savedEvents: req.params.id } },
      { new: true },
    );
    res.json({ user: user.toClient() });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/save", validateObjectId(), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $pull: { savedEvents: req.params.id } }, { new: true });
    res.json({ user: user.toClient() });
  } catch (err) {
    next(err);
  }
});

// RSVP
router.post("/:id/rsvp", validateObjectId(), async (req, res, next) => {
  try {
    const eventId = req.params.id;
    const managedOrgIds = await getManagedOrgIds(req.user);
    const existing = req.user.rsvps.find((r) => String(r.event) === eventId);
    if (existing) {
      const event = await Event.findById(eventId);
      return res.json({
        user: req.user.toClient(),
        event: event?.toClient(req.user, managedOrgIds),
        passCode: existing.passCode,
      });
    }

    // Atomically increment attendance, respecting capacity when one is set.
    const event = await Event.findOneAndUpdate(
      {
        _id: eventId,
        $or: [{ capacity: { $exists: false } }, { capacity: null }, { $expr: { $lt: ["$attendees", "$capacity"] } }],
      },
      { $inc: { attendees: 1 } },
      { new: true },
    );
    if (!event) {
      const exists = await Event.exists({ _id: eventId });
      return res.status(exists ? 409 : 404).json({ error: exists ? "This event is full." : "Event not found" });
    }

    const passCode = crypto.randomBytes(9).toString("base64url").toUpperCase();
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, "rsvps.event": { $ne: event._id } },
      { $push: { rsvps: { event: event._id, passCode } } },
      { new: true },
    );
    if (!user) {
      // Lost a race with a concurrent RSVP - undo the increment.
      await Event.updateOne({ _id: event._id }, { $inc: { attendees: -1 } });
      const fresh = await User.findById(req.user._id);
      const r = fresh.rsvps.find((x) => String(x.event) === eventId);
      return res.json({
        user: fresh.toClient(),
        event: event.toClient(req.user, managedOrgIds),
        passCode: r?.passCode,
      });
    }
    res.status(201).json({
      user: user.toClient(),
      event: event.toClient(req.user, managedOrgIds),
      passCode,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/rsvp", validateObjectId(), async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, "rsvps.event": req.params.id },
      { $pull: { rsvps: { event: req.params.id } } },
      { new: true },
    );
    if (!user) return res.json({ user: req.user.toClient() });
    await Event.updateOne({ _id: req.params.id, attendees: { $gt: 0 } }, { $inc: { attendees: -1 } });
    res.json({ user: user.toClient() });
  } catch (err) {
    next(err);
  }
});

export default router;
