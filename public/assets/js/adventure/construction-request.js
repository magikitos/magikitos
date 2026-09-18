"use strict";
const { operationId } = require("./material-account");

/** Retry one *rejected* zone revision, never an ambiguous transport failure.
 * The exact next request is journalled before sending, so a lost acknowledgement
 * is replayed without charging again. Object/account conflicts are not rebased. */
async function sendConstruction(request, { send, latest, remember }) {
  remember(request);
  try {
    return await send(request);
  } catch (error) {
    if (error.status !== 409 || error.code !== "zone_conflict") throw error;
  }
  const snapshot = await latest(request.zone);
  if (snapshot.zone !== request.zone || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0)
    throw Error("invalid_community");
  const retry = { ...request, operationId: operationId(), zoneRevision: snapshot.revision };
  remember(retry);
  return send(retry);
}
module.exports = { sendConstruction };
