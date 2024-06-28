import {expect} from "chai";
import {_} from "lodash";
import proxyquire from "proxyquire";
import sinon from "sinon";

import * as DateHelpers from "../../../imports/helpers/date";
import * as SubElements from "../../../imports/helpers/subElements";

class MeteorError {}
const Meteor = {
  call : sinon.stub(),
  Error : MeteorError,
  callAsync : sinon.stub(),
  user : () => { return {username : "unit-test"}; },
};

const meetingSeriesId = "AaBbCcDd01";
class MeetingSeries {
  constructor(id) { this._id = id; }
  static findOne(id) {
    if (id === meetingSeriesId) {
      return dummySeries;
    }
    return undefined;
  }
}
const i18n = {
  setLocale : sinon.stub(),
  getLocale : sinon.stub(),
  __ : sinon.stub(),
};
const minuteId = "AaBbCcDd02";
class Minutes {
  constructor(id) { this._id = id; }
  upsertTopic() {}
  static findOne(id) {
    if (id === minuteId) {
      return dummyMinute;
    }
    return undefined;
  }
}

const dummyMinute = new Minutes(minuteId);
const dummySeries = new MeetingSeries(meetingSeriesId);

const Random = {
  i : 1,
  id() { return this.i++; },
};

SubElements["@noCallThru"] = true;
DateHelpers["@noCallThru"] = true;
const {Priority} = proxyquire("../../../imports/priority", {
  "meteor/universe:i18n" : {i18n, "@noCallThru" : true},
});
const {Label} = proxyquire("../../../imports/label", {
  "meteor/meteor" : {Meteor, "@noCallThru" : true},
  "./meetingseries" : {MeetingSeries, "@noCallThru" : true},
});

const {InfoItem} = proxyquire("../../../imports/infoitem", {
  "meteor/meteor" : {Meteor, "@noCallThru" : true},
  "meteor/random" : {Random, "@noCallThru" : true},
  lodash : {_, "@noCallThru" : true},
  "./user" : {null : null, "@noCallThru" : true},
  "./helpers/date" : DateHelpers,
  "./label" : {Label, "@noCallThru" : true},
});

const {ActionItem} = proxyquire("../../../imports/actionitem", {
  "meteor/meteor" : {Meteor, "@noCallThru" : true},
  "./priority" : {Priority, "@noCallThru" : true},
  "./infoitem" : {InfoItem, "@noCallThru" : true},
});

const {InfoItemFactory} = proxyquire("../../../imports/InfoItemFactory", {
  "./infoitem" : {InfoItem, "@noCallThru" : true},
  "./actionitem" : {ActionItem, "@noCallThru" : true},
});

const {Topic} = proxyquire("../../../imports/topic", {
  "meteor/meteor" : {Meteor, "@noCallThru" : true},
  "meteor/random" : {Random, "@noCallThru" : true},
  "/imports/helpers/subElements" : SubElements,
  "./label" : {Label, "@noCallThru" : true},
  lodash : {_, "@noCallThru" : true},
  "./infoitem" : {InfoItem, "@noCallThru" : true},
  "./InfoItemFactory" : {InfoItemFactory, "@noCallThru" : true},
  "./minutes" : {Minutes, "@noCallThru" : true},
  "./meetingseries" : {MeetingSeries, "@noCallThru" : true},

  "./collections/minutes_private" : {null : null, "@noCallThru" : true},
});
// skipcq: JS-0241
describe("Topic", function() {
  let topicDoc;
  // skipcq: JS-0241
  beforeEach(function() {
    topicDoc = {
      subject : "topic-subject",
      infoItems : [],
    };
  });
  // skipcq: JS-0241
  describe("#constructor", function() {
    // skipcq: JS-0241
    it("sets the reference to the parent minute correctly", function() {
      const myTopic = new Topic(dummyMinute._id, topicDoc);
      expect(myTopic._parentMinutes).to.equal(dummyMinute);
    });
    // skipcq: JS-0241
    it("can instantiate a topic with the parent minutes object instead of its id",
       function() {
         const myTopic = new Topic(dummyMinute, topicDoc);
         expect(myTopic._parentMinutes).to.equal(dummyMinute);
       });
    // skipcq: JS-0241
    it("sets the subject correctly", function() {
      const myTopic = new Topic(dummyMinute._id, topicDoc);
      expect(myTopic._topicDoc.subject).to.equal(topicDoc.subject);
    });
    // skipcq: JS-0241
    it("sets the initial value of the isOpen-flag correctly", function() {
      const myTopic = new Topic(dummyMinute._id, topicDoc);
      expect(myTopic._topicDoc.isOpen).to.be.true;
    });
    // skipcq: JS-0241
    it("sets the initial value of the isNew-flag correctly", function() {
      const myTopic = new Topic(dummyMinute._id, topicDoc);
      expect(myTopic._topicDoc.isNew).to.be.true;
    });
    // skipcq: JS-0241
    it("enforces infoItems to be of type Array", function() {
      topicDoc.infoItems = "something";
      const myTopic = new Topic(dummyMinute._id, topicDoc);

      expect(myTopic._topicDoc.infoItems).to.be.an("array");
    });
  });
  // skipcq: JS-0241
  it("#findTopicIndexInArray", function() {
    const topicArray = [ topicDoc ];
    const index = Topic.findTopicIndexInArray(topicDoc._id, topicArray);
    expect(index).to.equal(0);
  });
  // skipcq: JS-0241
  describe("#hasOpenActionItem", function() {
    // skipcq: JS-0241
    it("returns false if the topic does not have any sub items",
       function() { expect(Topic.hasOpenActionItem(topicDoc)).to.be.false; });
    // skipcq: JS-0241
    it("returns true if the topic has at least one open action items",
       function() {
         topicDoc.infoItems.push({
           itemType : "actionItem",
           isOpen : false,
         });
         topicDoc.infoItems.push({
           itemType : "actionItem",
           isOpen : true,
         });

         expect(Topic.hasOpenActionItem(topicDoc)).to.be.true;
       });
    // skipcq: JS-0241
    it("returns false if the topic has only closed action items", function() {
      topicDoc.infoItems.push({
        itemType : "actionItem",
        isOpen : false,
      });
      topicDoc.infoItems.push({
        itemType : "actionItem",
        isOpen : false,
      });

      expect(Topic.hasOpenActionItem(topicDoc)).to.be.false;
    });
    // skipcq: JS-0241
    it("returns false if the topic has only info items (whose open state is unimportant)",
       function() {
         topicDoc.infoItems.push({
           itemType : "infoItem",
           isOpen : false,
         });
         topicDoc.infoItems.push({
           itemType : "infoItem",
           isOpen : true,
         });
         topicDoc.infoItems.push({
           itemType : "infoItem",
           // isOpen: keep it "undefined"!!!
         });
         expect(Topic.hasOpenActionItem(topicDoc)).to.be.false;
       });
    // skipcq: JS-0241
    it("returns true if the topic has a open action item (object method call)",
       function() {
         topicDoc.infoItems.push({
           itemType : "actionItem",
           isOpen : true,
         });
         const myTopic = new Topic(dummyMinute._id, topicDoc);
         expect(myTopic.hasOpenActionItem()).to.be.true;
       });
  });
  // skipcq: JS-0241
  describe("#invalidateIsNewFlag", function() {
    let myTopic;
    // skipcq: JS-0241
    beforeEach(function() {
      topicDoc.isNew = true;
      topicDoc.infoItems.push({
        isOpen : true,
        isNew : true,
        itemType : "actionItem",
        createdInMinute : dummyMinute._id,
      });
      myTopic = new Topic(dummyMinute._id, topicDoc);
    });
    // skipcq: JS-0241
    it("clears the isNew-Flag of the topic itself", function() {
      myTopic.invalidateIsNewFlag();
      expect(topicDoc.isNew).to.be.false;
    });
    // skipcq: JS-0241
    it("clears the isNew-Flag of the action item", function() {
      myTopic.invalidateIsNewFlag();
      expect(topicDoc.infoItems[0].isNew).to.be.false;
    });
  });
  // skipcq: JS-0241
  it("#toggleState", function() {
    const myTopic = new Topic(dummyMinute._id, topicDoc);

    const oldState = myTopic._topicDoc.isOpen;

    myTopic.toggleState();

    // state should have changed
    expect(myTopic._topicDoc.isOpen).to.not.equal(oldState);
  });
  // skipcq: JS-0241
  describe("#isRecurring", function() {
    let myTopic;
    // skipcq: JS-0241
    beforeEach(function() { myTopic = new Topic(dummyMinute._id, topicDoc); });
    // skipcq: JS-0241
    it("sets the default value correctly",
       function() { expect(myTopic.isRecurring()).to.be.false; });
    // skipcq: JS-0241
    it("returns the correct value", function() {
      myTopic.getDocument().isRecurring = true;
      expect(myTopic.isRecurring()).to.be.true;
    });
  });
  // skipcq: JS-0241
  describe("#toggleRecurring", function() {
    let myTopic;
    // skipcq: JS-0241
    beforeEach(function() { myTopic = new Topic(dummyMinute._id, topicDoc); });
    // skipcq: JS-0241
    it("can change the value correctly", function() {
      myTopic.toggleRecurring();
      expect(myTopic.isRecurring()).to.be.true;
    });
    // skipcq: JS-0241
    it("can reset the isRecurring-Flag", function() {
      myTopic.toggleRecurring();
      myTopic.toggleRecurring();
      expect(myTopic.isRecurring()).to.be.false;
    });
  });
  // skipcq: JS-0241
  describe("#upsertInfoItem", function() {
    let myTopic;
    let topicItemDoc;
    // skipcq: JS-0241
    beforeEach(function() {
      myTopic = new Topic(dummyMinute._id, topicDoc);

      topicItemDoc = {
        subject : "info-item-subject",
        createdAt : new Date(),
      };
    });
    // skipcq: JS-0241
    it("adds a new info item to our topic", function() {
      myTopic.upsertInfoItem(topicItemDoc);

      expect(
          myTopic.getInfoItems().length,
          "the topic should have exactly one item",
          )
          .to.equal(1);
      expect(myTopic.getInfoItems()[0]._id, "the item should have an id")
          .to.not.be.false;
      expect(
          myTopic.getInfoItems()[0].subject,
          "the subject should be set correctly",
          )
          .to.equal(topicItemDoc.subject);
    });
    // skipcq: JS-0241
    it("updates an existing info item", function() {
      myTopic.upsertInfoItem(topicItemDoc);

      // Change the subject and call the upsertTopicItem method again
      const topicItem = myTopic.getInfoItems()[0];
      topicItem.subject = "new_subject";

      myTopic.upsertInfoItem(topicItem);

      expect(
          myTopic.getInfoItems().length,
          "the topic should have exactly one item",
          )
          .to.equal(1);
      expect(
          myTopic.getInfoItems()[0]._id,
          "the item should have an id",
          )
          .to.equal(topicItem._id);
      expect(
          myTopic.getInfoItems()[0].subject,
          "the subject should be set correctly",
          )
          .to.equal(topicItem.subject);
    });
  });
  // skipcq: JS-0241
  it("#findInfoItem", function() {
    const myTopic = new Topic(dummyMinute._id, topicDoc);
    const infoItemDoc = {
      _id : "AaBbCcDd01",
      subject : "info-item-subject",
      createdAt : new Date(),
      createdInMinute : dummyMinute._id,
    };

    // new info item is not added yet, so our topic should not find it
    let foundItem = myTopic.findInfoItem(infoItemDoc._id);
    expect(foundItem).to.equal();

    // now we add the info item to our topic
    myTopic.upsertInfoItem(infoItemDoc);

    foundItem = myTopic.findInfoItem(infoItemDoc._id);
    // foundItem should not be undefined
    expect(foundItem, "the result should not be undefined").to.not.equal();
    // the subject of the found item should be equal to its initial value
    expect(
        foundItem._infoItemDoc.subject,
        "the correct info item should be found",
        )
        .to.equal(infoItemDoc.subject);
  });
  // skipcq: JS-0241
  it("#removeInfoItem", function() {
    const myTopic = new Topic(dummyMinute._id, topicDoc);

    const infoItemDoc = {
      _id : "AaBbCcDd01",
      subject : "info-item-subject",
      createdAt : new Date(),
    };
    const infoItemDoc2 = {
      _id : "AaBbCcDd02",
      subject : "info-item-subject2",
      createdAt : new Date(),
    };

    // now we add the info items to our topic
    myTopic.upsertInfoItem(infoItemDoc);
    myTopic.upsertInfoItem(infoItemDoc2);

    // check that the two info items was added
    const initialLength = myTopic.getInfoItems().length;

    // remove the second one
    myTopic.removeInfoItem(infoItemDoc2._id);

    const diff = initialLength - myTopic.getInfoItems().length;

    // check that there are now only one items
    expect(
        diff,
        "The length of the info items should be decreased by one",
        )
        .to.equal(1);

    // check that the first item is still part of our topic
    expect(
        myTopic.getInfoItems()[0]._id,
        "The other info item should not be removed.",
        )
        .to.equal(infoItemDoc._id);
  });
  // skipcq: JS-0241
  describe("#tailorTopic", function() {
    let myTopic;
    // skipcq: JS-0241
    beforeEach(function() {
      topicDoc.infoItems.push({
        subject : "myInfoItem",
        createdInMinute : dummyMinute._id,
      });
      topicDoc.infoItems.push({
        subject : "myClosedActionItem",
        isOpen : false,
        itemType : "actionItem",
        createdInMinute : dummyMinute._id,
      });
      topicDoc.infoItems.push({
        subject : "myOpenActionItem",
        isOpen : true,
        itemType : "actionItem",
        createdInMinute : dummyMinute._id,
      });
      myTopic = new Topic(dummyMinute._id, topicDoc);
    });
    // skipcq: JS-0241
    it("removes all info items and closed action items", function() {
      myTopic.tailorTopic();

      expect(myTopic.getInfoItems()).to.have.length(1);
    });
    // skipcq: JS-0241
    it("keeps the open action items", function() {
      myTopic.tailorTopic();

      expect(myTopic._topicDoc.infoItems[0].isOpen).to.be.true;
    });
  });
  // skipcq: JS-0241
  describe("#getOpenActionItems", function() {
    let myTopic;
    // skipcq: JS-0241
    beforeEach(function() {
      topicDoc.infoItems.push({
        subject : "myInfoItem",
      });
      topicDoc.infoItems.push({
        subject : "myClosedActionItem",
        isOpen : false,
        itemType : "actionItem",
      });
      topicDoc.infoItems.push({
        subject : "myOpenActionItem",
        isOpen : true,
        itemType : "actionItem",
      });
      topicDoc.infoItems.push({
        subject : "my2ndOpenActionItem",
        isOpen : true,
        itemType : "actionItem",
      });
      myTopic = new Topic(dummyMinute._id, topicDoc);
    });
    // skipcq: JS-0241
    it("returns the correct amount of items",
       function() { expect(myTopic.getOpenActionItems()).to.have.length(2); });
    // skipcq: JS-0241
    it("returns only open action items", function() {
      myTopic.getOpenActionItems().forEach((item) => {
        expect(item, "the item should be a action item")
            .to.have.ownProperty(
                "isOpen",
            );
        expect(item.isOpen, "the item should marked as open").to.be.true;
      });
    });
  });
  // skipcq: JS-0241
  it("#save", function() {
    const myTopic = new Topic(dummyMinute._id, topicDoc);

    // the save-method should call the upsertTopic-Method of the parent Minute
    // so we spy on it
    const spy = sinon.spy(dummyMinute, "upsertTopic");

    myTopic.save();

    expect(spy.calledOnce, "the upsertTopic method should be called once")
        .to.be.true;
    expect(
        spy.calledWith(myTopic._topicDoc),
        "the document should be sent to the upsertTopic method",
        )
        .to.be.true;

    spy.restore();
  });
  // skipcq: JS-0241
  it("#getDocument", function() {
    const myTopic = new Topic(dummyMinute._id, topicDoc);

    expect(myTopic.getDocument()).to.equal(topicDoc);
  });
});
