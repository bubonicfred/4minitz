import { Meteor } from "meteor/meteor";

// add isDemoUser:true to username: demo with expected "demo" password
export class MigrateV11 {
  static async up() {
    const demoUser = await Meteor.users.findOneAsync({ username: "demo" });
    if (demoUser) {
      await Meteor.users.updateAsync({ username: "demo" }, { $set: { isDemoUser: true } });
      if (demoUser.isInactive === undefined) {
        await Meteor.users.updateAsync(
          { username: "demo" },
          { $set: { isInactive: false } },
        );
      }
    }
  }

  static async down() {
    const demoUser = await Meteor.users.findOneAsync({ username: "demo" });
    if (demoUser) {
      await Meteor.users.updateAsync(
        { username: "demo" },
        { $unset: { isDemoUser: false } },
      );
    }
  }
}
