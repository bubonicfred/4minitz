import { MeetingSeriesSchema } from "/imports/collections/meetingseries.schema";
import { MinutesSchema } from "/imports/collections/minutes.schema";

import { updateTopicsOfMinutes } from "./helpers/updateMinutes";
import { updateTopicsOfSeriesPre16 } from "./helpers/updateSeries";

export class MigrateV13 {
  static _upgradeTopics(topics) {
    topics.forEach((topic) => {
      if (topic.isSkipped === undefined) {
        topic.isSkipped = false;
      }
    });
  }

  static _downgradeTopics(topics) {
    topics.forEach((topic) => {
      delete topic.isSkipped;
    });
  }

  static async up() {
    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        MigrateV13._upgradeTopics(minute.topics);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection(), {
          bypassCollection2: true,
        });
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MigrateV13._upgradeTopics(series.openTopics);
        MigrateV13._upgradeTopics(series.topics);
        updateTopicsOfSeriesPre16(series, MeetingSeriesSchema.getCollection(), {
          bypassCollection2: true,
        });
      });
  }

  static async down() {
    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        MigrateV13._downgradeTopics(minute.topics);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection(), {
          bypassCollection2: true,
        });
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MigrateV13._downgradeTopics(series.openTopics);
        MigrateV13._downgradeTopics(series.topics);
        updateTopicsOfSeriesPre16(series, MeetingSeriesSchema.getCollection(), {
          bypassCollection2: true,
        });
      });
  }
}
