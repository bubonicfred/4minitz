/**
 * @file This file contains the implementation of the MeetingSeries class. The
 *   MeetingSeries class represents a series of meetings and provides methods
 *   for managing and manipulating meeting data. It includes static methods for
 *   finding and removing meeting series, as well as object methods for adding
 *   and removing minutes, saving the meeting series, and more.
 * @exports MeetingSeries
 */

import "./collections/meetingseries_private";

import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";
import moment from "moment/moment";

import { MeetingSeriesSchema } from "./collections/meetingseries.schema";
import { formatDateISO8601 } from "./helpers/date";
import { subElementsHelper } from "./helpers/subElements";
import { Util as _ } from "./helpers/utils";
import { Minutes } from "./minutes";
import { MinutesFinder } from "./services/minutesFinder";
import { TopicsFinder } from "./services/topicsFinder";
import { UserRoles } from "./userroles";

export class MeetingSeries {
  /**
   * Represents a MeetingSeries object.
   *
   * @param {string | object} source - The source of the MeetingSeries object.
   *   It can be either a Mongo ID or a Mongo document.
   */
  constructor(source) {
    if (!source) return;

    if (typeof source === "string") {
      // we may have an ID here.
      source = MeetingSeriesSchema.getCollection().findOne(source);
    }
    if (typeof source === "object") {
      // inject class methods in plain collection document
      _.assignIn(this, source);
    }
  }

  /**
   * Finds documents in the MeetingSeries collection based on the provided
   * arguments.
   *
   * @param {...any} args - The arguments to be passed to the find method of the
   *   MeetingSeries collection.
   * @returns {Mongo.Cursor} - A cursor pointing to the result set of the find
   *   operation.
   */
  static find(...args) {
    return MeetingSeriesSchema.getCollection().find(...args);
  }

  /**
   * Finds a single document in the MeetingSeries collection that matches the
   * specified query.
   *
   * @param {...any} args - The arguments to be passed to the findOne method of
   *   the MeetingSeries collection.
   * @returns {Object | null} - The matching document, or null if no document is
   *   found.
   */
  static findOne(...args) {
    return MeetingSeriesSchema.getCollection().findOne(...args);
  }

  /**
   * Removes a meeting series.
   *
   * @param {Object} meetingSeries - The meeting series object to be removed.
   * @returns {Promise} A promise that resolves when the meeting series is
   *   successfully removed.
   */
  static async remove(meetingSeries) {
    await Meteor.callAsync("workflow.removeMeetingSeries", meetingSeries._id);
  }

  /**
   * Leaves a meeting series.
   *
   * @param {Object} meetingSeries - The meeting series object.
   * @returns {Promise} A promise that resolves when the leave operation is
   *   completed.
   */
  static async leave(meetingSeries) {
    await Meteor.callAsync("workflow.leaveMeetingSeries", meetingSeries._id);
  }

  /**
   * Returns an array of visible meeting series IDs for the specified user.
   *
   * @param {string} userId - The ID of the user.
   * @returns {string[]} - An array of visible meeting series IDs.
   */
  static getAllVisibleIDsForUser(userId) {
    // we return an array with just a list of visible meeting series IDs
    return MeetingSeriesSchema.find(
      { visibleFor: { $in: [userId] } },
      { _id: 1 },
    ).map((item) => item._id);
  }

  /**
   * Retrieves the record associated with the current MeetingSeries instance.
   *
   * @returns {Object | null} The record object if found, or null if not found.
   */
  getRecord() {
    return MeetingSeriesSchema.findOne(this._id);
  }

  /**
   * Removes minutes with the specified ID.
   *
   * @param {string} minutesId - The ID of the minutes to remove.
   * @returns {Promise} A promise that resolves when the minutes are removed and
   *   the last minutes fields are updated.
   */
  async removeMinutesWithId(minutesId) {
    console.log(`removeMinutesWithId: ${minutesId}`);

    await Minutes.remove(minutesId);
    return this.updateLastMinutesFieldsAsync();
  }

  /**
   * Saves the meeting series by either updating an existing one or inserting a
   * new one. If the meeting series has an _id property, it is updated using the
   * "meetingseries.update" Meteor method. Otherwise, it is inserted using the
   * "meetingseries.insert" Meteor method.
   *
   * @param {Function} optimisticUICallback - The callback function to be
   *   executed after the save operation completes.
   * @returns {string} - The _id of the saved meeting series.
   * @todo Check if this is still needed under Meteor 3, or if it can be
   *   incorperated into the saveAsync method
   */
  save(optimisticUICallback) {
    return this._id
      ? Meteor.callAsync("meetingseries.update", this)
      : Meteor.callAsync("meetingseries.insert", this, optimisticUICallback);
  }

  /**
   * Saves the meeting series asynchronously.
   *
   * @param {Function} optimisticUICallback - The callback function to be
   *   executed optimistically during the save operation.
   * @returns {Promise} A promise that resolves when the save operation is
   *   complete.
   */
  async saveAsync(optimisticUICallback) {
    await this.save(optimisticUICallback);
  }

  /**
   * Returns a string representation of the MeetingSeries object.
   *
   * @returns {string} The string representation of the MeetingSeries object.
   * @todo Refactor to use stringhelper
   */
  toString() {
    return `MeetingSeries: ${JSON.stringify(this, null, 4)}`;
  }

  /**
   * Logs the string representation of the object.
   *
   * @todo Make utility function
   */
  log() {
    console.log(this.toString());
  }

  /**
   * Adds new minutes to the meeting series.
   *
   * @param {Function} optimisticUICallback - The callback function to be called
   *   after the optimistic UI update.
   * @param {Function} serverCallback - The callback function to be called after
   *   the server update.
   * @returns {void}
   */
  addNewMinutes(optimisticUICallback, serverCallback) {
    console.log("addNewMinutes()");

    // The new Minutes object should be dated after the latest existing one
    let newMinutesDate = new Date();
    const lastMinutes = MinutesFinder.lastMinutesOfMeetingSeries(this);
    if (lastMinutes && formatDateISO8601(newMinutesDate) <= lastMinutes.date) {
      const lastMinDate = moment(lastMinutes.date);
      newMinutesDate = lastMinDate.add(1, "days").toDate();
    }
    // Transfer global note from last minutes if set sticky
    const globalNotePinned = lastMinutes?.globalNotePinned;
    const globalNote = globalNotePinned ? lastMinutes.globalNote : "";

    const min = new Minutes({
      meetingSeries_id: this._id,
      date: formatDateISO8601(newMinutesDate),
      visibleFor: this.visibleFor, // freshly created minutes inherit
      // visibility of their series
      informedUsers: this.informedUsers, // freshly created minutes inherit
      // informedUsers of their series
      globalNotePinned,
      globalNote,
    });

    min.generateNewParticipants();
    min.save(optimisticUICallback, serverCallback);
  }

  /**
   * Upserts a topic.
   *
   * @memberof MeetingSeries
   * @deprecated This method is obsolete. Please refactor the topic class.
   * @function upsertTopic
   * @instance
   */
  static upsertTopic() {
    // Intentionally empty
  }

  /**
   * Checks if a minute with the given ID exists in the meeting series.
   *
   * @param {string} id - The ID of the minute to check.
   * @returns {boolean} - True if a minute with the given ID exists, false
   *   otherwise.
   */
  hasMinute(id) {
    for (const minuteId of this.minutes) {
      if (minuteId === id) {
        return true;
      }
    }
    return false;
  }

  /**
   * Counts the number of minutes in the meeting series.
   *
   * @returns {number} The number of minutes in the meeting series.
   */
  countMinutes() {
    return this.minutes ? this.minutes.length : 0;
  }

  /**
   * Updates the last minutes fields asynchronously.
   *
   * @param {Function} [callback] - Optional callback function to be called when
   *   the update is complete.
   * @returns {Promise} A promise that resolves with the result of the update.
   */
  async updateLastMinutesFields(callback) {
    callback = callback || (() => {});

    try {
      const result = await this.updateLastMinutesFieldsAsync();
      callback(undefined, result);
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Updates the last minutes fields asynchronously.
   *
   * @async
   * @param {Object} lastMinuteDoc - The last minute document.
   * @returns {Promise} A promise that resolves when the update is complete.
   */
  async updateLastMinutesFieldsAsync(lastMinuteDoc) {
    const updateInfo = {
      _id: this._id,
    };

    const lastMinutes = lastMinuteDoc
      ? lastMinuteDoc
      : MinutesFinder.lastMinutesOfMeetingSeries(this);

    updateInfo.lastMinutesDate = lastMinutes ? lastMinutes.date : "";
    updateInfo.lastMinutesId = lastMinutes ? lastMinutes._id : null;
    updateInfo.lastMinutesFinalized = lastMinutes
      ? lastMinutes.isFinalized
      : false;

    await Meteor.callAsync("meetingseries.update", updateInfo);
  }

  /**
   * Checks if adding new minutes is allowed for the meeting series.
   *
   * @returns {boolean} Returns true if adding new minutes is allowed, false
   *   otherwise.
   */
  addNewMinutesAllowed() {
    const lastMinutes = MinutesFinder.lastMinutesOfMeetingSeries(this);
    return !lastMinutes || lastMinutes.isFinalized;
  }

  /**
   * Returns the date of the latest minute in the meeting series.
   * @returns {Date|null} The date of the latest minute, or null if no minutes
   *     are found.
   */
  _getDateOfLatestMinute() {
    const lastMinutes = MinutesFinder.lastMinutesOfMeetingSeries(this);

    if (lastMinutes) {
      return new Date(lastMinutes.date);
    }
    return null;
  }

  /**
   * Get the date of the latest minute excluding the given minuteId.
   *
   * @param {string} minuteId - The ID of the minute to exclude.
   * @returns {Date | undefined} The date of the first non-matching minute, or
   *   undefined if no non-matching minute is found.
   * @todo Check if excluding the given minuteId could be done directly in the
   *   find call on the collection
   */
  _getDateOfLatestMinuteExcluding(minuteId) {
    const latestMinutes = Minutes.findAllIn(this.minutes, 2).map((minute) => {
      return {
        _id: minute._id,
        date: minute.date,
      };
    });

    if (!latestMinutes) {
      return;
    }
    const firstNonMatchingMinute = latestMinutes.find(
      (minute) => minute._id !== minuteId,
    );
    if (firstNonMatchingMinute) {
      return new Date(firstNonMatchingMinute.date);
    }
  }

  /**
   * Gets the first possible date which can be assigned to the given minutes.
   *
   * @param {string} minutesId - The ID of the minutes.
   * @returns {Date} The minimum allowed date for minutes.
   */
  getMinimumAllowedDateForMinutes(minutesId) {
    const firstPossibleDate = minutesId
      ? this._getDateOfLatestMinuteExcluding(minutesId)
      : this._getDateOfLatestMinute();

    if (firstPossibleDate) {
      firstPossibleDate.setHours(0);
      firstPossibleDate.setMinutes(0);
    }

    return firstPossibleDate;
  }

  /**
   * Checks if a given date is allowed for the specified minutes.
   *
   * @param {string} minutesId - The ID of the minutes.
   * @param {string | Date} date - The date to check.
   * @returns {boolean} - Returns true if the date is allowed, false otherwise.
   */
  isMinutesDateAllowed(minutesId, date) {
    if (typeof date === "string") {
      date = new Date(date);
    }

    date.setHours(0);
    date.setMinutes(0);

    const firstPossibleDate = this.getMinimumAllowedDateForMinutes(minutesId);
    // if no firstPossibleDate is given, all dates are allowed
    return !firstPossibleDate || date > firstPossibleDate;
  }

  /**
   * Sets the visible and informed users for the meeting series. Overrides
   * current "visibleFor" array. Needs a "save()" afterwards to persist
   *
   * @param {Array} newVisibleForArray - An array of user IDs representing the
   *   new visible users.
   * @param {Array} newInformedUsersArray - An array of user IDs representing
   *   the new informed users.
   * @throws {Meteor.Error} If the meeting series is not saved, or if the
   *   newVisibleForArray is not an array.
   */
  setVisibleAndInformedUsers(newVisibleForArray, newInformedUsersArray) {
    if (!this._id) {
      throw new Meteor.Error(
        "MeetingSeries not saved.",
        "Call save() before using addVisibleUser()",
      );
    }
    if (!Array.isArray(newVisibleForArray)) {
      throw new Meteor.Error("setVisibleUsers()", "must provide an array!");
    }

    // Clean-up roles
    // Collect all removed users where the meeting series is not visible and not
    // informed anymore And then remove the old meeting series role from these
    // users
    let oldUserArray = this.visibleFor;
    if (this.informedUsers) {
      oldUserArray = oldUserArray.concat(this.informedUsers);
    }
    let newUserArray = newVisibleForArray;
    newUserArray = newUserArray.concat(newInformedUsersArray);

    const removedUserIDs = oldUserArray.filter((usrID) => {
      return newUserArray.includes(usrID);
    });
    removedUserIDs.forEach((removedUserID) => {
      const ur = new UserRoles(removedUserID);
      ur.removeAllRolesForMeetingSeries(this._id);
    });

    // persist new user arrays to meeting series
    this.informedUsers = newInformedUsersArray;
    this.visibleFor = newVisibleForArray;

    // sync visibility for *all* minutes (to allow publish & subscribe)
    Minutes.syncVisibility(this._id, this.visibleFor);

    // sync informed only to *not finalized* minutes (do not change the past!)
    const lastMinutes = MinutesFinder.lastMinutesOfMeetingSeries(this);
    if (lastMinutes && !lastMinutes.isFinalized) {
      lastMinutes.informedUsers = newInformedUsersArray;
      lastMinutes.save();
    }
  }

  /**
   * Checks if the current user is a moderator of the meeting series.
   *
   * @returns {boolean} True if the current user is a moderator, false
   *   otherwise.
   */
  isCurrentUserModerator() {
    const ur = new UserRoles();
    return ur.isModeratorOf(this._id);
  }

  /**
   * Finds a label by its ID.
   *
   * @augments subElementsHelper.getElementById
   * @param {string} id - The ID of the label to find.
   * @returns {Element | null} - The found label element, or null if not found.
   */
  findLabel(id) {
    return subElementsHelper.getElementById(id, this.availableLabels);
  }

  /**
   * Finds a label by its name.
   *
   * @augments subElementsHelper.getElementById
   * @param {string} labelName - The name of the label to find.
   * @returns {object | null} - The found label object, or null if not found.
   */
  findLabelByName(labelName) {
    return subElementsHelper.getElementById(
      labelName,
      this.availableLabels,
      "name",
    );
  }

  /**
   * Finds labels containing a substring.
   *
   * @param {string} name - The substring to search for.
   * @param {boolean} [caseSensitive=true] - Indicates whether the search should
   *   be case-sensitive. Default is true. Default is `true`
   * @returns {Array} - An array of labels containing the specified substring.
   */
  findLabelContainingSubstr(name, caseSensitive = true) {
    return this.availableLabels.filter((label) => {
      const left = caseSensitive ? label.name : label.name.toUpperCase();
      const right = caseSensitive ? name : name.toUpperCase();
      return left.includes(right);
    });
  }

  /**
   * Removes a label from the available labels list.
   *
   * @param {string} id - The ID of the label to be removed.
   * @returns {void}
   */
  removeLabel(id) {
    const index = subElementsHelper.findIndexById(
      id,
      this.getAvailableLabels(),
    );
    if (undefined === index) {
      return;
    }

    this.availableLabels.splice(index, 1);
  }

  /**
   * Upserts a label document in the availableLabels array.
   *
   * @param {Object} labelDoc - The label document to upsert.
   */
  upsertLabel(labelDoc) {
    let i = undefined;
    if (labelDoc._id) {
      i = subElementsHelper.findIndexById(labelDoc._id, this.availableLabels); // try to find it
    } else {
      // brand-new label
      labelDoc._id = Random.id();
    }

    if (i === undefined) {
      // label not in array
      this.availableLabels.unshift(labelDoc);
    } else {
      this.availableLabels[i] = labelDoc; // overwrite in place
    }
  }

  /**
   * Returns the available labels.
   *
   * @returns {Array} The available labels.
   */
  getAvailableLabels() {
    if (this.availableLabels) {
      return this.availableLabels;
    }
    return [];
  }

  /**
   * Adds an additional (free-text) responsible to the meeting series.
   *
   * @param {any} newResponsible - The new responsible to be added.
   * @todo Parameter should be a string? If the new responsible is already
   *   present, it is removed from its current position and moved to the front
   *   of the array, existing double will be removed Needs a "save()" afterwards
   *   to persist @todo incorperate into method? or at least add user
   *   notification?
   */
  addAdditionalResponsible(newResponsible) {
    // remove newResponsible if already present
    const index = this.additionalResponsibles.indexOf(newResponsible);
    if (index !== -1) {
      this.additionalResponsibles.splice(index, 1);
    }

    // put newResponsible to front of array
    this.additionalResponsibles.unshift(newResponsible);
  }

  /**
   * Finds a topic by its ID.
   *
   * @param {string} topicId - The ID of the topic to find.
   * @returns {Object | null} - The found topic object, or null if not found.
   * @todo Refactor to utility? or to topic class?
   */
  findTopic(topicId) {
    return TopicsFinder.getTopicById(topicId, this._id);
  }
}
