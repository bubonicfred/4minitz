import { MeetingSeriesSchema } from "/imports/collections/meetingseries.schema";
import { MinutesSchema } from "/imports/collections/minutes.schema";

import { updateTopicsOfMinutes } from "./helpers/updateMinutes";
import { updateTopicsOfSeriesPre16 } from "./helpers/updateSeries";

// Topics: convert the responsible (string) => responsibles (array) fields
export class MigrateV4 {
  static async up() {
    const migrateTopicsUp = (topic) => {
      topic.responsibles = [];
      if (topic.responsible) {
        topic.responsibles.push(topic.responsible);
      }
    };

    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        minute.topics.forEach(migrateTopicsUp);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection(), {
          bypassCollection2: true,
        });
      });
    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((meeting) => {
        meeting.topics.forEach(migrateTopicsUp);
        meeting.openTopics.forEach(migrateTopicsUp);

        updateTopicsOfSeriesPre16(
          meeting,
          MeetingSeriesSchema.getCollection(),
          { bypassCollection2: true },
        );
      });
  }

  static async down() {
    const migrateTopicsDown = (topic) => {
      if (topic.responsibles) {
        topic.responsible = topic.responsibles.join();
        delete topic.responsibles;
      }
    };

    await MinutesSchema.getCollection()
      .find()
      .forEachAsync((minute) => {
        minute.topics.forEach(migrateTopicsDown);
        updateTopicsOfMinutes(minute, MinutesSchema.getCollection(), {
          bypassCollection2: true,
        });
      });

    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((meeting) => {
        meeting.topics.forEach(migrateTopicsDown);
        meeting.openTopics.forEach(migrateTopicsDown);

        updateTopicsOfSeriesPre16(
          meeting,
          MeetingSeriesSchema.getCollection(),
          { bypassCollection2: true },
        );
      });
  }
}
