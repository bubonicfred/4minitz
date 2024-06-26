import { GlobalSettings } from "/imports/config/GlobalSettings";
import { Roles } from "meteor/alanning:roles";
import { Meteor } from "meteor/meteor";

import { UserRoles } from "../userroles";

if (Meteor.isServer) {
  // #Security: first reset all admins, then set "isAdmin:true" for IDs in
  // settings.json
  await Meteor.users.updateAsync(
    { isAdmin: true },
    { $unset: { isAdmin: false } },
    { multi: true },
  );

  const adminIDs = GlobalSettings.getAdminIDs();
  if (adminIDs.length > 0) {
    // set admins
    await Meteor.users.updateAsync(
      { _id: { $in: adminIDs } },
      { $set: { isAdmin: true } },
      { multi: true },
    );

    console.log("*** Admin IDs:");
    adminIDs.forEach(async (id) => {
      const user = await Meteor.users.findOneAsync(id);
      if (user) {
        console.log(`    ${user._id}: ${user.username}`);
      } else {
        console.log(`    ${id}: unknown ID!`);
      }
    });
  }

  // #Security: intentionally suppress email addresses of all other users!
  const publishFields = {
    username: 1,
    "profile.locale": 1,
    roles: 1,
  };
  // #Security: only publish email address in trusted intranet environment
  if (GlobalSettings.isTrustedIntranetInstallation()) {
    publishFields.emails = 1;
    publishFields["profile.name"] = 1;
  }
  Meteor.publish("userListSimple", function () {
    if (this.userId) {
      return Meteor.users.find({}, { fields: publishFields });
    }
  });

  // #Security: Publish some extra fields - but only for the logged in user
  Meteor.publish("userSettings", function () {
    if (this.userId) {
      return Meteor.users.find(
        { _id: this.userId },
        {
          fields: { settings: 1, isAdmin: 1, isLDAPuser: 1, isDemoUser: 1 },
        },
      );
    }
  });

  // #Security: Publish all user fields only to admin user
  Meteor.publish("userAdmin", async function () {
    if (this.userId) {
      const usr = await Meteor.users.findOneAsync(this.userId);
      if (usr.isAdmin) {
        return Meteor.users.find({});
      }
    }
  });
}

if (Meteor.isClient) {
  // This gets visible via Meteor.users collection
  Meteor.subscribe("userListSimple");
  Meteor.subscribe("userSettings");
  Meteor.subscribe("userAdmin");
}

Meteor.methods({
  "userroles.saveRoleForMeetingSeries"(otherUserId, meetingSeriesId, newRole) {
    if (Meteor.isServer) {
      console.log(
        "Method: userroles.saveRoleForMeetingSeries ",
        otherUserId,
        meetingSeriesId,
        newRole,
      );
    }
    if (!Meteor.userId()) {
      throw new Meteor.Error("Not logged in.");
    }
    if (Meteor.userId() === otherUserId) {
      return; // silently swallow: user may never change own role!
    }

    // check if newRole is an allowed role
    if (!Array.isArray(newRole)) {
      // unify input. maybe array or string
      newRole = [newRole];
    }
    const allowedRoles = Object.keys(UserRoles.USERROLES).map(
      (key) => UserRoles.USERROLES[key],
    );
    const newRoleString = newRole[0];
    if (!allowedRoles.includes(newRoleString)) {
      throw new Meteor.Error(`Unknown role value: ${newRole}`);
    }

    // #Security: Ensure user is moderator of affected meeting series
    const userRoles = new UserRoles(Meteor.userId());
    if (userRoles.isModeratorOf(meetingSeriesId)) {
      Roles.removeUsersFromRoles(
        otherUserId,
        UserRoles.allRolesNumerical(),
        meetingSeriesId,
      );
      Roles.addUsersToRoles(otherUserId, newRole, meetingSeriesId);
    } else {
      throw new Meteor.Error(
        "Cannot set roles for meeting series",
        "You are not moderator of this meeting series.",
      );
    }
  },

  "userroles.removeAllRolesForMeetingSeries"(otherUserId, meetingSeriesId) {
    if (Meteor.isServer) {
      console.log(
        "Method: userroles.removeAllRolesForMeetingSeries ",
        otherUserId,
        meetingSeriesId,
      );
    }
    if (!Meteor.userId()) {
      throw new Meteor.Error("Not logged in.");
    }
    if (Meteor.userId() === otherUserId) {
      return; // silently swallow: user may never change own role!
    }

    // #Security: Ensure user is moderator of affected meeting series
    const userRoles = new UserRoles(Meteor.userId());
    if (userRoles.isModeratorOf(meetingSeriesId)) {
      Roles.removeUsersFromRoles(
        otherUserId,
        UserRoles.allRolesNumerical(),
        meetingSeriesId,
      );
    } else {
      throw new Meteor.Error(
        "Cannot set roles for meeting series",
        "You are not moderator of this meeting series.",
      );
    }
  },
});
