export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeZero(value) {
  if (value === 0) {
    return 0;
  }
  return value;
}

export function readFinite(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return normalizeZero(value);
}

export function isId(value) {
  return typeof value === "string" && value.length > 0;
}

export function exactKeys(value, keys) {
  const own = Object.keys(value).sort();
  if (own.length !== keys.length) {
    return false;
  }
  for (let index = 0; index < keys.length; index += 1) {
    if (own[index] !== keys[index]) {
      return false;
    }
  }
  return true;
}

export function contains(ids, id) {
  for (const candidate of ids) {
    if (candidate === id) {
      return true;
    }
  }
  return false;
}

export function toSet(ids) {
  const set = Object.create(null);
  for (const id of ids) {
    set[id] = true;
  }
  return set;
}
