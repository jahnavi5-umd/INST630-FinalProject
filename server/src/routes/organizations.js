import { Router } from "express";
import { isAdminEmail } from "../config.js";
import { Organization, ORG_CATEGORIES } from "../models/Organization.js";
import { Event } from "../models/Event.js";
import { User } from "../models/User.js";
import { validateObjectId } from "../middleware/security.js";

const router = Router();
const VALID_COLORS = new Set(["yellow", "red", "black"]);

function canManageOrg(user, org) {
  if (!user || !org) return false;
  if (user.role === "admin" || isAdminEmail(user.email)) return true;
  return Boolean(org.createdBy && String(org.createdBy) === String(user._id));
}

router.get("/", async (req, res, next) => {
  try {
    const all = await Organization.find().sort({ rank: 1, members: -1 }).limit(500);
    const isAdmin = req.user.role === "admin" || isAdminEmail(req.user.email);

    const approved = all.filter((o) => !o.status || o.status === "approved");
    const myOrganizations = all.filter((o) => o.createdBy && String(o.createdBy) === String(req.user._id));
    const pendingCount = isAdmin ? all.filter((o) => o.status === "pending").length : 0;

    res.json({
      organizations: approved.map((o) => o.toClient(req.user)),
      myOrganizations: myOrganizations.map((o) => o.toClient(req.user)),
      categories: ORG_CATEGORIES,
      pendingCount,
    });
  } catch (err) {
    next(err);
  }
});

// Create a new student organization (starts as "pending" until approved by jahnavi5@umd.edu)
router.post("/", async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const color = VALID_COLORS.has(req.body?.color) ? req.body.color : "red";

    if (name.length < 2 || name.length > 140) {
      return res.status(400).json({ error: "Group name must be between 2 and 140 characters." });
    }
    if (category.length < 2 || category.length > 60) {
      return res.status(400).json({ error: "Please select a category for the group." });
    }
    if (description.length > 2000) {
      return res.status(400).json({ error: "Description must be 2000 characters or fewer." });
    }

    const all = await Organization.find();
    const duplicate = all.find((o) => o.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      return res.status(409).json({ error: "An organization with that name already exists." });
    }

    const [org] = await Organization.insertMany([
      {
        name,
        category,
        description,
        color,
        members: 1,
        status: "pending",
        createdBy: req.user._id,
        createdByName: req.user.name,
        createdByEmail: req.user.email,
        rank: 50,
      },
    ]);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { followedOrgs: org._id } },
      { new: true },
    );

    res.status(201).json({
      organization: org.toClient(req.user),
      user: (updatedUser || req.user).toClient(),
    });
  } catch (err) {
    next(err);
  }
});

// Update an organization (owner or App Admin)
router.put("/:id", validateObjectId(), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (!canManageOrg(req.user, org)) {
      return res.status(403).json({ error: "You do not have permission to manage this group." });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : org.name;
    const category = typeof req.body?.category === "string" ? req.body.category.trim() : org.category;
    const description =
      typeof req.body?.description === "string" ? req.body.description.trim() : org.description || "";
    const color = VALID_COLORS.has(req.body?.color) ? req.body.color : org.color;

    if (name.length < 2 || name.length > 140) {
      return res.status(400).json({ error: "Group name must be between 2 and 140 characters." });
    }
    if (category.length < 2 || category.length > 60) {
      return res.status(400).json({ error: "Please select a category." });
    }

    if (name.toLowerCase() !== org.name.toLowerCase()) {
      const all = await Organization.find();
      if (all.some((o) => String(o._id) !== String(org._id) && o.name.trim().toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: "Another organization already uses that name." });
      }
    }

    const setFields = { name, category, description, color };
    if (org.status === "rejected" && String(org.createdBy) === String(req.user._id)) {
      setFields.status = "pending";
      setFields.rejectionReason = "";
    }

    const updated = await Organization.findByIdAndUpdate(org._id, { $set: setFields }, { new: true });

    if (name !== org.name) {
      const orgEvents = await Event.find({ organization: org._id });
      await Promise.all(
        orgEvents.map((ev) => Event.findByIdAndUpdate(ev._id, { $set: { orgName: name } })),
      );
    }

    res.json({ organization: updated.toClient(req.user) });
  } catch (err) {
    next(err);
  }
});

// Delete an organization and its events (owner or App Admin)
router.delete("/:id", validateObjectId(), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (!canManageOrg(req.user, org)) {
      return res.status(403).json({ error: "You do not have permission to delete this group." });
    }

    await Event.deleteMany({ organization: org._id });
    await Organization.deleteMany({ _id: org._id });
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { followedOrgs: org._id } },
      { new: true },
    );

    res.json({ ok: true, user: (updatedUser || req.user).toClient() });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/follow", validateObjectId(), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org || (org.status && org.status !== "approved")) {
      return res.status(404).json({ error: "Organization not found or not yet approved." });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, followedOrgs: { $ne: org._id } },
      { $addToSet: { followedOrgs: org._id } },
      { new: true },
    );
    if (user) await Organization.updateOne({ _id: org._id }, { $inc: { members: 1 } });
    const fresh = user || (await User.findById(req.user._id));
    res.json({ user: fresh.toClient() });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/follow", validateObjectId(), async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.user._id, followedOrgs: req.params.id },
      { $pull: { followedOrgs: req.params.id } },
      { new: true },
    );
    if (user) await Organization.updateOne({ _id: req.params.id, members: { $gt: 0 } }, { $inc: { members: -1 } });
    const fresh = user || (await User.findById(req.user._id));
    res.json({ user: fresh.toClient() });
  } catch (err) {
    next(err);
  }
});

export default router;
