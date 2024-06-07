import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";

// We wrap the original Accounts.sendResetPasswordEmail to perform
// a check for user.isLDAPuser in advance. Because LDAP users
// should not be able to change their passwords via this WebApp.
const originalSendResetPasswordEmail = Accounts.sendResetPasswordEmail;
Accounts.sendResetPasswordEmail = async (userId, email) => {
  const user = await Meteor.users.findOneAsync(userId);
  if (user.isLDAPuser) {
    throw new Meteor.Error(
      418,
      "LDAP users are not allowed to reset their password with 'Standard' login",
    );
  }
  originalSendResetPasswordEmail(userId, email);
};
