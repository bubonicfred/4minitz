/**
 * Utility class for various helper functions.
 */
export class Util {
  /**
   * Assigns enumerable properties from one or more source objects to a target
   * object. Only own and enumerable properties are copied over.
   *
   * @param {Object} target - The target object to assign properties to.
   * @param {...Object} sources - The source objects to copy properties from.
   * @returns {Object} - The modified target object.
   */
  static assignIn(target, ...sources) {
    const length = sources.length;
    if (length < 1 || target == null) return target;
    for (const source of sources) {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  }
}
