import { expect } from "chai";
import _ from "lodash";
import proxyquire from "proxyquire";

class MeteorError {}
const Meteor = {
  Error: MeteorError,
};

const { ITEM_KEYWORDS } = proxyquire(
  "../../../../imports/search/FilterKeywords",
  {},
);

const { ItemsFilter } = proxyquire("../../../../imports/search/ItemsFilter", {
  lodash: { _, "@noCallThru": true },
  "meteor/meteor": { Meteor, "@noCallThru": true },
  "./FilterKeywords": { ITEM_KEYWORDS, "@noCallThru": true },
});

import { QueryParserMock } from "./QueryParserMock";
// skipcq: JS-0241
describe("ItemsFilter", function () {
  let items;
  let itemsFilter;
  let parser;
  // skipcq: JS-0241
  beforeEach(function () {
    parser = new QueryParserMock();
    itemsFilter = new ItemsFilter();
    items = [
      { subject: "one.one", labels: ["L2", "L1"], itemType: "infoItem" },
      {
        subject: "one.two",
        labels: [],
        itemType: "actionItem",
        isOpen: true,
      },
      { subject: "two.one", labels: ["L1"], itemType: "infoItem" },
      { subject: "two.two", labels: [], itemType: "infoItem" },
      {
        subject: "two.three",
        labels: ["L1"],
        itemType: "actionItem",
        isOpen: true,
        duedate: "2017-06-09",
      },
      { subject: "three.one", labels: [], itemType: "infoItem" },
      { subject: "three.two", labels: [], itemType: "infoItem" },
      { subject: "three.three", labels: [], itemType: "infoItem" },
      {
        subject: "three.four",
        labels: [],
        itemType: "actionItem",
        isOpen: false,
        duedate: "2017-05-30",
      },
    ];
  });
  // skipcq: JS-0241
  it("does not change the original array of items", function () {
    parser.searchTokens.push("three");
    itemsFilter.filter(items, parser);

    expect(items, "Length of the items array should be 9").have.length(9);
  });
  // skipcq: JS-0241
  it("returns the filtered array of items", function () {
    parser.searchTokens.push("three");
    const res = itemsFilter.filter(items, parser);

    expect(res, "Length of the result items array should be 5").have.length(5);
  });
  // skipcq: JS-0241
  it("can filter for multiple search tokens", function () {
    parser.searchTokens.push("three");
    parser.searchTokens.push("two");
    const res = itemsFilter.filter(items, parser);

    expect(res, "Length of the result items array should be 2").have.length(2);
  });
  // skipcq: JS-0241
  it("should return an items array containing only info items matching the search query", function () {
    const query = "three";
    parser.searchTokens.push(query);
    const res = itemsFilter.filter(items, parser);
    let foundAWrongItem = false;
    res.forEach((item) => {
      if (item.subject.indexOf(query) === -1) {
        foundAWrongItem = true;
      }
    });
    expect(
      foundAWrongItem,
      "Result array contains info item which does not match the search query",
    ).to.be.false;
  });
  // skipcq: JS-0241
  it("can filter for labels", function () {
    parser.labelTokens.push("L1");
    const res = itemsFilter.filter(items, parser);
    expect(res, "Length of the result items array should be 3").have.length(3);
  });
  // skipcq: JS-0241
  it("filters case insensitive per default for search tokens", function () {
    parser.searchTokens.push("THREE");
    parser.searchTokens.push("TWO");
    const res = itemsFilter.filter(items, parser);

    expect(res, "Length of the result items array should be 2").have.length(2);
  });
  // skipcq: JS-0241
  it("can enable case sensitive search", function () {
    parser.caseSensitive = true;
    parser.searchTokens.push("THREE");
    const res = itemsFilter.filter(items, parser);
    parser.caseSensitive = false;

    expect(res, "Length of the result items array should be 0").have.length(0);
  });
  // skipcq: JS-0241
  it("can combine multiple is-filter-tokens as logical AND which is a conjunctive operation", function () {
    parser.filterTokens.push({ key: "is", value: "open" });
    parser.filterTokens.push({ key: "is", value: "action" });
    const res = itemsFilter.filter(items, parser);

    expect(res, "Length of the result items array should be 2").have.length(2);

    parser.init();
    parser.filterTokens.push({ key: "is", value: "action" });
    parser.filterTokens.push({ key: "is", value: "open" });
    const res2 = itemsFilter.filter(items, parser);

    expect(
      res2,
      "The order of the filter tokens should not matter",
    ).have.length(2);
  });
  // skipcq: JS-0241
  it("can filter items depending on their due date", function () {
    parser.filterTokens.push({ key: "due", value: "2017-" });
    const res = itemsFilter.filter(items, parser);

    expect(res, "Length of the result items array should be 2").have.length(2);
  });
});
