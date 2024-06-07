import "./collections/minutes_private";
import "./collections/workflow_private";

import { emailAddressRegExpMatch } from "/imports/helpers/email";
import { subElementsHelper } from "/imports/helpers/subElements";
import { User } from "/imports/user";
import { _ } from "lodash";
import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";
import { i18n } from "meteor/universe:i18n";

import { ActionItem } from "./actionitem";
import { MinutesSchema } from "./collections/minutes.schema";
import { StringUtils } from "./helpers/string-utils";
import { MeetingSeries } from "./meetingseries";
import { Topic } from "./topic";

export class Minutes {
  /**
   * Represents a Minutes object.
   * @constructs Minutes
   * @param {string|object} source - The source of the Minutes object. It can be
   *     either a Mongo ID or a Mongo document.
   * @throws {Meteor.Error} Throws an error if the source is not provided or is
   *     invalid.
   */
  constructor(source) {
    // constructs obj from Mongo ID or Mongo document
    if (!source)
      throw new Meteor.Error(
        "invalid-argument",
        "Mongo ID or Mongo document required",
      );

    if (typeof source === "string") {
      // we may have an ID here.
      source = Minutes.findOne(source);
    }
    if (typeof source === "object") {
      // inject class methods in plain collection document
      _.assignIn(this, source);
    }
  }

  /**
   * Finds documents in the collection.
   * @todo Refactor into utility?
   * @param {...any} args - The arguments to be passed to the find method.
   * @returns {Cursor} - The cursor object representing the result of the find
   *     operation.
   */
  static find(...args) {
    return MinutesSchema.getCollection().find(...args);
  }

  /**
   * Finds a single document in the collection based on the provided arguments.
   * @todo Refactor into utility?
   * @param {...any} args - The arguments to be passed to the findOne method.
   * @returns {Object|null} - The found document, or null if no document matches
   *     the criteria.
   */
  static findOne(...args) {
    return MinutesSchema.getCollection().findOne(...args);
  }

  /**
   * Finds all minutes documents with the given IDs.
   *
   * @param {Array} MinutesIDArray - An array of minutes document IDs.
   * @param {number} limit - The maximum number of documents to return.
   * @param {boolean} [lastMintuesFirst=true] - Determines the sorting order of
   *     the documents.
   *                                             If true, the most recent
   * minutes will be returned first. If false, the oldest minutes will be
   * returned first.
   * @returns {Array} - An array of minutes documents matching the given IDs and
   *     options.
   */
  static findAllIn(MinutesIDArray, limit, lastMintuesFirst = true) {
    if (!MinutesIDArray || MinutesIDArray.length === 0) {
      return [];
    }

    const sort = lastMintuesFirst ? -1 : 1;
    const options = { sort: { date: sort } };
    if (limit) {
      options.limit = limit;
    }
    return Minutes.find({ _id: { $in: MinutesIDArray } }, options);
  }

  /**
   * Removes a minute with the specified ID.
   *
   * @param {string} id - The ID of the minute to remove.
   * @returns {Promise} A promise that resolves when the minute is successfully
   *     removed.
   */
  static remove(id) {
    return Meteor.callAsync("workflow.removeMinute", id);
  }

  /**
   * Synchronizes the visibility of minutes with the given parent series ID and
   * visibleForArray.
   * @param {string} parentSeriesID - The ID of the parent series.
   * @param {Array} visibleForArray - An array of user IDs specifying who can
   *     see the minutes.
   * @returns {Promise} - A promise that resolves when the visibility is
   *     synchronized.
   */
  static async syncVisibility(parentSeriesID, visibleForArray) {
    await Meteor.callAsync(
      "minutes.syncVisibilityAndParticipants",
      parentSeriesID,
      visibleForArray,
    );
  }

  /**
   * Updates the visibleFor and participants fields for all minutes of a meeting
   * series.
   *
   * @param {string} parentSeriesID - The ID of the parent meeting series.
   * @param {Array} visibleForArray - An array of users who have visibility to
   *     the minutes.
   */
  static async updateVisibleForAndParticipantsForAllMinutesOfMeetingSeries(parentSeriesID, visibleForArray) {
    if ((await MinutesSchema.find({ meetingSeries_id: parentSeriesID }).countAsync()) > 0) {
      MinutesSchema.update(
        { meetingSeries_id: parentSeriesID },
        { $set: { visibleFor: visibleForArray } },
        { multi: true },
      );

      // add missing participants to non-finalized meetings
      await MinutesSchema.getCollection()
        .find({ meetingSeries_id: parentSeriesID })
        .forEachAsync((min) => {
          if (!min.isFinalized) {
            const newparticipants = min.generateNewParticipants();
            if (newparticipants) {
              // Write participants to database if they have changed
              MinutesSchema.update(
                { _id: min._id },
                { $set: { participants: newparticipants } },
              );
            }
          }
        });
    }
  }

  // ################### object methods

  /**
   * Updates the document with the provided `docPart`.
   *
   * @param {Object} docPart - The partial document to update.
   * @param {Function} callback - The callback function to be called after the
   *     update is complete.
   * @returns {Promise} A promise that resolves when the update is complete.
   */
  async update(docPart, callback) {
    console.log("Minutes.update()");
    const parentMeetingSeries = this.parentMeetingSeries();

    _.assignIn(docPart, { _id: this._id });
    await Meteor.callAsync("minutes.update", docPart, callback);

    // merge new doc fragment into this document
    _.assignIn(this, docPart);

    if (
      Object.prototype.hasOwnProperty.call(docPart, "date") ||
      Object.prototype.hasOwnProperty.call(docPart, "isFinalized")
    ) {
      return parentMeetingSeries.updateLastMinutesFieldsAsync(this);
    }
  }

  /**
   * Saves the minutes.
   *
   * @param {Function} optimisticUICallback - The callback function for
   *     optimistic UI updates.
   * @param {Function} serverCallback - The callback function for server
   *     updates.
   */
  save(optimisticUICallback, serverCallback) {
    console.log("Minutes.save()");
    if (this.createdAt === undefined) {
      this.createdAt = new Date();
    }
    if (this._id && this._id !== "") {
      Meteor.call("minutes.update", this);
    } else {
      if (this.topics === undefined) {
        this.topics = [];
      }
      Meteor.call(
        "workflow.addMinutes",
        this,
        optimisticUICallback,
        serverCallback,
      );
    }
    this.parentMeetingSeries().updateLastMinutesFields(serverCallback);
  }

  /**
   * Returns a string representation of the Minutes object.
   * @todo refactor to use {@link StringUtils.createToString}
   * @returns {string} The string representation of the Minutes object.
   */
  toString() {
    return `Minutes: ${JSON.stringify(this, null, 4)}`;
  }

  /**
   * Logs the string representation of the object.
   * @todo Refactor into utility function (or remove)
   */
  log() {
    console.log(this.toString());
  }

  /**
   * Get the parent meeting series of the current meeting.
   * @returns {MeetingSeries} The parent meeting series.
   */
  parentMeetingSeries() {
    return new MeetingSeries(this.meetingSeries_id);
  }

  /**
   * Returns the ID of the parent meeting series.
   *
   * @returns {string} The ID of the parent meeting series.
   */
  parentMeetingSeriesID() {
    return this.meetingSeries_id;
  }

  // This also does a minimal update of collection!
  // method
  /**
   * Removes a topic from the list of topics in the minutes.
   * @param {string} id - The ID of the topic to be removed.
   * @returns {Promise<void>} - A promise that resolves when the topic is
   *     successfully removed.
   */
  async removeTopic(id) {
    const i = this._findTopicIndex(id);
    if (i !== undefined) {
      this.topics.splice(i, 1);
      await Meteor.callAsync("minutes.removeTopic", id);
    }
  }

  /**
   * Finds a topic by its ID.
   * @todo Throw error when not found?
   * @param {string} id - The ID of the topic to find.
   * @returns {object|undefined} - The found topic object, or undefined if not
   *     found.
   */
  findTopic(id) {
    const i = this._findTopicIndex(id);
    if (i !== undefined) {
      return this.topics[i];
    }
    return undefined;
  }

  /**
   * Returns all topics which are created
   * within this meeting.
   */
  getNewTopics() {
    return this.topics.filter((topic) => {
      return topic.isNew;
    });
  }

  /**
   * Returns all old topics which were closed
   * within this topic.
   */
  getOldClosedTopics() {
    return this.topics.filter((topic) => {
      return !topic.isNew && !topic.isOpen && !Topic.hasOpenActionItem(topic);
    });
  }

  /**
   * Checks whether this minute has at least one
   * open Action Item.
   *
   * @returns {boolean}
   */
  hasOpenActionItems() {
    for (let i = this.topics.length; i-- > 0; ) {
      const topic = new Topic(this, this.topics[i]);
      if (topic.hasOpenActionItem()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns an array of topics that are open and have no info items.
   *
   * @returns {Array} An array of topic documents.
   */
  getOpenTopicsWithoutItems() {
    return this.topics
      .filter((topicDoc) => {
        return topicDoc.isOpen;
      })
      .map((topicDoc) => {
        topicDoc.infoItems = [];
        return topicDoc;
      });
  }

  /**
   * Upserts a topic document into the minutes.
   *
   * @param {Object} topicDoc - The topic document to upsert.
   * @param {boolean} [insertPlacementTop=true] - Determines whether to insert
   *     the topic at the top or bottom of the topics array.
   * @returns {Promise} A promise that resolves with the result of the upsert
   *     operation.
   */
  async upsertTopic(topicDoc, insertPlacementTop = true) {
    let i = undefined;

    if (topicDoc._id) {
      i = this._findTopicIndex(topicDoc._id); // try to find it
    } else {
      // brand-new topic
      topicDoc._id = Random.id(); // create our own local _id here!
    }

    if (i === undefined) {
      // topic not in array
      await Meteor.callAsync(
        "minutes.addTopic",
        this._id,
        topicDoc,
        insertPlacementTop,
      );
    } else {
      this.topics[i] = topicDoc; // overwrite in place
      await Meteor.callAsync("minutes.updateTopic", topicDoc._id, topicDoc);
    }
  }

  /**
   * Retrieves the open action items from the topics.
   *
   * @param {boolean} includeSkippedTopics - Flag indicating whether to include
   *     skipped topics.
   * @returns {Array<ActionItem>} - An array of open action items.
   */
  getOpenActionItems(includeSkippedTopics = true) {
    const nonSkippedTopics = includeSkippedTopics
      ? this.topics
      : this.topics.filter((topic) => !topic.isSkipped);

    return nonSkippedTopics.reduce(
      (acc, topicDoc) => {
        const topic = new Topic(this, topicDoc);
        const actionItemDocs = topic.getOpenActionItems();
        return acc.concat(
          actionItemDocs.map((doc) => {
            return new ActionItem(topic, doc);
          }),
        );
      },
      /* initial value */ [],
    );
  }

  /**
   * Sends the agenda for the minutes.
   * @returns {Promise} A promise that resolves when the agenda is sent.
   */
  sendAgenda() {
    return Meteor.callAsync("minutes.sendAgenda", this._id);
  }

  /**
   * Retrieves the timestamp when the agenda was sent.
   * @returns {boolean|Date} The timestamp when the agenda was sent, or false if
   *     it was not sent.
   */
  getAgendaSentAt() {
    if (!this.agendaSentAt) {
      return false;
    }
    return this.agendaSentAt;
  }

  /**
   * Checks if the current user is a moderator.
   * @returns {boolean} True if the current user is a moderator, false
   *     otherwise.
   */
  isCurrentUserModerator() {
    return this.parentMeetingSeries().isCurrentUserModerator();
  }

  /**
   * Gets all persons who want to be
   * informed about this minute:
   * (visibleFor + informedUsers)
   *
   * @returns {string[]} of user ids
   */
  getPersonsInformed() {
    const informed = this.visibleFor;
    if (this.informedUsers) {
      return informed.concat(this.informedUsers);
    }
    return informed;
  }

  /**
   * Returns all informed persons with name and
   * email address.
   * Skips all persons with no email address.
   *
   * @param userCollection
   * @returns {Array}
   */
  getPersonsInformedWithEmail(userCollection) {
    const recipientResult = this.getPersonsInformed().reduce(
      (recipients, userId) => {
        const user = userCollection.findOne(userId);
        if (user.emails && user.emails.length > 0) {
          recipients.push({
            userId,
            name: user.username,
            address: user.emails[0].address,
          });
        }
        return recipients;
      },
      /* initial value */ [],
    );

    // search for mail addresses in additional participants and add them to
    // recipients
    if (this.participantsAdditional) {
      const addMails = this.participantsAdditional.match(
        emailAddressRegExpMatch,
      );
      if (addMails) {
        // addMails is null if there is no substring matching the email regular
        // expression
        addMails.forEach((additionalMail) => {
          recipientResult.push({
            userId: "additionalRecipient",
            name: additionalMail,
            address: additionalMail,
          });
        });
      }
    }

    return recipientResult;
  }

  /**
   * Sync all users of .visibleFor into .participants
   * This method adds and removes users from the .participants list.
   * But it does not change attributes (e.g. .present) of untouched users
   * It will not write the new Participants into the database.
   * Instead it returns an array containing the new participants. If the
   * participants have not changed it will return "undefined" Throws an
   * exception if this minutes are finalized
   *
   * @returns {Array}
   */
  generateNewParticipants() {
    if (this.isFinalized) {
      throw new Error(
        "generateNewParticipants () must not be called on finalized minutes",
      );
    }
    let changed = false;

    const participantDict = {};
    if (this.participants) {
      this.participants.forEach((participant) => {
        participantDict[participant.userId] = participant;
      });
    }

    const newParticipants = this.visibleFor.map((userId) => {
      if (participantDict[userId]) {
        // Participant stays without changes
        const participant = participantDict[userId];
        delete participantDict[userId];
        return participant;
      } else {
        // Participant has been added, insert with default values
        changed = true;
        return {
          userId,
          present: false,
          minuteKeeper: false,
        };
      }
    });
    this.participants = newParticipants;

    // Now the participantsDict contains only the participants that have been
    // removed. If there are any the database has to be updated
    changed = changed || Object.keys(participantDict).length > 0;

    // only return new paricipants if they have changed
    return changed ? newParticipants : undefined;
  }

  /**
   * Change presence of a single participant. Immediately updates .participants
   * array
   * @todo Reactive performance may be better if we only update one array
   * element in DB
   * @param userid of the participant in the participant array
   * @param isPresent new state of presence
   */
  async updateParticipantPresent(userid, isPresent) {
    let index = -1;
    if (this.participants) {
      for (let i = 0; i < this.participants.length; i++) {
        if (this.participants[i].userId === userid) {
          index = i;
          break;
        }
      }
      if (index > -1) {
        this.participants[index].present = isPresent;
        await this.update({ participants: this.participants });
      }
    }
    return false;
  }

  /**
   * Returns the list of participants and adds the name of
   * each participants if a userCollection is given.
   * @param userCollection to query for the participants name.
   * @returns {Array}
   */
  getParticipants(userCollection) {
    if (userCollection) {
      return this.participants.map((participant) => {
        const user = userCollection.findOne(participant.userId);
        if (user) {
          participant.name = user.username;
          participant.profile = user.profile;
        } else {
          participant.name = `Unknown ${participant.userId}`;
        }
        return participant;
      });
    }

    return this.participants;
  }
  /**
   * Change presence of a all participants in a Minute
   * @param isPresent new state of presence
   */
  async changeParticipantsStatus(isPresent) {
    this.participants.forEach((p) => (p.present = isPresent));
    await this.update({ participants: this.participants });
  }

  /**
   * Returns the list of informed users and adds the name of
   * each informed if a userCollection is given.
   * @param userCollection to query for the participants name.
   * @returns {Array}
   */
  getInformed(userCollection) {
    if (this.informedUsers) {
      return userCollection
        ? this.informedUsers.map((informed) => {
            const user = userCollection.findOne(informed);
            informed = {
              id: informed,
              name: user ? user.username : `Unknown ${informed}`,
              profile: user ? user.profile : null,
            };
            return informed;
          })
        : this.informedUsers;
    }

    return [];
  }

  /**
   * Returns a human readable list of present participants of the meeting
   * @param maxChars truncate and add ellipsis if necessary
   * @returns {String} with comma separated list of names
   */
  async getPresentParticipantNames(maxChars) {
    // todo: does this member have to be updated?
    this.participants = this.participants || [];
    const additionalParticipants = this.participantsAdditional || [];

    const presentParticipantIds = this.participants
      .filter((p) => p.present)
      .map((p) => p.userId);

    const presentParticipants = Meteor.users.find({
      _id: { $in: presentParticipantIds },
    });

    const names = (await presentParticipants
      .mapAsync((p) => {
        const user = new User(p);
        return user.profileNameWithFallback();
      }))
      .concat(additionalParticipants)
      .join("; ");

    if (maxChars && names.length > maxChars) {
      return `${names.substring(0, maxChars)}...`;
    }

    return names || i18n.__("Minutes.Participants.none");
  }

  /**
   * Checks if the current minute has a valid parent meeting series.
   * @throws {Meteor.Error} If the minute is an orphan.
   */
  checkParent() {
    const parent = this.parentMeetingSeries();
    if (!parent.hasMinute(this._id)) {
      throw new Meteor.Error("runtime-error", "Minute is an orphan!");
    }
  }

  // ################### private methods

  /**
   * Finds the index of a topic with the given id in the topics array.
   *
   * @param {string} id - The id of the topic to find.
   * @returns {number} - The index of the topic in the topics array, or -1 if
   *     not found.
   * @private
   */
  _findTopicIndex(id) {
    return subElementsHelper.findIndexById(id, this.topics);
  }

  /**
   * Formats the responsibles object by adding the fullname property.
   * If the profile is available, it appends the profile name to the username.
   * @param {Object} responsible - The responsibles object to be formatted.
   * @param {string} usernameField - The field name for the username.
   * @param {any} isProfileAvaliable - Indicates if the profile is available.
   * @returns {Object} - The formatted responsibles object.
   * @private
   */
  static formatResponsibles(responsible, usernameField, isProfileAvaliable) {
    responsible.fullname =
      isProfileAvaliable && responsible.profile && responsible.profile.name
        ? `${responsible[usernameField]} - ${responsible.profile.name}`
        : responsible[usernameField];
    return responsible;
  }
}
