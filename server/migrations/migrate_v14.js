import { Meteor } from "meteor/meteor";

export class MigrateV14 {
  static async up() {
    const demoUser = await Meteor.users.findOneAsync({
      $and: [{ username: "demo" }, { isDemoUser: true }],
    });
    if (demoUser) {
      await Meteor.users.updateAsync(
        { username: "demo" },
        { $set: { "emails.0.verified": true } },
      );
    }
  }

  static async down() {
    const demoUser = await Meteor.users.findOneAsync({
      $and: [{ username: "demo" }, { isDemoUser: true }],
    });
    if (demoUser) {
      await Meteor.users.updateAsync(
        { username: "demo" },
        { $set: { "emails.0.verified": false } },
      );
    }
  }
}
