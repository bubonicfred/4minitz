import "/imports/gitversioninfo";
import "/imports/config/accounts";
import "/imports/config/EMailTemplates";
import "/imports/broadcastmessage";
import "/imports/minutes";
import "/imports/meetingseries";
import "/imports/collections/broadcastmessage_private";
import "/imports/collections/users_private";
import "/imports/collections/userroles_private";
import "/imports/collections/onlineusers_private";
import "/server/ldap";
import "/server/sendResetPasswordMail";
import "/imports/statistics";
import "/imports/collections/attachments_private";
import "/imports/collections/documentgeneration_private";
import "/imports/services/finalize-minutes/finalizer";
import "/imports/services/isEditedService";
import "/imports/helpers/i18n";

import { BroadcastMessageSchema } from "/imports/collections/broadcastmessages.schema";
import { GlobalSettings } from "/imports/config/GlobalSettings";
import { LdapSettings } from "/imports/config/LdapSettings";
import importUsers from "/imports/ldap/import";
import { Accounts } from "meteor/accounts-base";
import { Meteor } from "meteor/meteor";
import { Markdown } from "meteor/perak:markdown";
import { i18n } from "meteor/universe:i18n";
import cron from "node-cron";

import { handleMigration } from "./migrations/migrations";

i18n.setLocale("en");

/**
 * Finds a demo user based on the provided criteria.
 * @param {Object} additionalCriteria - Additional criteria to filter the
 *     search.
 * @returns {Object|null} - The found demo user object, or null if not found.
 */
const findDemoUser = async (additionalCriteria = {}) => {
  await Meteor.users.findOneAsync({
    $and: [
      { username: "demo" },
      { isDemoUser: true },
      ...(Array.isArray(additionalCriteria)
        ? additionalCriteria
        : [additionalCriteria]),
    ],
  });
};

/**
 * Updates the demo user with the specified updates.
 *
 * @param {Object} updates - The updates to apply to the demo user.
 */
const updateDemoUser = async updates => {
  await Meteor.users.updateAsync({ username: "demo" }, { $set: updates });
};
/**
 * Creates a demo user account.
 */
const createDemoUser = async () => {
  Accounts.createUser({
    username: "demo",
    password: "demo",
    email: "",
    profile: { name: "Demo User" },
  });
  await updateDemoUser({
    isDemoUser: true,
    isInactive: false,
    "emails.0.verified": true,
  });
  console.log(
    "*** ATTENTION ***\n    Created demo/demo user account once on startup",
  );
};
const handleDemoUserAccount = async () => {
  if (GlobalSettings.createDemoAccount()) {
    const demoUser = await findDemoUser();
    if (demoUser) {
      // we already have one, let's ensure he is not switched Inactive
      if (demoUser.isInactive) {
        await updateDemoUser({ isInactive: false });
      }
      if (!demoUser.emails[0].verified) {
        await updateDemoUser({ "emails.0.verified": true });
      }
      return;
    }
    // we don't have a demo user, but settings demand one
    await createDemoUser();
    return;
  }
  /**
   * Represents the active demo user.
   *
   * @type {Object}
   */
  const demoUserActive = await findDemoUser({ isInactive: false });
  // we don't want a demo user
  if (demoUserActive) {
    // set demo account to Inactive
    await updateDemoUser({ isInactive: true });
    console.log(
      "*** ATTENTION ***\n    De-activated demo/demo user account (isInactive: true)",
    );
  }
  /**
   * Represents a demo user that is active again.
   *
   * @type {User}
   */
  const demoUserActiveAgain = await findDemoUser({ isInactive: false });
  // #Security: warn admin if demo user exists
  if (demoUserActiveAgain) {
    console.log(
      "*** ATTENTION ***\n" +
        "    There exists an account with user name 'demo'.\n" +
        "    If this account was created with the setting 'branding.createDemoAccount',\n" +
        "    the password for user 'demo' is also 'demo'.\n" +
        "    Please check, if this is wanted for your site's installation.\n",
    );
  }
};

/**
 * Synchronizes the ROOT_URL with the preference on Meteor.settings.
 * If ROOT_URL is specified in Meteor.settings, it updates the
 * process.env.ROOT_URL,
 * __meteor_runtime_config__.ROOT_URL, and
 * Meteor.absoluteUrl.defaultOptions.rootUrl. If ROOT_URL is not specified in
 * Meteor.settings, it grabs the ROOT_URL from the env variable.
 * @returns {void}
 */
const syncRootUrl = () => {
  if (!Meteor.settings) {
    console.log("*** Warning: no settings specified. Running in 'WTF' mode.");
    return;
  }

  if (!Meteor.settings.ROOT_URL) {
    console.log("*** Warning: No ROOT_URL specified in settings.json.");
    console.log("             Links in EMails and file download may not work.");
    console.log("             Grabbing ROOT_URL from env variable.");
  }

  // We sync the two sources of ROOT_URL with a preference on Meteor.settings
  // from settings.json process.env.ROOT_URL will be set to localhost:port by
  // meteor if not specified by the user. So, process.env.ROOT_URL should always
  // contain a value
  if (Meteor.settings.ROOT_URL) {
    process.env.ROOT_URL = Meteor.settings.ROOT_URL;
    __meteor_runtime_config__.ROOT_URL = Meteor.settings.ROOT_URL; // eslint-disable-line
    // We overwrite the `rootUrl` also in the `defaultOptions` which might be
    // overwritten by any other package ?! see
    // https://github.com/meteor/meteor/blob/24865b28a0689de8b4949fb69ea1f95da647cd7a/packages/meteor/url_common.js#L52
    // and https://github.com/4minitz/4minitz/issues/504
    Meteor.absoluteUrl.defaultOptions.rootUrl = Meteor.settings.ROOT_URL;
    return;
  }
  Meteor.settings.ROOT_URL = process.env.ROOT_URL;
};

Meteor.startup(async () => {
  syncRootUrl();
  console.log(`*** ROOT_URL: ${Meteor.settings.ROOT_URL}`);

  GlobalSettings.publishSettings();
  LdapSettings.loadSettingsAndPerformSanityCheck();

  process.env.MAIL_URL = GlobalSettings.getSMTPMailUrl();
  console.log(`WebApp current working directory:${process.cwd()}`);

  // #Security: Make sure that all server side markdown rendering quotes all
  // HTML <TAGs>
  Markdown.setOptions({
    sanitize: true,
  });

  handleMigration();
  // Migrations.migrateTo(12);     // Plz. keep this comment for manual
  // testing... ;-)

  await handleDemoUserAccount();

  // If we find no admin broadcast messages, we create an INactive one for
  // easy re-activating.
  if ((await BroadcastMessageSchema.find().countAsync()) === 0) {
    // #I18N: No translation here. We don't have a logged in user, so we can't
    // know the desired language But admin may do so in Admin frontend where
    // messages can be overwritten.
    const message =
      "Warning: 4Minitz will be down for maintenance in *4 Minutes*. " +
      "Downtime will be about 4 Minutes. Just submit open dialogs. " +
      "Then nothing is lost. You may finalize meetings later.";
    BroadcastMessageSchema.insert({
      text: message,
      isActive: false,
      createdAt: new Date(),
      dismissForUserIDs: [],
    });
  }

  if (
    !(
      GlobalSettings.hasImportUsersCronTab() ||
      GlobalSettings.getImportUsersOnLaunch()
    )
  ) {
    return;
  }
  const crontab = GlobalSettings.getImportUsersCronTab();
  const mongoUrl = process.env.MONGO_URL;
  const ldapSettings = GlobalSettings.getLDAPSettings();
  console.log("MONGO_URL:", mongoUrl);

  if (GlobalSettings.getImportUsersOnLaunch()) {
    console.log(
      "Importing LDAP users on launch. Disable via settings.json ldap.importOnLaunch.",
    );
    importUsers(ldapSettings, mongoUrl).catch(() => {
      // intentionally empty. Error handling is not required for
      // this operation.
    });
  }
  if (GlobalSettings.hasImportUsersCronTab()) {
    console.log("Configuring cron job for regular LDAP user import.");
    cron.schedule(crontab, () => {
      importUsers(ldapSettings, mongoUrl).catch(() => {
        // intentionally empty. No action required for catch.
      });
    });
  }
});
