import { Event } from "../models/Event.js";
import { Organization } from "../models/Organization.js";
import { events, organizations } from "./data.js";

export async function seedDatabase({ reset = false } = {}) {
  if (reset) {
    await Promise.all([Event.deleteMany({}), Organization.deleteMany({})]);
  } else if ((await Event.estimatedDocumentCount()) > 0) {
    // Ensure any legacy seeded organizations have status: "approved"
    await Organization.updateMany?.({ status: { $exists: false } }, { $set: { status: "approved" } });
    return false;
  }

  const orgDocs = await Organization.insertMany(
    organizations.map((o, i) => ({
      ...o,
      status: "approved",
      createdByName: "UMD Student Affairs",
      rank: i,
    })),
  );
  const byName = new Map(orgDocs.map((o) => [o.name, o]));

  await Event.insertMany(
    events.map(({ org, ...e }) => {
      const orgName = e.orgName || org;
      return { ...e, orgName, organization: byName.get(orgName)?._id };
    }),
  );
  console.log(`[seed] inserted ${orgDocs.length} organizations and ${events.length} events`);
  return true;
}
