import { MeetingSeriesSchema } from "/imports/collections/meetingseries.schema";

// MeetingSeries: add responsiblesFreeText field
export class MigrateV8 {
  static async up() {
    await MeetingSeriesSchema.getCollection()
      .find()
      .forEachAsync((series) => {
        MeetingSeriesSchema.getCollection().update(
          series._id,
          { $set: { additionalResponsibles: [] } },
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
          { $unset: { additionalResponsibles: "" } },
          { bypassCollection2: true },
        );
      });
  }
}
