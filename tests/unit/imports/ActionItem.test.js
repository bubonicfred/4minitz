import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";

import * as Helpers from "../../../imports/helpers/date";

const doNothing = () => {};

const Topic = {};
const Label = {};

const MeteorError = {};

const Meteor = {
  call: sinon.stub(),
  Error: MeteorError,
  user: () => {
    return { username: "unit-test" };
  },
};

Helpers["@noCallThru"] = true;

const Random = {
  id: () => {},
};

const i18n = {
  setLocale: sinon.stub(),
  getLocale: sinon.stub(),
  __: sinon.stub(),
};

const { Priority } = proxyquire("../../../imports/priority", {
  "meteor/universe:i18n": { i18n, "@noCallThru": true },
});

const { InfoItem } = proxyquire("../../../imports/infoitem", {
  "meteor/meteor": { Meteor, "@noCallThru": true },
  "meteor/random": { Random, "@noCallThru": true },
  "./user.js": { null: null, "@noCallThru": true },
  "./helpers/date.js": Helpers,
  "./topic": { Topic, "@noCallThru": true },
  "./label": { Label, "@noCallThru": true },
});

const { ActionItem } = proxyquire("../../../imports/actionitem", {
  "meteor/meteor": { Meteor, "@noCallThru": true },
  "./priority": { Priority, "@noCallThru": true },
  "./infoitem": { InfoItem, "@noCallThru": true },
});
// skipcq: JS-0241
describe("ActionItem", function () {
  let dummyTopic, infoItemDoc;
  // skipcq: JS-0241
  beforeEach(function () {
    dummyTopic = {
      _id: "AaBbCcDd",
      save: doNothing,
      findInfoItem: doNothing,
    };

    infoItemDoc = {
      _id: "AaBbCcDd01",
      createdInMinute: "AaBbCcDd01",
      subject: "infoItemDoc",
      createdAt: new Date(),
      details: [
        {
          date: "2016-05-06",
          text: "details Text",
        },
      ],
    };
  });
  // skipcq: JS-0241
  describe("#constructor", function () {
    // skipcq: JS-0241
    it("sets the reference to the parent topic correctly", function () {
      const myActionItem = new ActionItem(dummyTopic, infoItemDoc);

      // the infoItem should have a reference of our dummyTopic
      expect(myActionItem._parentTopic).to.equal(dummyTopic);
    });
    // skipcq: JS-0241
    it("sets the document correctly", function () {
      const myActionItem = new ActionItem(dummyTopic, infoItemDoc);
      // the doc should be equal to our initial document
      expect(myActionItem._infoItemDoc).to.deep.equal(infoItemDoc);
    });
    // skipcq: JS-0241
    it("sets the initial value for the isOpen-flag correctly", function () {
      const myActionItem = new ActionItem(dummyTopic, infoItemDoc);
      // the isOpen-filed should be initially true for a new actionItem
      expect(myActionItem._infoItemDoc.isOpen).to.be.true;
    });
    // skipcq: JS-0241
    it("sets the initial value for the isNew-flag correctly", function () {
      const myActionItem = new ActionItem(dummyTopic, infoItemDoc);
      // the isOpen-filed should be initially true for a new actionItem
      expect(myActionItem._infoItemDoc.isNew).to.be.true;
    });
  });
  // skipcq: JS-0241
  it("#getDateFromDetails", function () {
    const myActionItem = new ActionItem(dummyTopic, infoItemDoc);

    expect(myActionItem.getDateFromDetails()).to.equal(
      infoItemDoc.details[0].date,
    );
  });
  // skipcq: JS-0241
  it("#getTextFromDetails", function () {
    const myActionItem = new ActionItem(dummyTopic, infoItemDoc);

    expect(myActionItem.getTextFromDetails()).to.equal(
      infoItemDoc.details[0].text,
    );
  });
  // skipcq: JS-0241
  it("#toggleState", function () {
    const myActionItem = new ActionItem(dummyTopic, infoItemDoc);

    const oldState = myActionItem._infoItemDoc.isOpen;

    myActionItem.toggleState();

    // state should have changed
    expect(myActionItem._infoItemDoc.isOpen).to.not.equal(oldState);
  });
});
