import {AttachmentsCollection} from "./collections/attachments_private";
import {Util as _} from "./helpers/utils";
import {Minutes} from "./minutes";
import {UserRoles} from "./userroles";

/**
 * Represents an attachment in the system.
 */
export class Attachment {
  /**
   * Represents an Attachment object.
   *
   * @param {string} attachmentID - The ID of the attachment.
   */
  constructor(attachmentID) {
    this._roles = new UserRoles(this.userId);
    if (!this._roles) {
      console.log("Could not retrieve roles for ", this.userId);
    }
    this._file = AttachmentsCollection.findOne(attachmentID);
    if (!this._file) {
      throw new Error(
          `Attachment(): Could not retrieve attachment for ID ${attachmentID}`,
      );
    }
  }

  /**
   * Finds attachments for a given meeting minutes ID.
   *
   * @param {string} minID - The ID of the meeting minutes.
   * @returns {Mongo.Cursor} - A cursor pointing to the attachments found.
   */
  static findForMinutes(minID) {
    return AttachmentsCollection.find({"meta.meetingminutes_id" : minID});
  }

  /**
   * Returns the total count of all attachments in the collection.
   *
   * @returns {number} The count of attachments.
   */
  static countAll() { return AttachmentsCollection.find().count(); }

  /**
   * Returns the count of attachments associated with a given minute ID.
   *
   * @param {string} minID - The ID of the minute.
   * @returns {number} The count of attachments.
   */
  static countForMinutes(minID) {
    return Attachment.findForMinutes(minID).count();
  }

  /**
   * Calculates the total size of all attachments in the collection.
   * @returns {number} The total size of all attachments in bytes.
   */
  static countAllBytes() {
    const atts = AttachmentsCollection.find({}, {size : 1});
    let sumBytes = 0;
    atts.forEach((att) => { sumBytes += att.size; });
    return sumBytes;
  }

  /**
   * Uploads a file to the AttachmentsCollection.
   *
   * @param {string} uploadFilename - The name of the file to be uploaded.
   * @param {object} minutesObj - The minutes object to which the file is
   *     associated.
   * @param {object} callbacks - Optional callbacks for different upload events.
   * @param {function} callbacks.onStart - Callback function to be called when
   *     the upload starts.
   * @param {function} callbacks.onEnd - Callback function to be called when the
   *     upload ends.
   * @param {function} callbacks.onAbort - Callback function to be called when
   *     the upload is aborted.
   */
  static uploadFile(uploadFilename, minutesObj, callbacks = {}) {
    const doNothing = () => {};
    callbacks = _.assignIn(
        {
          onStart : doNothing,
          onEnd : doNothing,
          onAbort : doNothing,
        },
        callbacks,
    );

    const upload = AttachmentsCollection.insert(
        {
          file : uploadFilename,
          streams : "dynamic",
          chunkSize : "dynamic",
          meta : {
            meetingminutes_id : minutesObj._id,
            parentseries_id : minutesObj.parentMeetingSeriesID(),
          },
        },
        false,
    );

    upload.on("start", function() {
      callbacks.onStart(this); // this == current upload object
    });
    upload.on("end", (error, fileObj) => { callbacks.onEnd(error, fileObj); });
    upload.on("abort",
              (error, fileObj) => { callbacks.onAbort(error, fileObj); });

    upload.start();
  }

  /**
   * Checks if the current user is the uploader and the owner of the file.
   * @returns {boolean} Returns true if the current user is the uploader and the
   *     owner of the file, otherwise returns false.
   */
  isUploaderAndFileOwner() {
    return (this._roles.isUploaderFor(this._file.meta.parentseries_id) &&
            this._roles.getUserID() === this._file.userId);
  }

  /**
   * Checks if the current user is a moderator.
   * @returns {boolean} Returns true if the current user is a moderator,
   *     otherwise false.
   */
  isModerator() {
    return this._roles.isModeratorOf(this._file.meta.parentseries_id);
  }

  /**
   * Checks if:
   * - meeting is not finalized and
   * - user is either (moderator) or (uploader & file owner)
   * @returns {boolean}
   */
  mayRemove() {
    const min = new Minutes(this._file.meta.meetingminutes_id);
    if (min.isFinalized) {
      return false;
    }
    return this.isUploaderAndFileOwner() || this.isModerator();
  }
}
