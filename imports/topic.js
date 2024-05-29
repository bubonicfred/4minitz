/**
 * @file Topic.js
 * @summary Defines the Topic class, which represents an Agenda Topic with
 * sub-items called InfoItems.
 * @description This file contains the implementation of the Topic class, which
 * is used to create and manipulate Agenda Topics in a meeting management
 * system. It provides methods for resolving parent elements, resolving topics,
 * finding topic index in an array, checking if a topic has open action items,
 * and more.
 * @module Topic
 */

import "./collections/minutes_private";

import {subElementsHelper} from "/imports/helpers/subElements";
import {_} from "lodash";
import {Meteor} from "meteor/meteor";
import {Random} from "meteor/random";

import {InfoItem} from "./infoitem";
import {InfoItemFactory} from "./InfoItemFactory";
import {MeetingSeries} from "./meetingseries";
import {Minutes} from "./minutes";

function resolveParentElement(parent) {
  if (typeof parent === "string") {
    const parentId = parent;
    parent = MeetingSeries.findOne(parentId);
    if (!parent)
      return Minutes.findOne(parentId);
    return parent;
  }

  if (typeof parent === "object" && typeof parent.upsertTopic === "function") {
    return parent;
  }

  throw new Meteor.Error("Runtime error, illegal parent element");
}

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

  _.defaults(source, {
    isOpen : true,
    isNew : true,
    isRecurring : false,
    labels : [],
    isSkipped : false,
  });

  return source;
}

/**
 * Represents a topic in a meeting or minute.
 * @class
 */
export class Topic {
  /**
   *
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

  // ################### static methods
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
   * Checks if the given topic document
   * has at least one open ActionItem.
   *
   * @param topicDoc document of a topic
   * @returns {boolean}
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

  // ################### object methods

  toString() { return `Topic: ${JSON.stringify(this._topicDoc, null, 4)}`; }

  log() { console.log(this.toString()); }

  invalidateIsNewFlag() {
    this._topicDoc.isNew = false;
    this._topicDoc.infoItems.forEach((infoItemDoc) => {
      const infoItem = InfoItemFactory.createInfoItem(this, infoItemDoc);
      infoItem.invalidateIsNewFlag();
    });
  }

  /**
   * A topic is finally completed (and will not show up in future minutes) if it
   * is
   *    - not checked as dicussed and
   *    - has no more open AIs and
   *    - is not marked as recurring
   * @returns {boolean}
   */
  isFinallyCompleted() {
    return (!this.getDocument().isOpen && !this.hasOpenActionItem() &&
            !this.isRecurring());
  }

  isDeleteAllowed() {
    return this.getDocument().createdInMinute === this._parentMinutes._id;
  }

  isRecurring() { return this.getDocument().isRecurring; }

  toggleRecurring() { this.getDocument().isRecurring = !this.isRecurring(); }

  isSkipped() { return this.getDocument().isSkipped; }

  toggleSkip(forceOpenTopic = true) {
    this.getDocument().isSkipped = !this.isSkipped();
    if (forceOpenTopic && this.isSkipped() && !this._topicDoc.isOpen) {
      // topic has been set to skip, so it will be automatically set as open
      this.toggleState();
    }
  }

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

  async removeInfoItem(id) {
    const index = subElementsHelper.findIndexById(id, this.getInfoItems());
    const item = this.getInfoItems()[index];
    if (InfoItem.isActionItem(item) &&
        !InfoItem.isCreatedInMinutes(item, this._parentMinutes._id)) {
      throw new Meteor.Error(
          "Cannot remove item",
          "It is not allowed to remove an action item which was not " +
              "created within the current minutes",
      );
    }

    if (index !== undefined) {
      this.getInfoItems().splice(index, 1);
      return this.save();
    }
  }

  /**
   * Removes all fire-and-forget elements as well
   * as closed AIs from this topic (info items which are
   * no action items)
   */
  tailorTopic() {
    this._topicDoc.infoItems = this._topicDoc.infoItems.filter(
        (infoItemDoc) => {
          const infoItem = InfoItemFactory.createInfoItem(this, infoItemDoc);
          return infoItem.isSticky();
        },
    );
  }

  /**
   * Finds the InfoItem identified by its
   * id.
   *
   * @param id
   * @returns {undefined|InfoItem|ActionItem}
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
  getInfoItems() { return this._topicDoc.infoItems; }

  /**
   * Returns an array of info items excluding action items.
   *
   * @returns {Array} An array of info items.
   */
  getOnlyInfoItems() {
    return this.getInfoItems().filter(
        (item) => { return !InfoItem.isActionItem(item); });
  }

  /**
   * Returns an array of action items from the topic document.
   *
   * @returns {Array} An array of action items.
   */
  getOnlyActionItems() {
    return this._topicDoc.infoItems.filter(
        (infoItemDoc) => { return InfoItem.isActionItem(infoItemDoc); });
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
  setItems(items) { this._topicDoc.infoItems = items; }

  /**
   * Sets the subject of the topic.
   *
   * @param {string} subject - The subject to set.
   */
  setSubject(subject) { this._topicDoc.subject = subject; }

  /**
   * Returns the subject of the topic.
   *
   * @returns {string} The subject of the topic.
   */
  getSubject() { return this._topicDoc.subject; }

  async save() { return this._parentMinutes.upsertTopic(this._topicDoc); }

  async saveAtBottom() {
    return this._parentMinutes.upsertTopic(this._topicDoc, false);
  }

  async toggleState() {
    // open/close
    this._topicDoc.isOpen = !this._topicDoc.isOpen;
    return Meteor.callAsync("minutes.updateTopic", this._topicDoc._id, {
      isOpen : this._topicDoc.isOpen,
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
    this.getOpenActionItems().forEach((item) => { item.isOpen = false; });
    await this.save();
  }

  /**
   * Checks if the topic has an open action item.
   *
   * @returns {boolean} True if the topic has an open action item, false
   *     otherwise.
   */
  hasOpenActionItem() { return Topic.hasOpenActionItem(this._topicDoc); }

  /**
   * Retrieves the topic document.
   *
   * @returns {Object} The topic document.
   */
  getDocument() { return this._topicDoc; }

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
  getResponsibles() { return this._topicDoc.responsibles; }
}
