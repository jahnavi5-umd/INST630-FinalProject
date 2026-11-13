import { Router } from "express";
import { Organization } from "../models/Organization.js";
import { Event } from "../models/Event.js";
import { User } from "../models/User.js";
import { requireAdmin } from "../middleware/auth.js";
import { validateObjectId } from "../middleware/security.js";

const router = Router();
router.use(requireAdmin);

// GET /api/admin/overview - all group requests, organizations, events, and platform stats
router.get("/overview", async (req, res, next) => {
  try {
    const [orgs, events, totalUsers] = await Promise.all([
      Organization.find().sort({ createdAt: -1 }),
      Event.find().sort({ startsAt: 1 }),
      User.estimatedDocumentCount(),
    ]);
    const allOrgIds = new Set(orgs.map((o) => String(o._id)));
    const clientOrgs = orgs.map((o) => o.toClient(req.user));

    res.json({
      organizations: clientOrgs,
      pendingOrganizations: clientOrgs.filter((o) => o.status === "pending"),
      approvedOrganizations: clientOrgs.filter((o) => o.status === "approved"),
      rejectedOrganizations: clientOrgs.filter((o) => o.status === "rejected"),
      events: events.map((e) => e.toClient(req.user, allOrgIds)),
      stats: {
        totalUsers,
        pendingOrgs: clientOrgs.filter((o) => o.status === "pending").length,
        approvedOrgs: clientOrgs.filter((o) => o.status === "approved").length,
        rejectedOrgs: clientOrgs.filter((o) => o.status === "rejected").length,
        totalEvents: events.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Approve a pending group creation request
router.post("/organizations/:id/approve", validateObjectId(), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const updated = await Organization.findByIdAndUpdate(
      org._id,
      {
        $set: {
          status: "approved",
          reviewedBy: req.user._id,
          reviewedByEmail: req.user.email,
          reviewedAt: new Date(),
          rejectionReason: "",
        },
      },
      { new: true },
    );

    if (org.createdBy) {
      await User.findByIdAndUpdate(org.createdBy, { $addToSet: { followedOrgs: org._id } });
    }

    res.json({ organization: updated.toClient(req.user) });
  } catch (err) {
    next(err);
  }
});

// Reject a group creation request
router.post("/organizations/:id/reject", validateObjectId(), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const reason =
      typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, 500)
        : "Not approved by administrator.";

    const updated = await Organization.findByIdAndUpdate(
      org._id,
      {
        $set: {
          status: "rejected",
          reviewedBy: req.user._id,
          reviewedByEmail: req.user.email,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
      },
      { new: true },
    );

    res.json({ organization: updated.toClient(req.user) });
  } catch (err) {
    next(err);
  }
});

export default router;

