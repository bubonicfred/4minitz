import { MeetingSeriesSchema } from "/imports/collections/meetingseries.schema";
import { MinutesSchema } from "/imports/collections/minutes.schema";
import { Meteor } from "meteor/meteor";

import { updateTopicsOfMinutes } from "./helpers/updateMinutes";
import { updateTopicsOfSeriesPre16 } from "./helpers/updateSeries";

// ActionItems: convert the responsible (string) => responsibles (array) fields
export class MigrateV6 {
  static _upgradeTopics(topics) {
    topics.forEach((topic) => {
      topic.infoItems.forEach((item) => {
        item.responsibles = [];
        if (item.responsible) {
          const resp = item.responsible.split(",");
          resp.forEach(async (oneResp, index, array) => {
            oneResp = oneResp.trim();
            // let's try if this is a valid username.
            // If yes: we store this user's _id instead of its name!
            const userTry = await Meteor.users.findOneAsync({ username: oneResp });
            if (userTry) {
              oneResp = userTry._id;
            }
            array[index] = oneResp; // change value in outer array
          });
          item.responsibles = resp;
          delete item.responsible;
        }
      });
    });
  }

  static _downgradeTopics(topics) {
    topics.forEach((topic) => {
      topic.infoItems.forEach((item) => {
        item.responsible = "";
        if (item.responsibles && item.responsibles.length) {
          item.responsible = item.responsibles.join();
        }
        delete item.responsibles;
      });
    });
  }

  static async up() {
    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        MigrateV6._upgradeTopics(minute.topics);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection());
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MigrateV6._upgradeTopics(series.openTopics);
        MigrateV6._upgradeTopics(series.topics);
        updateTopicsOfSeriesPre16(series, MeetingSeriesSchema.getCollection());
      });
  }

  static async down() {
    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        MigrateV6._downgradeTopics(minute.topics);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection());
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MigrateV6._downgradeTopics(series.openTopics);
        MigrateV6._downgradeTopics(series.topics);
        updateTopicsOfSeriesPre16(series, MeetingSeriesSchema.getCollection());
      });
  }
}
