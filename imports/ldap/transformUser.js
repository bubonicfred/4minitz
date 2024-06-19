import {pick} from "lodash";

/**
 * Filters an array and returns a new array without the specified values.
 *
 * @param {Array} arr - The array to filter.
 * @param {...*} args - The values to exclude from the filtered array.
 * @returns {Array} - A new array with the values excluded.
 */
const without = (arr, ...args) => arr.filter((item) => !args.includes(item));
export default (ldapSettings, userData) => {
  ldapSettings.propertyMap = ldapSettings.propertyMap || {};
  const usernameAttribute =
      ldapSettings.searchDn || ldapSettings.propertyMap.username || "cn";
  const longnameAttribute = ldapSettings.propertyMap.longname;
  const mailAttribute = ldapSettings.propertyMap.email || "mail";

  // userData.mail may be a string with one mail address or an array.
  // Nevertheless we are only interested in the first mail address here - if
  // there should be more...
  let tmpEMail = userData[mailAttribute];
  if (Array.isArray(tmpEMail)) {
    tmpEMail = tmpEMail[0];
  }
  const tmpEMailArray = [
    {
      address : tmpEMail,
      verified : true,
      fromLDAP : true,
    },
  ];

  const username = userData[usernameAttribute] || "";

  const allowListedFields = ldapSettings.allowListedFields || [];
  const profileFields = allowListedFields.concat([ "dn" ]);

  const user = {
    createdAt : new Date(),
    isInactive : false,
    emails : tmpEMailArray,
    username : username.toLowerCase(),
    profile : pick(userData, without(profileFields, "mail")),
  };

  // copy over the LDAP user's long name from "cn" field to the meteor accounts
  // long name field
  if (longnameAttribute) {
    user.profile.name = userData[longnameAttribute];
  }

  if (userData.isInactive) {
    user.isInactive = true;
  }
  return user;
};
