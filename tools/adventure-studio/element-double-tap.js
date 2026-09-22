"use strict";
/** One gesture for mouse, pen and touch; never infer a double click from a drag. */
class ElementDoubleTap {
  clear() { this.previous = null; }
  tap(row, point, time, pointerType) {
    const previous = this.previous, key = row.layer + "/" + row.e.id;
    this.previous = { key, point, time, pointerType };
    if (!previous || previous.key !== key || previous.pointerType !== pointerType ||
      time - previous.time > 400 || Math.hypot(point.x - previous.point.x, point.y - previous.point.y) > 14) return false;
    this.clear();
    return true;
  }
}
module.exports = { ElementDoubleTap };
