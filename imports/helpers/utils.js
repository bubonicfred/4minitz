export class Util {
 static assignIn(target, ...sources) {
    const length = sources.length;
    if (length < 1 || target == null) return target;
    for (const source of sources) {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key]; // Corrected line
        }
      }
    }
    return target;
  };
};
