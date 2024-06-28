import {expect} from "chai";
import _ from "lodash";
import proxyquire from "proxyquire";
import sinon from "sinon";

import * as Helpers from "../../../imports/helpers/date";
import {subElementsHelper} from "../../../imports/helpers/subElements";

const Topic = {};
const Label = {};

Helpers["@noCallThru"] = true;

class MeteorError {}
const Meteor = {
  Error : MeteorError,
  user : () => { return {username : "unit-test"}; },
};

const Random = {
  id : () => {},
};

const User = {
  profileNameWithFallback : sinon.stub(),
};

const {InfoItem} = proxyquire("../../../imports/infoitem", {
  "meteor/meteor" : {Meteor, "@noCallThru" : true},
  "meteor/random" : {Random, "@noCallThru" : true},
  "./user" : {User, "@noCallThru" : true},
  lodash : {_, "@noCallThru" : true},
  "./helpers/date" : Helpers,
  "./topic" : {Topic, "@noCallThru" : true},
  "./label" : {Label, "@noCallThru" : true},
});

// skipcq: JS-0241
describe("InfoItem", function() {
  let dummyTopic;
  let infoItemDoc;
  // skipcq: JS-0241
  beforeEach(function() {
    dummyTopic = {
      _id : "AaBbCcDd",
      _infoItems : [],
      upsertInfoItem : sinon.stub(),
      findInfoItem(id) {
        const index = subElementsHelper.findIndexById(id, this._infoItems);
        if (index === undefined)
          return undefined;
        return new InfoItem(this, this._infoItems[index]);
      },
      // test-only method
      addInfoItem(infoItem) {
        infoItem._infoItemDoc.createdInMinute = "AaBbCcDd01";
        this._infoItems.push(infoItem._infoItemDoc);
      },
    };

    infoItemDoc = {
      _id : "AaBbCcDd01",
      subject : "infoItemDoc",
      createdAt : new Date(),
      createdInMinute : "AaBbCcDd01",
    };
  });
  // skipcq: JS-0241
  describe("#constructor", function() {
    // skipcq: JS-0241
    it("sets the reference to the parent topic correctly", function() {
      const myInfoItem = new InfoItem(dummyTopic, infoItemDoc);
      // the infoItem should have a reference of our dummyTopic
      expect(myInfoItem._parentTopic).to.equal(dummyTopic);
    });
    // skipcq: JS-0241
    it("sets the document correctly", function() {
      const myInfoItem = new InfoItem(dummyTopic, infoItemDoc);
      // the doc should be equal to our initial document
      expect(myInfoItem._infoItemDoc).to.equal(infoItemDoc);
    });
    // skipcq: JS-0241
    it("creates the same object by passing the id of an existing one",
       function() {
         const myInfoItem = new InfoItem(dummyTopic, infoItemDoc);
         // add the created info item to our dummy topic
         dummyTopic.addInfoItem(myInfoItem);

         // Now we should be able to create the same info item again
         // by passing the dummyTopic together with the info items id
         const sameInfoItem = new InfoItem(
             dummyTopic,
             myInfoItem._infoItemDoc._id,
         );
         // the associated documents of both info items should be the same
         expect(sameInfoItem._infoItemDoc).to.equal(myInfoItem._infoItemDoc);
       });
  });
  // skipcq: JS-0241
  it("#isActionItem", function() {
    const myInfoItem = new InfoItem(dummyTopic, infoItemDoc);
    expect(
        myInfoItem.isActionItem(),
        "Item without the itemType-property should not be an ActionItem",
        )
        .to.be.false;

    const actionItemDoc = {
      _id : "AaBbCcDd02",
      subject : "actionItemDoc",
      itemType : "actionItem",
    };
    expect(
        InfoItem.isActionItem(actionItemDoc),
        "Item with the itemType-property set to actionItem should be an ActionItem",
        )
        .to.be.true;
  });
  // skipcq: JS-0241
  it("#save", function() {
    const myInfoItem = new InfoItem(dummyTopic, infoItemDoc);

    myInfoItem.save();
    expect(dummyTopic.upsertInfoItem.calledOnce).to.be.true;

    dummyTopic.upsertInfoItem.reset();
  });
});
