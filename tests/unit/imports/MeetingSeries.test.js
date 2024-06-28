import { expect } from "chai";
import _ from "lodash";
import proxyquire from "proxyquire";
import sinon from "sinon";

import * as DateHelpers from "../../../imports/helpers/date";
import * as SubElements from "../../../imports/helpers/subElements";

const MeetingSeriesSchema = {};
const Meteor = {
  call: sinon.stub(),
  callAsync: sinon.stub(),
};
const Minutes = {};
const Topic = {};
const UserRoles = {};
const MinutesFinder = {
  result: undefined,
  lastMinutesOfMeetingSeries() {
    return this.result;
  },
};
DateHelpers["@noCallThru"] = true;
SubElements["@noCallThru"] = true;

const Random = {
  id: () => {},
};
const jQuery = {};
const TopicsFinder = {};

const { MeetingSeries } = proxyquire("../../../imports/meetingseries", {
  "meteor/meteor": { Meteor, "@noCallThru": true },
  "meteor/random": { Random, "@noCallThru": true },
  "meteor/jquery": { jQuery, "@noCallThru": true },
  "./collections/meetingseries.schema": {
    MeetingSeriesSchema,
    "@noCallThru": true,
  },
  "./collections/meetingseries_private": {
    MeetingSeriesSchema,
    "@noCallThru": true,
  },
  "./minutes": { Minutes, "@noCallThru": true },
  "./topic": { Topic, "@noCallThru": true },
  "./userroles": { UserRoles, "@noCallThru": true },
  "./helpers/date": DateHelpers,
  "./helpers/subElements": SubElements,
  lodash: { _, "@noCallThru": true },
  "./services/topicsFinder": { TopicsFinder, "@noCallThru": true },
  "./services/minutesFinder": { MinutesFinder, "@noCallThru": true },
});
// skipcq: JS-0241
describe("MeetingSeries", function () {
  // skipcq: JS-0241
  describe("#constructor", function () {
    let meetingSeries;
    // skipcq: JS-0241
    beforeEach(function () {
      meetingSeries = {
        project: "foo",
        name: "bar",
      };
    });
    // skipcq: JS-0241
    it("sets the project correctly", function () {
      const ms = new MeetingSeries(meetingSeries);

      expect(ms.project).to.equal(meetingSeries.project);
    });
    // skipcq: JS-0241
    it("sets the name correctly", function () {
      const ms = new MeetingSeries(meetingSeries);

      expect(ms.name).to.equal(meetingSeries.name);
    });
  });
  // skipcq: JS-0241
  describe("#getMinimumAllowedDateForMinutes", function () {
    let series;

    // skipcq: JS-0241
    beforeEach(function () {
      series = new MeetingSeries();
    });
    // skipcq: JS-0241
    afterEach(function () {
      if (Object.prototype.hasOwnProperty.call(Minutes, "findAllIn")) {
        delete Minutes.findAllIn;
      }
    });

    function compareDates(actualDate, expectedDate) {
      expect(actualDate.getYear(), "year mismatch").to.be.equal(
        expectedDate.getYear(),
      );
      expect(actualDate.getMonth(), "month mismatch").to.be.equal(
        expectedDate.getMonth(),
      );
      expect(actualDate.getDay(), "day mismatch").to.be.equal(
        expectedDate.getDay(),
      );
    }
    // skipcq: JS-0241
    it("retrieves the date of the lastMinutes() if no id is given", function () {
      const expectedDate = new Date();

      MinutesFinder.result = { date: expectedDate };

      const actualDate = series.getMinimumAllowedDateForMinutes();

      compareDates(actualDate, expectedDate);
    });
    // skipcq: JS-0241
    it("gets the date from the second to last minute if id of last minute is given", function () {
      const lastMinuteId = "lastMinuteId";
      const expectedDate = new Date();

      Minutes.findAllIn = sinon.stub().returns([
        {
          _id: "someid",
          date: expectedDate,
        },
        {
          _id: lastMinuteId,
          date: new Date(2013, 12, 11, 0, 0),
        },
      ]);

      const actualDate = series.getMinimumAllowedDateForMinutes(lastMinuteId);

      compareDates(actualDate, expectedDate);
    });
    // skipcq: JS-0241
    it("gets the date from the last minute if id of second to last minute is given", function () {
      const secondToLastMinuteId = "minuteId";
      const expectedDate = new Date();

      Minutes.findAllIn = sinon.stub().returns([
        {
          _id: secondToLastMinuteId,
          date: new Date(2013, 12, 11, 0, 0),
        },
        {
          _id: "last minute",
          date: expectedDate,
        },
      ]);

      const actualDate =
        series.getMinimumAllowedDateForMinutes(secondToLastMinuteId);

      compareDates(actualDate, expectedDate);
    });
  });
  // skipcq: JS-0241
  describe("#save", function () {
    let meetingSeries;
    // skipcq: JS-0241
    beforeEach(function () {
      meetingSeries = new MeetingSeries({
        project: "foo",
        name: "bar",
      });
    });
    // skipcq: JS-0241
    it("calls the meteor method meetingseries.insert", function () {
      meetingSeries.save();

      expect(Meteor.callAsync.calledOnce).to.be.true;
    });
    // skipcq: JS-0241
    it("sends the document to the meteor method meetingseries.insert", function () {
      meetingSeries.save();

      expect(Meteor.callAsync.calledWith("meetingseries.insert", meetingSeries))
        .to.be.true;
    });
  });
});
