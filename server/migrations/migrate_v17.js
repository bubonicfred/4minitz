import { MeetingSeriesSchema } from "/imports/collections/meetingseries.schema";
import { MinutesFinder } from "/imports/services/minutesFinder";

// MeetingSeries: add fields: lastMinutesFinalized, lastMinutesId
export class MigrateV17 {
  static async up() {
    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        const lastMin = MinutesFinder.lastMinutesOfMeetingSeries(series);
        const isFinalized = lastMin ? lastMin.isFinalized : false;
        const lastMinId = lastMin ? lastMin._id : null;
        MeetingSeriesSchema.getCollection().update(
          series._id,
          {
            $set: {
              lastMinutesFinalized: isFinalized,
              lastMinutesId: lastMinId,
            },
          },
          { bypassCollection2: true },
        );
      });
  }

  static async down() {
    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MeetingSeriesSchema.getCollection().update(
          series._id,
          { $unset: { lastMinutesFinalized: false, lastMinutesId: null } },
          { bypassCollection2: true },
        );
      });
  }
}
