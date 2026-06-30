const base = require("./app.json");

module.exports = () => ({
  ...base.expo,
  extra: {
    ...base.expo.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || process.env.PUBLIC_API_URL || base.expo.extra.apiUrl
  }
});
