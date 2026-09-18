"use strict";
/** Server epoch + monotonic elapsed time. Never derives shared-world ages from
 * Date.now(), so changing the device's calendar cannot fast-forward a plant. */
class ServerClock {
  constructor(monotonic = () => performance.now()) {
    this.monotonic = monotonic;
    this.epoch = null;
    this.sampledAt = 0;
  }
  sync(epoch) {
    if (!Number.isSafeInteger(epoch) || epoch <= 0)
      throw Error("invalid_server_time");
    this.epoch = epoch;
    this.sampledAt = this.monotonic();
  }
  now() {
    return this.epoch === null
      ? null
      : this.epoch + Math.max(0, this.monotonic() - this.sampledAt);
  }
}
module.exports = { ServerClock };
