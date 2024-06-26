import { expect } from "chai";
import _ from "lodash";
import proxyquire from "proxyquire";
import sinon from "sinon";

import * as DateHelpers from "../../../../../imports/helpers/date";

const MinutesSchema = {
  update: sinon.stub(),
  findOne: sinon.stub(),
};

const MeetingSeriesSchema = {
  update: sinon.stub(),
  findOne: sinon.stub(),
};

const Minutes = sinon.stub();
// let Minutes = {
//     save: sinon.stub(),
// };

const Topics = sinon.stub();
const check = sinon.stub();
const UserRoles = sinon.stub();
const FinalizeMailHandler = sinon.stub();
const MeteorError = (err, details) => {
  const e = new Error(err);
  e.details = details;
  return e;
};
const MeteorMethods = {};

const Meteor = {
  userId: sinon.stub(),
  user: sinon.stub(),
  defer: sinon.stub().callsArg(0),
  methods: (m) => Object.assign(MeteorMethods, m),
  isClient: true,
  call: sinon.stub().resolves(true),
  Error: MeteorError,
  settings: { public: { docGeneration: { enabled: true } } },
};

DateHelpers["@noCallThru"] = true;

const GlobalSettings = {
  isEMailDeliveryEnabled: sinon.stub().returns(false),
  getDefaultEmailSenderAddress: sinon.stub().returns("noreply@example.com"),
};

const MinutesFinder = {
  lastMinutesOfMeetingSeries: sinon.stub(),
  secondLastMinutesOfMeetingSeries: sinon.stub(),
};

const TopicsFinalizer = {
  mergeTopicsForFinalize: sinon.stub(),
  mergeTopicsForUnfinalize: sinon.stub(),
};

const DocumentGeneration = {
  saveProtocol: sinon.stub(),
  removeProtocol: sinon.stub(),
};

const User = {
  profileNameWithFallback: sinon.stub(),
};

const i18n = {
  setLocale: sinon.stub(),
  getLocale: sinon.stub(),
};

const { Finalizer } = proxyquire(
  "../../../../../imports/services/finalize-minutes/finalizer",
  {
    "meteor/meteor": { Meteor, "@noCallThru": true },
    "meteor/universe:i18n": { i18n, "@noCallThru": true },
    lodash: { _, "@noCallThru": true },
    "meteor/check": { check, "@noCallThru": true },
    "/imports/collections/minutes.schema": {
      MinutesSchema,
      "@noCallThru": true,
    },
    "/imports/collections/meetingseries.schema": {
      MeetingSeriesSchema,
      "@noCallThru": true,
    },
    "/imports/minutes": { Minutes, "@noCallThru": true },
    "/imports/topic": { Topics, "@noCallThru": true },
    "/imports/userroles": { UserRoles, "@noCallThru": true },
    "/imports/user": { User, "@noCallThru": true },
    "/imports/mail/FinalizeMailHandler": {
      FinalizeMailHandler,
      "@noCallThru": true,
    },
    "/imports/config/GlobalSettings": { GlobalSettings, "@noCallThru": true },
    "/imports/helpers/date": DateHelpers,
    "/imports/services/minutesFinder": { MinutesFinder, "@noCallThru": true },
    "./topicsFinalizer": { TopicsFinalizer, "@noCallThru": true },
    "/imports/documentGeneration": { DocumentGeneration, "@noCallThru": true },
  },
);

function verifyPropertyOfMinutesUpdate(minutes, property, value) {
  sinon.assert.calledWith(
    // stub to check
    MinutesSchema.update,
    // first parameter should equal the minutes id
    sinon.match(minutes._id),
    // second parameter should be an object of the form
    // {
    //   $set: {
    //     property: value
    //   }
    // }
    sinon.match.has("$set", sinon.match.has(property, value)),
  );
}

// skipcq: JS-0241
describe("workflow.finalizeMinute", function () {
  const finalizeMeteorMethod = MeteorMethods["workflow.finalizeMinute"];
  const fakeMeetingSeries = {
    openTopics: [],
    topics: [],
    updateLastMinutesFieldsAsync: sinon.stub(),
  };
  const user = { username: "me" };
  let minutes;
  let secondToLastMinutes;
  // skipcq: JS-0241
  beforeEach(function () {
    minutes = {
      meetingSeries_id: "AaBbCc01",
      _id: "AaBbCc02",
      date: "2016-05-06",
      createdAt: new Date(),
      topics: [],
      isFinalized: false,
      parentMeetingSeriesID: sinon.stub().returns(12),
      parentMeetingSeries: sinon.stub().returns(fakeMeetingSeries),
      save: sinon.stub(),
    };
    Minutes.returns(minutes);

    secondToLastMinutes = {
      meetingSeries_id: "AaBbCc01",
      _id: "AaBbCc02",
      date: "2016-05-06",
      topics: [],
    };
    MinutesFinder.lastMinutesOfMeetingSeries.returns(minutes);

    const userRoles = { isModeratorOf: sinon.stub().returns(true) };
    UserRoles.returns(userRoles);

    Meteor.userId.returns("12");

    Meteor.user.returns(user);
  });
  // skipcq: JS-0241
  afterEach(function () {
    Meteor.isClient = true;

    Minutes.resetHistory();
    MinutesFinder.lastMinutesOfMeetingSeries.resetHistory();
    MinutesSchema.update.resetHistory();
    UserRoles.resetHistory();
    Meteor.userId.resetHistory();
    Meteor.user.resetHistory();
  });
  // skipcq: JS-0241
  it("throws an exception if the user is not logged in", function () {
    Meteor.userId.resetHistory();
    Meteor.userId.returns();

    try {
      finalizeMeteorMethod(minutes._id);
    } catch (e) {
      const expectedErrorMessage = "not-authorized";
      const expectedDetails = "You are not authorized to perform this action.";
      expect(e.message).to.deep.equal(expectedErrorMessage);
      expect(e.details).to.deep.equal(expectedDetails);
    }
  });

  // skipcq: JS-0241
  it("throws an exception if the user is not authorized", function () {
    UserRoles.resetHistory();
    UserRoles.returns({ isModeratorOf: sinon.stub().returns(false) });

    try {
      finalizeMeteorMethod(minutes._id);
    } catch (e) {
      const expectedErrorMessage = "Cannot modify this minutes/series";
      const expectedDetails = "You are not a moderator of the meeting series.";
      expect(e.message).to.deep.equal(expectedErrorMessage);
      expect(e.details).to.deep.equal(expectedDetails);
    }
  });
  // skipcq: JS-0241
  it("throws an exception if the minute is already finalized", function () {
    minutes.isFinalized = true;

    try {
      finalizeMeteorMethod(minutes._id);
    } catch (e) {
      const expectedErrorMessage = "runtime-error";
      const expectedDetails = "The minute is already finalized";
      expect(e.message).to.deep.equal(expectedErrorMessage);
      expect(e.details).to.deep.equal(expectedDetails);
    }
  });
  // skipcq: JS-0241
  it("sets the isFinalized property of the minutes to true", function () {
    finalizeMeteorMethod(minutes._id);
    verifyPropertyOfMinutesUpdate(minutes, "isFinalized", true);
  });
  // skipcq: JS-0241
  it("sets the finalizedBy property to the user that is currently logged in", function () {
    User.profileNameWithFallback.returns(user.username);
    finalizeMeteorMethod(minutes._id);
    verifyPropertyOfMinutesUpdate(minutes, "finalizedBy", user.username);
  });
  // skipcq: JS-0241
  it("sets the finalizedVersion to 1 if it did not exist before", function () {
    finalizeMeteorMethod(minutes._id);

    const expectedVersion = 1;
    verifyPropertyOfMinutesUpdate(minutes, "finalizedVersion", expectedVersion);
  });
  // skipcq: JS-0241
  it("increments the finalizedVersion if it did exist before", function () {
    minutes.finalizedVersion = 21;
    finalizeMeteorMethod(minutes._id);

    const expectedVersion = 22;
    verifyPropertyOfMinutesUpdate(minutes, "finalizedVersion", expectedVersion);
  });
  // skipcq: JS-0241
  it("sends mails if minute update was successfull and method is called on server", function () {
    Meteor.isClient = false;
    MinutesSchema.update.returns(1);
    GlobalSettings.isEMailDeliveryEnabled.returns(true);
    const mailHandlerInstance = { sendMails: sinon.stub() };
    FinalizeMailHandler.returns(mailHandlerInstance);

    finalizeMeteorMethod(minutes._id, false, true);

    FinalizeMailHandler.resetHistory();

    sinon.assert.calledOnce(mailHandlerInstance.sendMails);
    sinon.assert.calledWith(mailHandlerInstance.sendMails, false, true);
  });
});
// skipcq: JS-0241
describe("workflow.unfinalizeMinute", function () {
  const unfinalizeMeteorMethod = MeteorMethods["workflow.unfinalizeMinute"];
  const user = { username: "me" };
  let minutes;
  let secondToLastMinutes;
  let meetingSeries;
  // skipcq: JS-0241
  beforeEach(function () {
    const minutesId = "AaBbCc02";

    meetingSeries = {
      openTopics: [],
      topics: [],
      minutes: [minutesId],
      updateLastMinutesFieldsAsync: sinon.stub(),
    };
    MeetingSeriesSchema.findOne.returns(meetingSeries);

    minutes = {
      meetingSeries_id: "AaBbCc01",
      _id: minutesId,
      date: "2016-05-06",
      createdAt: new Date(),
      topics: [],
      isFinalized: false,
      participants: "",
      agenda: "",
      parentMeetingSeriesID: sinon.stub().returns(12),
      parentMeetingSeries: sinon.stub().returns(meetingSeries),
    };
    Minutes.returns(minutes);
    MinutesSchema.findOne.returns(minutes);

    secondToLastMinutes = {
      meetingSeries_id: "AaBbCc01",
      _id: "AaBbCc02",
      date: "2016-05-06",
      topics: [],
    };
    MinutesFinder.secondLastMinutesOfMeetingSeries.returns(secondToLastMinutes);

    const userRoles = { isModeratorOf: sinon.stub().returns(true) };
    UserRoles.returns(userRoles);

    MinutesFinder.lastMinutesOfMeetingSeries.returns(minutes);
    MinutesFinder.secondLastMinutesOfMeetingSeries.returns(secondToLastMinutes);

    Meteor.userId.returns("12");
    Meteor.user.returns(user);
  });
  // skipcq: JS-0241
  afterEach(function () {
    Meteor.isClient = true;

    Minutes.resetHistory();
    MinutesFinder.lastMinutesOfMeetingSeries.resetHistory();
    MinutesFinder.secondLastMinutesOfMeetingSeries.resetHistory();
    MinutesSchema.update.resetHistory();
    MinutesSchema.findOne.resetHistory();
    MeetingSeriesSchema.findOne.resetHistory();
    UserRoles.resetHistory();
    Meteor.userId.resetHistory();
    Meteor.user.resetHistory();
  });
  // skipcq: JS-0241
  it("sets isFinalized to false", function () {
    unfinalizeMeteorMethod(minutes._id);
    verifyPropertyOfMinutesUpdate(minutes, "isFinalized", false);
  });
  // skipcq: JS-0241
  it("throws an exception if the minutes is not the last one of the series", function () {
    MinutesFinder.lastMinutesOfMeetingSeries.returns({
      _id: "some-other-minutes",
    });

    try {
      unfinalizeMeteorMethod(minutes._id);
    } catch (e) {
      const expectedErrorMessage = "not-allowed";
      const expectedDetails = "This minutes is not allowed to be un-finalized.";
      expect(e.message).to.deep.equal(expectedErrorMessage);
      expect(e.details).to.deep.equal(expectedDetails);
    }
  });
  // skipcq: JS-0241
  it("throws an exception if the user is not logged in", function () {
    Meteor.userId.resetHistory();
    Meteor.userId.returns();

    try {
      unfinalizeMeteorMethod(minutes._id);
    } catch (e) {
      const expectedErrorMessage = "not-authorized";
      const expectedDetails = "You are not authorized to perform this action.";
      expect(e.message).to.deep.equal(expectedErrorMessage);
      expect(e.details).to.deep.equal(expectedDetails);
    }
  });
  // skipcq: JS-0241
  it("throws an exception if the user is not authorized", function () {
    UserRoles.resetHistory();
    UserRoles.returns({ isModeratorOf: sinon.stub().returns(false) });

    try {
      unfinalizeMeteorMethod(minutes._id);
    } catch (e) {
      const expectedErrorMessage = "Cannot modify this minutes/series";
      const expectedDetails = "You are not a moderator of the meeting series.";
      expect(e.message).to.deep.equal(expectedErrorMessage);
      expect(e.details).to.deep.equal(expectedDetails);
    }
  });
  // skipcq: JS-0241
  it("sets the finalizedBy property to the user that is currently logged in", function () {
    unfinalizeMeteorMethod(minutes._id);
    verifyPropertyOfMinutesUpdate(minutes, "finalizedBy", user.username);
  });
});
// skipcq: JS-0241
describe("Finalizer", function () {
  let minutesId = ""; // Initialized with an empty string as a default value
  let minutes;
  // skipcq: JS-0241
  beforeEach(function () {
    minutesId = "AaBbCc02";

    minutes = {};
    Minutes.returns(minutes);
  });
  // skipcq: JS-0241
  afterEach(function () {
    Meteor.call.resetHistory();
    Minutes.resetHistory();
  });
  // skipcq: JS-0241
  describe("#finalize", function () {
    // skipcq: JS-0241
    it("calls the meteor methods workflow.finalizeMinute and documentgeneration.createAndStoreFile", function () {
      Finalizer.finalize();

      expect(Meteor.call.calledTwice).to.be.true;
    });
    // skipcq: JS-0241
    it("sends the id to the meteor method workflow.finalizeMinute", function () {
      Finalizer.finalize(minutesId);

      expect(Meteor.call.calledWith("workflow.finalizeMinute", minutesId)).to.be
        .true;
    });
    // skipcq: JS-0241
    it("sends the id to the meteor method documentgeneration.createAndStoreFile", function () {
      Finalizer.finalize(minutesId);

      expect(
        Meteor.call.calledWith(
          "documentgeneration.createAndStoreFile",
          minutesId,
        ),
      ).to.be.true;
    });
  });
  // skipcq: JS-0241
  describe("#unfinalize", function () {
    // skipcq: JS-0241
    it("calls the meteor methods workflow.unfinalizeMinute and documentgeneration.removeFile", function () {
      Finalizer.unfinalize();

      expect(Meteor.call.calledTwice).to.be.true;
    });
    // skipcq: JS-0241
    it("sends the id to the meteor method workflow.unfinalizeMinute", function () {
      Finalizer.unfinalize(minutesId);

      expect(
        Meteor.call.calledWithExactly("workflow.unfinalizeMinute", minutesId),
      ).to.be.true;
    });
    // skipcq: JS-0241
    it("sends the id to the meteor method documentgeneration.removeFile", function () {
      Finalizer.unfinalize(minutesId);

      expect(
        Meteor.call.calledWithExactly(
          "documentgeneration.removeFile",
          minutesId,
        ),
      ).to.be.true;
    });
  });
  // skipcq: JS-0241
  describe("#finalizedInfo", function () {
    let minutes = {}; // Initialized directly
    // skipcq: JS-0241
    beforeEach(function () {
      minutes = {};
      MinutesSchema.findOne.returns(minutes);
    });
    // skipcq: JS-0241
    afterEach(function () {
      MinutesSchema.findOne.resetHistory();
    });
    // skipcq: JS-0241
    it("returns that the minutes was never finalized if it was never finalized", function () {
      // skipcq: JS-0241
      Object.assign(minutes, { finalizedAt: null });

      const someId = "";
      const result = Finalizer.finalizedInfo(someId);

      const expectedResult = "Never finalized";
      expect(result).to.deep.equal(expectedResult);
    });
    // skipcq: JS-0241
    it("returns that the minutes was unfinalized if it was", function () {
      // skipcq: JS-0241
      Object.assign(minutes, {
        finalizedAt: new Date(2017, 6, 1, 14, 4, 0),
        isFinalized: false,
        finalizedBy: "me",
      });

      const someId = "";
      const result = Finalizer.finalizedInfo(someId);

      const expectedResult = "Unfinalized on 2017-07-01 14:04:00 by me";
      expect(result).to.deep.equal(expectedResult);
    });
    // skipcq: JS-0241
    it("returns that the minutes was finalized if it was", function () {
      // skipcq: JS-0241
      Object.assign(minutes, {
        finalizedAt: new Date(2017, 6, 1, 14, 4, 0),
        isFinalized: true,
        finalizedBy: "me",
      });

      const someId = "";
      const result = Finalizer.finalizedInfo(someId);

      const expectedResult = "Finalized on 2017-07-01 14:04:00 by me";
      expect(result).to.deep.equal(expectedResult);
    });
    // skipcq: JS-0241
    it("states the version if it is available", function () {
      Object.assign(minutes, {
        finalizedAt: new Date(2017, 6, 1, 14, 4, 0),
        isFinalized: true,
        finalizedBy: "me",
        finalizedVersion: 13,
      });

      const someId = "";
      const result = Finalizer.finalizedInfo(someId);

      const expectedResult =
        "Version 13. Finalized on 2017-07-01 14:04:00 by me";
      expect(result).to.deep.equal(expectedResult);
    });
  });
  // skipcq: JS-0241
  describe("#isUnfinalizeMinutesAllowed", function () {
    let meetingSeries = {}; // Initialized directly
    let minutes = {}; // Adjusted initialization
    // skipcq: JS-0241
    beforeEach(function () {
      const minutesId = "some-fance-minutes-id";
      minutes = { _id: minutesId };
      meetingSeries = {};

      MeetingSeriesSchema.findOne.returns(meetingSeries);
      MinutesSchema.findOne.returns(minutes);

      MinutesFinder.lastMinutesOfMeetingSeries.returns({});
    });
    // skipcq: JS-0241
    afterEach(function () {
      MinutesSchema.findOne.resetHistory();
      MeetingSeriesSchema.findOne.resetHistory();
      MinutesFinder.lastMinutesOfMeetingSeries.resetHistory();
    });
    // skipcq: JS-0241
    it("returns true if the given minutes id belongs to the last minutes in the series", function () {
      MinutesFinder.lastMinutesOfMeetingSeries.returns(minutes);
      const result = Finalizer.isUnfinalizeMinutesAllowed(minutes._id);
      expect(result).to.be.true;
    });
    // skipcq: JS-0241
    it("returns false if there is some other minutes that is the last minutes in the series", function () {
      const someOtherMinutes = { _id: "some-other-minutes" };
      MinutesFinder.lastMinutesOfMeetingSeries.returns(someOtherMinutes);

      const result = Finalizer.isUnfinalizeMinutesAllowed(minutes._id);
      expect(result).to.be.false;
    });
  });
});
