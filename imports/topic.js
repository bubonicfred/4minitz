/**
 * @file Topic.js
 * @summary Defines the Topic class, which represents an Agenda Topic with
 * sub-items called InfoItems.
 * @description This file contains the implementation of the Topic class, which
 * is used to create and manipulate Agenda Topics in a meeting management
 * system. It provides methods for resolving parent elements, resolving topics,
 * finding topic index in an array, checking if a topic has open action items,
 * and more.
 */

import "./collections/minutes_private";

import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";

import { subElementsHelper } from "./helpers/subElements";
import { InfoItem } from "./infoitem";
import { InfoItemFactory } from "./InfoItemFactory";
import { MeetingSeries } from "./meetingseries";
import { Minutes } from "./minutes";

/**
 * Resolves the parent element based on the given input.
 * If the input is a string, it tries to find a MeetingSeries or Minutes
 * document with the given ID. If the input is an object with an `upsertTopic`
 * function, it returns the input itself. Throws a Meteor.Error if the input is
 * not a valid parent element.
 *
 * @param {string|object} parent - The parent element to resolve.
 * @returns {object} - The resolved parent element.
 * @throws {Meteor.Error} - If the input is not a valid parent element.
 */
function resolveParentElement(parent) {
  if (typeof parent === "string") {
    const parentId = parent;
    parent = MeetingSeries.findOne(parentId);
    if (!parent) return Minutes.findOne(parentId);
    return parent;
  }

  if (typeof parent === "object" && typeof parent.upsertTopic === "function") {
    return parent;
  }

  throw new Meteor.Error("Runtime error, illegal parent element");
}

/**
 * Resolves a topic based on the provided parent element and source.
 *
 * @param {Object} parentElement - The parent element to search for the topic.
 * @param {string|Object} source - The source string or object representing the
 *     topic.
 * @returns {Object} - The resolved topic object.
 * @throws {Meteor.Error} - If the parent element is illegal or the topic cannot
 *     be found.
 */
function resolveTopic(parentElement, source) {
  if (typeof source === "string") {
    if (typeof parentElement.findTopic !== "function") {
      throw new Meteor.Error("Runtime error, illegal parent element");
    }

    source = parentElement.findTopic(source);
    if (!source) {
      throw new Meteor.Error("Runtime Error, could not find topic!");
    }
  }

  source = Object.assign(
    {
      isOpen: true,
      isNew: true,
      isRecurring: false,
      labels: [],
      isSkipped: false,
    },
    source,
  );

  return source;
}

/**
 * Represents a topic in a meeting or minute.
 */
export class Topic {
  /**
   * @todo "parent object which has at least the methods
   * upsertTopic() and findTopic()" seems odd, look into refactoring
   * @param parentElement {string|object} is either the id of the parent minute
   *     or parent meeting series
   *                      or the parent object which has at least the methods
   * upsertTopic() and findTopic(). So the parent object could be both a minute
   * or a meeting series.
   * @param source        {string|object} topic_id then the document will be
   *     fetched from the parentMinute
   *                      or a topic object
   */
  constructor(parentElement, source) {
    if (!parentElement || !source) {
      return;
    }

    this._parentMinutes = resolveParentElement(parentElement);
    if (!this._parentMinutes) {
      return;
    }

    this._topicDoc = resolveTopic(this._parentMinutes, source);

    if (!Array.isArray(this._topicDoc.infoItems)) {
      this._topicDoc.infoItems = [];
    }
  }

  /**
   * Finds the index of a topic in an array based on its ID.
   *
   * @param {string} id - The ID of the topic to find.
   * @param {Array} topics - The array of topics to search in.
   * @returns {number} - The index of the topic in the array, or -1 if not
   *     found.
   */
  static findTopicIndexInArray(id, topics) {
    return subElementsHelper.findIndexById(id, topics);
  }

  /**
   * Checks if a topic document has an open action item.
   *
   * @param {Object} topicDoc - The topic document to check.
   * @returns {boolean} - True if the topic document has an open action item,
   *     false otherwise.
   */
  static hasOpenActionItem(topicDoc) {
    const infoItemDocs = topicDoc.infoItems;
    let i;
    for (i = 0; i < infoItemDocs.length; i++) {
      if (infoItemDocs[i].itemType === "actionItem" && infoItemDocs[i].isOpen) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns a string representation of the Topic object.
   * @todo Replace with string utils method
   * @returns {string} The string representation of the Topic object.
   */
  toString() {
    return `Topic: ${JSON.stringify(this._topicDoc, null, 4)}`;
  }

  /**
   * @todo extract to utility function
   *
   * Logs the string representation of the object.
   */
  log() {
    console.log(this.toString());
  }

  /**
   * Invalidates the isNew flag for the topic and its info items.
   */
  invalidateIsNewFlag() {
    this._topicDoc.isNew = false;
    this._topicDoc.infoItems.forEach((/** @type {any} */ infoItemDoc) => {
      const infoItem = InfoItemFactory.createInfoItem(this, infoItemDoc);
      infoItem.invalidateIsNewFlag();
    });
  }

  /**
   * Checks if the topic is finally completed (will not show up in future
   * minutes). A topic is considered finally completed if:
   * - The document is not open
   * - There are no open action items
   * - The topic is not recurring
   *
   * @returns {boolean} True if the topic is finally completed, false otherwise.
   */
  isFinallyCompleted() {
    return (
      !this.getDocument().isOpen &&
      !this.hasOpenActionItem() &&
      !this.isRecurring()
    );
  }

  /**
   * Checks if the deletion of the topic is allowed.
   * @returns {boolean} Returns true if the deletion is allowed, otherwise
   *     false.
   */
  isDeleteAllowed() {
    return this.getDocument().createdInMinute === this._parentMinutes._id;
  }

  /**
   * Checks if the topic is recurring.
   * @returns {boolean} Returns true if the topic is recurring, false otherwise.
   */
  isRecurring() {
    return this.getDocument().isRecurring;
  }

  /**
   * Toggles the recurring status of the document.
   */
  toggleRecurring() {
    this.getDocument().isRecurring = !this.isRecurring();
  }

  /**
   * Checks if the topic is skipped.
   * @returns {boolean} True if the topic is skipped, false otherwise.
   */
  isSkipped() {
    return this.getDocument().isSkipped;
  }

  /**
   * Toggles the skip state of the topic.
   * If `forceOpenTopic` is true, it also opens the topic if it is skipped and
   * not already open.
   *
   * @param {boolean} [forceOpenTopic=true] - Whether to force open the topic if
   *     it is skipped and not already open.
   */
  toggleSkip(forceOpenTopic = true) {
    this.getDocument().isSkipped = !this.isSkipped();
    if (forceOpenTopic && this.isSkipped() && !this._topicDoc.isOpen) {
      // topic has been set to skip, so it will be automatically set as open
      this.toggleState();
    }
  }

  /**
   * Upserts an info item in the topic.
   *
   * @param {Object} topicItemDoc - The info item document to upsert.
   * @param {boolean} [saveChanges=true] - Indicates whether to save changes to
   *     the topic after upserting the info item. Default is true.
   * @param {boolean} [insertPlacementTop=true] - Indicates whether to insert
   *     the info item at the top of the info items array. Default is true.
   * @returns {string} The _id of the upserted info item.
   */
  async upsertInfoItem(topicItemDoc, saveChanges, insertPlacementTop = true) {
    if (saveChanges === undefined) {
      saveChanges = true;
    }
    let i = undefined;
    if (topicItemDoc._id) {
      i = subElementsHelper.findIndexById(
        topicItemDoc._id,
        this.getInfoItems(),
      );
    } else {
      // brand-new topicItem
      topicItemDoc._id = Random.id(); // create our own local _id here!
    }
    if (i === undefined) {
      // topicItem not in array
      if (insertPlacementTop) {
        this.getInfoItems().unshift(topicItemDoc);
      } else {
        this.getInfoItems().push(topicItemDoc);
      }
    } else {
      this.getInfoItems()[i] = topicItemDoc; // overwrite in place
    }

    if (saveChanges) {
      try {
        await this.save();
      } catch (e) {
        throw e;
      }
    }
    return topicItemDoc._id;
  }

  /**
   * Removes an info item from the topic.
   *
   * @param {string} id - The ID of the info item to be removed.
   * @returns {Promise} A promise that resolves when the info item is
   *     successfully removed.
   * @throws {Meteor.Error} If the info item is an action item created in a
   *     different set of minutes.
   */
  async removeInfoItem(id) {
    const index = subElementsHelper.findIndexById(id, this.getInfoItems());
    const item = this.getInfoItems()[index];
    if (
      InfoItem.isActionItem(item) &&
      !InfoItem.isCreatedInMinutes(item, this._parentMinutes._id)
    ) {
      throw new Meteor.Error(
        "Cannot remove item",
        "It is not allowed to remove an action item which was not " +
          "created within the current minutes",
      );
    }

    if (index !== undefined) {
      this.getInfoItems().splice(index, 1);
      await this.save();
    }
  }

  /**
   * Filters the infoItems in the topic document based on a condition.
   */
  tailorTopic() {
    this._topicDoc.infoItems = this._topicDoc.infoItems.filter(
      (/** @type {any} */ infoItemDoc) => {
        const infoItem = InfoItemFactory.createInfoItem(this, infoItemDoc);
        return infoItem.isSticky();
      },
    );
  }

  /**
   * Finds the InfoItem identified by its
   * id.
   * @param {string} id
   * @returns {undefined | InfoItem | ActionItem}
   */
  findInfoItem(id) {
    const i = subElementsHelper.findIndexById(id, this.getInfoItems());
    if (i !== undefined) {
      return InfoItemFactory.createInfoItem(this, this.getInfoItems()[i]);
    }
    return undefined;
  }

  /**
   * Retrieves the information items associated with the topic.
   * @returns {Array} An array of information items.
   */
  getInfoItems() {
    return this._topicDoc.infoItems;
  }

  /**
   * Returns an array of info items excluding action items.
   *
   * @returns {Array} An array of info items.
   */
  getOnlyInfoItems() {
    return this.getInfoItems().filter((item) => {
      return !InfoItem.isActionItem(item);
    });
  }

  /**
   * Returns an array of action items from the topic document.
   *
   * @returns {Array} An array of action items.
   */
  getOnlyActionItems() {
    return this._topicDoc.infoItems.filter((/** @type {any} */ infoItemDoc) => {
      return InfoItem.isActionItem(infoItemDoc);
    });
  }

  /**
   * Returns an array of open action items from the topic document.
   *
   * @returns {Array} An array of open action items.
   */
  getOpenActionItems() {
    return this._topicDoc.infoItems.filter((infoItemDoc) => {
      return InfoItem.isActionItem(infoItemDoc) && infoItemDoc.isOpen;
    });
  }

  /**
   * Sets the items for the topic.
   *
   * @param {Array} items - The items to set for the topic.
   */
  setItems(items) {
    this._topicDoc.infoItems = items;
  }

  /**
   * Sets the subject of the topic.
   *
   * @param {string} subject - The subject to set.
   */
  setSubject(subject) {
    this._topicDoc.subject = subject;
  }

  /**
   * Returns the subject of the topic.
   *
   * @returns {string} The subject of the topic.
   */
  getSubject() {
    return this._topicDoc.subject;
  }

  /**
   * Saves the topic by calling the `upsertTopic` method of the parent minutes.
   * @returns {Promise} A promise that resolves when the topic is saved.
   */
  async save() {
    await this._parentMinutes.upsertTopic(this._topicDoc);
  }

  /**
   * Saves the topic at the bottom of the parent minutes.
   * @returns {Promise} A promise that resolves when the topic is saved.
   */
  async toggleState() {
    // open/close
    this._topicDoc.isOpen = !this._topicDoc.isOpen;
    await Meteor.callAsync("minutes.updateTopic", this._topicDoc._id, {
      isOpen: this._topicDoc.isOpen,
    });
  }

  /**
   * Closes the topic and all open action items associated with it.
   * Sets the topic's isOpen and isRecurring properties to false.
   * Sets the isOpen property of all open action items to false.
   * Saves the changes to the database.
   *
   * @returns {Promise<void>} A promise that resolves when the changes are
   *     saved.
   */
  async closeTopicAndAllOpenActionItems() {
    this._topicDoc.isOpen = false;
    this._topicDoc.isRecurring = false;
    this.getOpenActionItems().forEach((item) => {
      item.isOpen = false;
    });
    await this.save();
  }

  /**
   * Checks if the topic has an open action item.
   *
   * @returns {boolean} True if the topic has an open action item, false
   *     otherwise.
   */
  hasOpenActionItem() {
    return Topic.hasOpenActionItem(this._topicDoc);
  }

  /**
   * Retrieves the topic document.
   *
   * @returns {Object} The topic document.
   */
  getDocument() {
    return this._topicDoc;
  }

  /**
   * Adds labels to the topic document by their IDs.
   *
   * @param {Array} labelIds - An array of label IDs to be added.
   */
  addLabelsByIds(labelIds) {
    labelIds.forEach((id) => {
      if (!this.hasLabelWithId(id)) {
        this._topicDoc.labels.push(id);
      }
    });
  }

  /**
   * Checks if the topic has a label with the specified ID.
   *
   * @param {string} labelId - The ID of the label to check.
   * @returns {boolean} - Returns true if the topic has a label with the
   *     specified ID, false otherwise.
   */
  hasLabelWithId(labelId) {
    let i;
    for (i = 0; i < this._topicDoc.labels.length; i++) {
      if (this._topicDoc.labels[i] === labelId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retrieves the raw array of labels for the topic.
   * If no labels are present, an empty array is returned.
   *
   * @returns {Array} The raw array of labels.
   */
  getLabelsRawArray() {
    if (!this._topicDoc.labels) {
      return [];
    }
    return this._topicDoc.labels;
  }

  /**
   * Checks whether this topic has associated responsible particpants
   * or not. This method must have the same name as the
   * actionItem.hasResponsibles method.
   *
   * @return {boolean}
   */
  hasResponsibles() {
    const responsibles = this._topicDoc.responsibles;
    return responsibles && responsibles.length > 0;
  }

  /**
   * Returns all responsible participants associated with this
   * topic. This method must have the same name as the
   * actionItem.getResponsibles method.
   *
   * @return {Array}
   */
  getResponsibles() {
    return this._topicDoc.responsibles;
  }
}
