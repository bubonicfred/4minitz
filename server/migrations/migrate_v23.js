import { MinutesSchema } from "/imports/collections/minutes.schema";
import { TopicSchema } from "/imports/collections/topic.schema";

export class MigrateV23 {
  static async migrateTopicCollection() {
    const topics = TopicSchema.getCollection().find({});

    await topics.forEachAsync((topic) => {
      if (Array.isArray(topic.responsibles)) {
        return;
      }

      const responsibles = [];
      TopicSchema.getCollection().update(topic._id, { $set: { responsibles } });
    });
  }

  static async migrateMinutesCollection() {
    const minutes = MinutesSchema.getCollection().find({});
    await minutes.forEachAsync((minutes) => {
      // copy over the topics as they are and just replace the responsibles
      // field:
      //  * keep responsibles if they are set properly
      //  * set responsibles to [] if they are null
      const topics = minutes.topics.map((topic) => ({
        ...topic,
        responsibles: topic.responsibles || [],
      }));
      MinutesSchema.getCollection().update(minutes._id, { $set: { topics } });
    });
  }

  static up() {
    this.migrateTopicCollection();
    this.migrateMinutesCollection();
  }

  static down() {
    // the old schema also supports responsibles fields set to an empty array
    // so there is nothing to do here
  }
}
