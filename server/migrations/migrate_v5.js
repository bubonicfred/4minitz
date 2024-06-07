import { MeetingSeriesSchema } from "/imports/collections/meetingseries.schema";
import { MinutesSchema } from "/imports/collections/minutes.schema";

import { updateTopicsOfMinutes } from "./helpers/updateMinutes";
import { updateTopicsOfSeriesPre16 } from "./helpers/updateSeries";

// add the isRecurring field to all topics
export class MigrateV5 {
  static _upgradeTopics(topics) {
    // add new field isRecurring with default value false for each topic
    topics.forEach((topic) => {
      topic.isRecurring = false;
    });
  }

  static _downgradeTopics(topics) {
    // remove field isRecurring for each infoItem in each topic
    topics.forEach((topic) => {
      delete topic.isRecurring;
    });
  }

  static async up() {
    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        MigrateV5._upgradeTopics(minute.topics);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection());
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MigrateV5._upgradeTopics(series.openTopics);
        MigrateV5._upgradeTopics(series.topics);
        updateTopicsOfSeriesPre16(series, MeetingSeriesSchema.getCollection());
      });
  }

  static async down() {
    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        MigrateV5._downgradeTopics(minute.topics);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection());
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MigrateV5._downgradeTopics(series.openTopics);
        MigrateV5._downgradeTopics(series.topics);
        updateTopicsOfSeriesPre16(series, MeetingSeriesSchema.getCollection());
      });
  }
}
