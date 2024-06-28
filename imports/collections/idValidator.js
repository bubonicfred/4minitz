import {Validator} from "meteor/jagi:astronomy";

/**
 * Regular expression pattern for validating meteor ids.
 * @type {RegExp}
 */
const regExId =
    /^[23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz]{17}$/;

/**
 * Creates a custom validator for meteor ids.
 */
Validator.create({
  /**
   * Name of the validator.
   * @type {string}
   */
  name : "meteorId",

  /**
   * Checks if the provided value is a valid meteor id.
   * @param {Object} params - The parameters object.
   * @param {*} params.value - The value to be validated.
   * @returns {boolean} - True if the value is a valid meteor id, false
   *     otherwise.
   */
  isValid({value}) {
    if (Array.isArray(value)) {
      return value.map(a => regExId.test(a))
          .reduce(
              (previous, current) => previous && current,
              true,
          );
    }
    return regExId.test(value);
  },

  /**
   * Resolves the error message for an invalid meteor id.
   * @param {Object} params - The parameters object.
   * @param {string} params.name - The name of the invalid meteor id.
   * @returns {string} - The error message.
   */
  resolveError({name}) { return `"${name}" is not a meteor id`; },
});
