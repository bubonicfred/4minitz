/**
 * A InfoItem is a sub-element of
 * a topic which has a subject,>
 * a date when is was created
 * and a list of associated tags.
 */
import { _ } from "lodash";
import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";

import { formatDateISO8601 } from "./helpers/date.js";
import { StringUtils } from "./helpers/string-utils.js";
import { User } from "./user.js";

/**
 * The InfoItem class represents an information item in a topic.
 *
 * @class
 * @param {Object} parentTopic - The topic to which this InfoItem belongs.
 * @param {Object} source - The source document for this InfoItem.
 * @throws {Meteor.Error} If parentTopic or source is not provided.
 */
export class InfoItem {
  constructor(parentTopic, source) {
    if (!parentTopic || !source)
      throw new Meteor.Error(
        "It is not allowed to create a InfoItem without the parentTopicId and the source",
      );

    this._parentTopic = undefined;
    this._infoItemDoc = undefined;

    if (typeof parentTopic === "object") {
      // we have a topic object here.
      this._parentTopic = parentTopic;
    }
    if (!this._parentTopic) {
      throw new Meteor.Error("No parent Topic given!");
    }

    if (typeof source === "string") {
      // we may have an ID here.
      // Caution: findInfoItem returns a InfoItem-Object not the document
      // itself!
      const infoItem = this._parentTopic.findInfoItem(source);
      source = infoItem._infoItemDoc;
    }

    if (!Object.prototype.hasOwnProperty.call(source, "createdInMinute")) {
      throw new Meteor.Error("Property createdInMinute of topicDoc required");
    }
    _.defaults(source, {
      itemType: "infoItem",
      isNew: true,
      isSticky: false,
      labels: [],
    });
    this._infoItemDoc = source;
  }

  /**
   * Checks if the given infoItem document is an action item.
   *
   * @param {Object} infoItemDoc - The infoItem document to check.
   * @returns {boolean} - Returns true if the infoItem is an action item, false
   *     otherwise.
   */
  static isActionItem(infoItemDoc) {
    return infoItemDoc.itemType === "actionItem";
  }

  /**
   * Checks if an info item document is created in a specific minute.
   * @param {Object} infoItemDoc - The info item document to check.
   * @param {string} minutesId - The ID of the minute to compare against.
   * @returns {boolean} - True if the info item is created in the specified
   *     minute, false otherwise.
   */
  static isCreatedInMinutes(infoItemDoc, minutesId) {
    return infoItemDoc.createdInMinute === minutesId;
  }

  /**
   * Invalidates the isNew flag of the info item.
   */
  invalidateIsNewFlag() {
    this._infoItemDoc.isNew = false;
  }

  /**
   * Returns the ID of the info item.
   *
   * @returns {string} The ID of the info item.
   */
  getId() {
    return this._infoItemDoc._id;
  }

  /**
   * Checks if the info item is sticky.
   * @returns {boolean} True if the info item is sticky, false otherwise.
   */
  isSticky() {
    return this._infoItemDoc.isSticky;
  }

  /**
   * Checks if the deletion of the info item is allowed.
   *
   * @param {string} currentMinutesId - The ID of the current minutes.
   * @returns {boolean} - Returns true if the deletion is allowed, false
   *     otherwise.
   */
  isDeleteAllowed(currentMinutesId) {
    return this._infoItemDoc.createdInMinute === currentMinutesId;
  }

  /**
   * Toggles the sticky state of the info item.
   */
  toggleSticky() {
    this._infoItemDoc.isSticky = !this.isSticky();
  }

  /**
   * Returns the subject of the info item.
   *
   * @returns {string} The subject of the info item.
   */
  getSubject() {
    return this._infoItemDoc.subject;
  }

  /**
   * Adds details to the info item.
   * @param {string} minuteId - The ID of the minute.
   * @param {string} [text] - The text of the details. Defaults to an empty
   *     string if not provided.
   */
  addDetails(minuteId, text) {
    if (text === undefined) text = "";

    const date = formatDateISO8601(new Date());
    if (!this._infoItemDoc.details) {
      this._infoItemDoc.details = [];
    }
    this._infoItemDoc.details.push({
      _id: Random.id(),
      createdInMinute: minuteId,
      createdAt: new Date(),
      createdBy: User.profileNameWithFallback(Meteor.user()),
      updatedAt: new Date(),
      updatedBy: User.profileNameWithFallback(Meteor.user()),
      date,
      text,
      isNew: true,
    });
  }

  /**
   * Removes a detail from the info item's details array at the specified index.
   *
   * @param {number} index - The index of the detail to remove.
   * @returns {void}
   */
  removeDetails(index) {
    this._infoItemDoc.details.splice(index, 1);
  }

  /**
   * Updates the details of an info item at the specified index.
   * If the text is empty, an error is thrown.
   * If the text is the same as the existing details, no update is performed.
   * The date, text, updatedAt, and updatedBy fields of the details are updated.
   *
   * @param {number} index - The index of the details to update.
   * @param {string} text - The new text for the details.
   * @throws {Meteor.Error} If the text is empty.
   */
  updateDetails(index, text) {
    if (text === "") {
      throw new Meteor.Error(
        "invalid-argument",
        "Empty details are not allowed. Use #removeDetails() " +
          "to delete an element",
      );
    }
    if (text === this._infoItemDoc.details[index].text) {
      return;
    }
    this._infoItemDoc.details[index].date = formatDateISO8601(new Date());
    this._infoItemDoc.details[index].text = text;
    this._infoItemDoc.details[index].updatedAt = new Date();
    this._infoItemDoc.details[index].updatedBy = User.profileNameWithFallback(
      Meteor.user(),
    );
  }

  /**
   * Retrieves the details of the info item.
   * If the details are not already initialized, an empty array is assigned to
   * it.
   * @returns {Array} The details of the info item.
   */
  getDetails() {
    if (!this._infoItemDoc.details) {
      this._infoItemDoc.details = [];
    }

    return this._infoItemDoc.details;
  }

  /**
   * Retrieves the details at the specified index.
   *
   * @param {number} index - The index of the details to retrieve.
   * @returns {*} The details at the specified index.
   * @throws {Meteor.Error} Throws an error if the index is out of bounds or if
   *     the details are not available.
   */
  getDetailsAt(index) {
    if (
      !this._infoItemDoc.details ||
      index < 0 ||
      index >= this._infoItemDoc.details.length
    ) {
      throw new Meteor.Error("index-out-of-bounds");
    }

    return this._infoItemDoc.details[index];
  }

  /**
   * Saves the current instance asynchronously.
   * @todo factor out callback
   * @param {Function} callback - The callback function to be called after the
  save operation completes.
   * @returns {Promise} A promise that resolves with the result of the save
  operation.
  //
*/
  async save(callback = () => {}) {
    try {
      const result = await this.saveAsync();
      callback(undefined, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Saves the info item asynchronously.
   *
   * @param {boolean} [insertPlacementTop=true] - Determines whether to insert
   *     the info item at the top or bottom.
   * @returns {Promise<string>} - A promise that resolves with the ID of the
   *     saved info item.
   * @throws {Error} - If there is an error while saving the info item.
   */
  async saveAsync(insertPlacementTop = true) {
    try {
      const currentUserProfileName = User.profileNameWithFallback(
        Meteor.user(),
      );

      if (!this._infoItemDoc._id) {
        this._infoItemDoc.createdAt = new Date();
        this._infoItemDoc.createdBy = currentUserProfileName;
      }

      this._infoItemDoc.updatedAt = new Date();
      this._infoItemDoc.updatedBy = currentUserProfileName;

      this._infoItemDoc._id = await this._parentTopic.upsertInfoItem(
        this._infoItemDoc,
        true,
        insertPlacementTop,
      );
    } catch (error) {
      console.error("Error saving info item:", error);
      throw error;
    }
  }

  /**
   * Saves the item at the bottom.
   * @returns {Promise} A promise that resolves when the save operation is
   *     complete.
   */
  saveAtBottom() {
    return this.saveAsync(false);
  }

  /**
   * Get the parent topic of this info item.
   *
   * @returns {Object} The parent topic object.
   */
  getParentTopic() {
    return this._parentTopic;
  }

  /**
   * Checks if the info item is an action item.
   * @returns {boolean} True if the info item is an action item, false
   *     otherwise.
   */
  isActionItem() {
    return InfoItem.isActionItem(this._infoItemDoc);
  }

  /**
   * Retrieves the document associated with the info item.
   * @returns {Object} The document associated with the info item.
   */
  getDocument() {
    return this._infoItemDoc;
  }

  /**
   * Sets the subject of the info item.
   *
   * @param {string} newSubject - The new subject to set.
   */
  setSubject(newSubject) {
    this._infoItemDoc.subject = newSubject;
  }

  /**
   * Adds labels to the info item by their IDs.
   * @param {Array<string>} labelIds - An array of label IDs to be added.
   */
  addLabelsById(labelIds) {
    labelIds.forEach((id) => {
      if (!this.hasLabelWithId(id)) {
        this._infoItemDoc.labels.push(id);
      }
    });
  }

  /**
   * Checks if the info item has a label with the specified ID.
   *
   * @param {string} labelId - The ID of the label to check.
   * @returns {boolean} - Returns true if the info item has a label with the
   *     specified ID, false otherwise.
   */
  hasLabelWithId(labelId) {
    let i;
    for (i = 0; i < this._infoItemDoc.labels.length; i++) {
      if (this._infoItemDoc.labels[i] === labelId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns an array of labels for the info item.
   * If no labels are present, an empty array is returned.
   *
   * @returns {Array} The array of labels for the info item.
   */
  getLabelsRawArray() {
    if (!this._infoItemDoc.labels) {
      return [];
    }
    return this._infoItemDoc.labels;
  }

  /**
   * Returns a string representation of the InfoItem object.
   * @todo refactor to use {@link StringUtils.createToString}
   *   constructor() {
   *
   *this.toString = StringUtils.createToString(this);
   * }
   * @returns {string} The string representation of the InfoItem object.
   */
  toString() {
    return `InfoItem: ${JSON.stringify(this._infoItemDoc, null, 4)}`;
  }

  /**
   * Description placeholder
   */
  log() {
    console.log(this.toString());
  }
}
