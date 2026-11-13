import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../.data/terplink.json");

function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch {
    /* start fresh on corrupt file */
  }
  return {};
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

const str = (v) => (v == null ? "" : String(v));

function getPath(obj, dotPath) {
  return dotPath.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function matchCondition(val, cond) {
  if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date) && !(cond instanceof mongoose.Types.ObjectId)) {
    if ("$exists" in cond) {
      const exists = val !== undefined;
      if (Boolean(cond.$exists) !== exists) return false;
    }
    if ("$ne" in cond) {
      if (Array.isArray(val)) {
        if (val.some((item) => str(item) === str(cond.$ne))) return false;
      } else if (str(val) === str(cond.$ne)) {
        return false;
      }
    }
    if ("$gt" in cond && !(val > cond.$gt)) return false;
    if ("$gte" in cond) {
      const a = val instanceof Date || typeof val === "string" ? +new Date(val) : val;
      const b = cond.$gte instanceof Date || typeof cond.$gte === "string" ? +new Date(cond.$gte) : cond.$gte;
      if (!(a >= b)) return false;
    }
    if ("$lt" in cond && !(val < cond.$lt)) return false;
    if ("$lte" in cond && !(val <= cond.$lte)) return false;
    return true;
  }
  if (Array.isArray(val)) {
    return val.some((item) => str(item) === str(cond));
  }
  return str(val) === str(cond);
}

function matches(raw, filter = {}) {
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or") {
      if (!cond.some((sub) => matches(raw, sub))) return false;
      continue;
    }
    if (key === "$expr") {
      if (cond.$lt) {
        const [aKey, bKey] = cond.$lt;
        const a = raw[aKey.replace(/^\$/, "")];
        const b = raw[bKey.replace(/^\$/, "")];
        if (!(a < b)) return false;
      }
      continue;
    }
    if (key.includes(".")) {
      const [head, tail] = key.split(".");
      const arr = raw[head];
      if (Array.isArray(arr)) {
        if (cond && typeof cond === "object" && "$ne" in cond) {
          if (arr.some((item) => str(item?.[tail]) === str(cond.$ne))) return false;
        } else if (!arr.some((item) => matchCondition(item?.[tail], cond))) {
          return false;
        }
        continue;
      }
    }
    if (!matchCondition(getPath(raw, key), cond)) return false;
  }
  return true;
}

function applyUpdate(raw, update = {}, isInsert = false) {
  if (isInsert && update.$setOnInsert) {
    Object.assign(raw, update.$setOnInsert);
  }
  if (update.$set) {
    Object.assign(raw, update.$set);
  }
  if (update.$inc) {
    for (const [k, delta] of Object.entries(update.$inc)) {
      raw[k] = (Number(raw[k]) || 0) + Number(delta);
    }
  }
  if (update.$addToSet) {
    for (const [k, val] of Object.entries(update.$addToSet)) {
      const arr = Array.isArray(raw[k]) ? raw[k] : [];
      if (!arr.some((x) => str(x) === str(val))) arr.push(str(val));
      raw[k] = arr;
    }
  }
  if (update.$push) {
    for (const [k, val] of Object.entries(update.$push)) {
      const arr = Array.isArray(raw[k]) ? raw[k] : [];
      arr.push(val);
      raw[k] = arr;
    }
  }
  if (update.$pull) {
    for (const [k, cond] of Object.entries(update.$pull)) {
      const arr = Array.isArray(raw[k]) ? raw[k] : [];
      if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof mongoose.Types.ObjectId)) {
        raw[k] = arr.filter((item) => !matches(item, cond));
      } else {
        raw[k] = arr.filter((item) => str(item) !== str(cond));
      }
    }
  }
  raw.updatedAt = new Date().toISOString();
}

/**
 * Attaches an embedded JSON-backed adapter to the given Mongoose models when
 * MONGODB_URI is not set, while preserving full Mongoose schema validation and
 * document methods (.toClient(), etc.).
 */
export function attachEmbeddedStore(models) {
  const store = loadStore();

  for (const Model of models) {
    const name = Model.modelName;
    if (!Array.isArray(store[name])) store[name] = [];

    const hydrate = (raw) => {
      if (!raw) return null;
      const doc = new Model(raw);
      doc._id = new mongoose.Types.ObjectId(String(raw._id));
      doc.save = async function saveDoc() {
        const err = doc.validateSync();
        if (err) throw err;
        const plain = JSON.parse(JSON.stringify(doc.toObject()));
        plain._id = String(doc._id);
        const idx = store[name].findIndex((r) => str(r._id) === plain._id);
        if (idx >= 0) store[name][idx] = plain;
        else store[name].push(plain);
        saveStore(store);
        return doc;
      };
      return doc;
    };

    const toPlainValidated = (input) => {
      const doc = new Model(input);
      if (!doc._id) doc._id = new mongoose.Types.ObjectId();
      const err = doc.validateSync();
      if (err) throw err;
      const plain = JSON.parse(JSON.stringify(doc.toObject()));
      plain._id = String(doc._id);
      const now = new Date().toISOString();
      plain.createdAt = plain.createdAt || now;
      plain.updatedAt = now;
      return plain;
    };

    Model.find = function find(filter = {}) {
      let sortSpec = null;
      let limitNum = null;
      const exec = async () => {
        let rows = store[name].filter((r) => matches(r, filter));
        if (sortSpec) {
          const entries = Object.entries(sortSpec);
          rows = [...rows].sort((a, b) => {
            for (const [k, dir] of entries) {
              const av = a[k] ?? 0;
              const bv = b[k] ?? 0;
              const cmp = av < bv ? -1 : av > bv ? 1 : 0;
              if (cmp !== 0) return cmp * (dir < 0 ? -1 : 1);
            }
            return 0;
          });
        }
        if (limitNum != null) rows = rows.slice(0, limitNum);
        return rows.map(hydrate);
      };
      const chain = {
        sort(s) {
          sortSpec = s;
          return chain;
        },
        limit(n) {
          limitNum = n;
          return chain;
        },
        select() {
          return chain;
        },
        then: (resolve, reject) => exec().then(resolve, reject),
      };
      return chain;
    };

    Model.findOne = function findOne(filter = {}) {
      const exec = async () => hydrate(store[name].find((r) => matches(r, filter)) || null);
      return {
        select() {
          return this;
        },
        then: (resolve, reject) => exec().then(resolve, reject),
      };
    };

    Model.findById = (id) => Model.findOne({ _id: str(id) });

    Model.exists = async (filter = {}) => {
      const hit = store[name].find((r) => matches(r, filter));
      return hit ? { _id: hit._id } : null;
    };

    Model.estimatedDocumentCount = async () => store[name].length;

    Model.deleteMany = async (filter = {}) => {
      const before = store[name].length;
      store[name] = Object.keys(filter).length === 0 ? [] : store[name].filter((r) => !matches(r, filter));
      saveStore(store);
      return { deletedCount: before - store[name].length };
    };

    Model.insertMany = async (docs) => {
      const created = docs.map((d) => toPlainValidated(d));
      store[name].push(...created);
      saveStore(store);
      return created.map(hydrate);
    };

    Model.findOneAndUpdate = async (filter = {}, update = {}, opts = {}) => {
      const idx = store[name].findIndex((r) => matches(r, filter));
      if (idx === -1) {
        if (!opts.upsert) return null;
        const seed = {};
        for (const [k, v] of Object.entries(filter)) {
          if (!k.startsWith("$") && !k.includes(".")) seed[k] = v;
        }
        applyUpdate(seed, update, true);
        const plain = toPlainValidated(seed);
        store[name].push(plain);
        saveStore(store);
        return hydrate(plain);
      }
      const copy = structuredClone(store[name][idx]);
      applyUpdate(copy, update, false);
      const validated = toPlainValidated(copy);
      validated._id = String(store[name][idx]._id);
      store[name][idx] = validated;
      saveStore(store);
      return hydrate(validated);
    };

    Model.findByIdAndUpdate = (id, update, opts) => Model.findOneAndUpdate({ _id: str(id) }, update, opts);

    Model.updateOne = async (filter = {}, update = {}) => {
      const res = await Model.findOneAndUpdate(filter, update);
      return { modifiedCount: res ? 1 : 0 };
    };
  }
}

