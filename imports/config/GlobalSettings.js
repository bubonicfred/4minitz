import { LdapSettings } from "/imports/config/LdapSettings";
import { Meteor } from "meteor/meteor";

function getSetting(path, def = undefined) {
  return Meteor.settings?.[path] ?? def;
}

/**
 * Wrapper to access our Global Settings.
 */
export class GlobalSettings {
  /**
   * Publish designated settings which should be
   * accessible for the client (e.g. enableEmailDelivery).
   * This method should be called on meteor server startup.
   * Caution: do not publish settings like api keys or passwords!
   */
  static publishSettings() {
    this.publishEmailSettings();
    this.publishBrandingSettings();
    this.publishAttachmentSettings();
    this.publishDocGenerationSettings();
    this.publishAccountCreationSettings();
    this.enforceStoragePathSlash();
    LdapSettings.publish();
  }

  static publishEmailSettings() {
    const {
      email: {
        enableMailDelivery = false,
        sendVerificationEmail = false,
        showResendVerificationEmailLink = false,
        showForgotPasswordLink = false,
      } = {},
    } = Meteor.settings;
    Meteor.settings.public = {
      ...Meteor.settings.public,
      enableMailDelivery,
      sendVerificationEmail,
      showResendVerificationEmailLink,
      showForgotPasswordLink,
    };
  }

  static publishBrandingSettings() {
    const {
      branding: {
        topLeftLogoHTML = "4Minitz.com",
        showGithubCorner = true,
        showInfoOnLogin = true,
        createDemoAccount = false,
        legalNotice = { enabled: false, linkText: "", content: [""] },
      } = {},
    } = Meteor.settings.public;
    Meteor.settings.public.branding = {
      topLeftLogoHTML,
      showGithubCorner,
      showInfoOnLogin,
      createDemoAccount,
      legalNotice,
    };
  }

  static publishAttachmentSettings() {
    Meteor.settings.public.attachments = {
      enabled: getSetting("attachments.enabled", false),
      allowExtensions: getSetting("attachments.allowExtensions", ".*"),
      denyExtensions: getSetting(
        "attachments.denyExtensions",
        "exe|app|bat|sh|cmd|com|cpl|exe|gad|hta|inf|jar|jpe|jse|lnk|msc|msh|msi|msp|pif|ps1|ps2|psc|reg|scf|scr|vbe|vbs|wsc|wsf|wsh",
      ),
      maxFileSize: getSetting("attachments.maxFileSize", 10 * 1024 * 1024), // default: 10 MB
    };
  }

  static publishDocGenerationSettings() {
    Meteor.settings.public.docGeneration = {
      enabled: getSetting("docGeneration.enabled", false),
      format: getSetting("docGeneration.format", "html"),
    };
  }

  static publishAccountCreationSettings() {
    Meteor.settings.public.forbidClientAccountCreation = getSetting(
      "forbidClientAccountCreation",
      false,
    );
  }

  static enforceStoragePathSlash() {
    const storagePath = getSetting("attachments.storagePath");
    if (storagePath && !storagePath.endsWith("/")) {
      Meteor.settings.attachments.storagePath = `${storagePath}/`;
    }
  }

  static getAdminIDs() {
    const adminIDs = [];

    if (Meteor.settings.adminIDs && Array.isArray(Meteor.settings.adminIDs)) {
      return adminIDs.concat(Meteor.settings.adminIDs);
    }

    return adminIDs;
  }

  static forbidClientAccountCreation() {
    return getSetting("forbidClientAccountCreation", false);
  }

  static getRootUrl(path) {
    if (Meteor.settings.ROOT_URL) {
      return Meteor.absoluteUrl(path, { rootUrl: Meteor.settings.ROOT_URL });
    }

    return Meteor.absoluteUrl(path);
  }

  static hasImportUsersCronTab() {
    return Boolean(
      Meteor.settings.ldap?.enabled && Meteor.settings.ldap.importCronTab,
    );
  }

  static getImportUsersCronTab() {
    if (Meteor.settings.ldap?.enabled) {
      return Meteor.settings.ldap.importCronTab;
    }
    return undefined;
  }

  static getImportUsersOnLaunch() {
    if (Meteor.settings.ldap?.enabled) {
      if (Meteor.settings.ldap.importOnLaunch !== undefined) {
        return Meteor.settings.ldap.importOnLaunch;
      }
      return true;
    }
    return false;
  }

  static getLDAPSettings() {
    return Meteor.settings.ldap || {};
  }

  static isTrustedIntranetInstallation() {
    // returns false instead of undefined
    return Boolean(Meteor.settings.trustedIntranetInstallation);
  }

  static getDefaultLabels() {
    if (!Meteor.settings.defaultLabels) return [];

    return Meteor.settings.defaultLabels;
  }

  static getSiteName() {
    if (!Meteor.settings.siteName) {
      return "4Minitz";
    }
    return Meteor.settings.siteName;
  }

  static getDefaultEmailSenderAddress(alternativeSender) {
    let address = Meteor.settings.email
      ? Meteor.settings.email.defaultEMailSenderAddress
      : undefined;

    if (
      address &&
      alternativeSender &&
      Meteor.settings.email &&
      Meteor.settings.email.defaultEMailSenderExceptionDomains &&
      Meteor.settings.email.defaultEMailSenderExceptionDomains.length > 0
    ) {
      const senderDomain = alternativeSender.replace(/^.*@/, "").toLowerCase(); // me@mycompany.com => mycompany.com
      for (const defaultEMailSenderExceptionDomain of Meteor.settings.email
        .defaultEMailSenderExceptionDomains) {
        if (defaultEMailSenderExceptionDomain.toLowerCase() === senderDomain) {
          address = alternativeSender;
          break;
        }
      }
    }

    if (address !== undefined) {
      // we have default from settings
      if (address === "") {
        // but it's empty!
        return alternativeSender // luckily we have a real user profile mail
          ? alternativeSender // we take it!
          : GlobalSettings.getFallbackEMailSenderAddress(); // nope. use
        // fallback!
      } else {
        return address;
      }
    }

    throw new Meteor.Error(
      "illegal-state",
      "defaultEMailSenderAddress not defined in settings",
    );
  }

  static getFallbackEMailSenderAddress() {
    if (Meteor.settings.email?.fallbackEMailSenderAddress) {
      return Meteor.settings.email.fallbackEMailSenderAddress;
    }

    throw new Meteor.Error(
      "illegal-state",
      "fallback email sender address required but not defined in settings",
    );
  }

  static isEMailDeliveryEnabled() {
    if (!Meteor.settings.public) {
      return false;
    }
    return Meteor.settings.public.enableMailDelivery;
  }

  static getMailDeliverer() {
    if (Meteor.settings.email?.mailDeliverer) {
      return Meteor.settings.email.mailDeliverer;
    }

    return "smtp";
  }

  static sendVerificationEmail() {
    const mailEnabled = getSetting("email.enableMailDelivery", false);
    const sendVerificationEmail = getSetting(
      "email.sendVerificationEmail",
      false,
    );
    return mailEnabled && sendVerificationEmail;
  }

  static showResendVerificationEmailLink() {
    const mailEnabled = getSetting("email.enableMailDelivery", false);
    const showResendVerificationEmailLink = getSetting(
      "email.showResendVerificationEmailLink",
      false,
    );

    return mailEnabled && showResendVerificationEmailLink;
  }

  static showForgotPasswordLink() {
    const mailEnabled = getSetting("email.enableMailDelivery", false);
    const showForgotPasswordLink = getSetting(
      "email.showForgotPasswordLink",
      false,
    );

    return mailEnabled && showForgotPasswordLink;
  }

  static getSMTPMailUrl() {
    if (Meteor.settings.email?.smtp && Meteor.settings.email.smtp.mailUrl) {
      return Meteor.settings.email.smtp.mailUrl;
    }
    return "";
  }

  static getMailgunSettings() {
    if (Meteor.settings.email?.mailgun) {
      return Meteor.settings.email.mailgun;
    }

    throw new Meteor.Error(
      "illegal-state",
      "mailgun settings not defined in meteor settings",
    );
  }

  static getBrandingLogoHTML() {
    return Meteor.settings.public.branding.topLeftLogoHTML;
  }

  static showGithubCorner() {
    return Meteor.settings.public.branding.showGithubCorner;
  }

  static showInfoOnLogin() {
    return Meteor.settings.public.branding.showInfoOnLogin;
  }

  static createDemoAccount() {
    return Meteor.settings.public.branding.createDemoAccount;
  }

  static getAttachmentsEnabled() {
    const {
      public: { attachments: { enabled = false } = {} },
    } = Meteor.settings;
    return enabled;
  }

  // The url is in settings file.
  static getLegalNoticeExternalUrl() {
    if (navigator.language === "de-DE")
      return Meteor.settings.public.branding.legalNotice.externalURL.de;
    return Meteor.settings.public.branding.legalNotice.externalURL.en;
  }
}
