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

  // ################### static methods
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

  // ################### object methods
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

  isSticky() {
    return this._infoItemDoc.isSticky;
  }

  isDeleteAllowed(currentMinutesId) {
    return this._infoItemDoc.createdInMinute === currentMinutesId;
  }

  toggleSticky() {
    this._infoItemDoc.isSticky = !this.isSticky();
  }

  getSubject() {
    return this._infoItemDoc.subject;
  }

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

  removeDetails(index) {
    this._infoItemDoc.details.splice(index, 1);
  }

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

  getDetails() {
    if (!this._infoItemDoc.details) {
      this._infoItemDoc.details = [];
    }

    return this._infoItemDoc.details;
  }

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

  async save(callback = () => {}) {
    try {
      const result = await this.saveAsync();
      callback(undefined, result);
    } catch (error) {
      callback(error);
    }
  }

  async saveAsync(insertPlacementTop = true) {
    // Explain why the entire topics array is updated from the parent minutes of
    // the parent topic.
    try {
      const currentUserProfileName = User.profileNameWithFallback(
        Meteor.user(),
      );

      if (!this._infoItemDoc._id) {
        // If it's a new info item, set creation details.
        this._infoItemDoc.createdAt = new Date();
        this._infoItemDoc.createdBy = currentUserProfileName;
      }

      // Always update the last modification details.
      this._infoItemDoc.updatedAt = new Date();
      this._infoItemDoc.updatedBy = currentUserProfileName;

      // Upsert the info item document in the parent topic.
      // The second parameter 'true' could be replaced with a named constant for
      // clarity.
      this._infoItemDoc._id = await this._parentTopic.upsertInfoItem(
        this._infoItemDoc,
        true, // Consider replacing with a named constant for clarity.
        insertPlacementTop,
      );
    } catch (error) {
      // Handle or log the error appropriately.
      console.error("Error saving info item:", error);
      throw error; // Rethrow or handle as needed.
    }
  }

  saveAtBottom() {
    return this.saveAsync(false);
  }

  getParentTopic() {
    return this._parentTopic;
  }

  isActionItem() {
    return InfoItem.isActionItem(this._infoItemDoc);
  }

  getDocument() {
    return this._infoItemDoc;
  }

  setSubject(newSubject) {
    this._infoItemDoc.subject = newSubject;
  }

  /**
   * Adds labels to the info item by their IDs.
   * @param {Array} labelIds - An array of label IDs to be added.
   */
  addLabelsById(labelIds) {
    labelIds.forEach((id) => {
      if (!this.hasLabelWithId(id)) {
        this._infoItemDoc.labels.push(id);
      }
    });
  }

  hasLabelWithId(labelId) {
    let i;
    for (i = 0; i < this._infoItemDoc.labels.length; i++) {
      if (this._infoItemDoc.labels[i] === labelId) {
        return true;
      }
    }
    return false;
  }

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

  log() {
    console.log(this.toString());
  }
}
