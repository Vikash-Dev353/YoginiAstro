module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-redux|@reduxjs/toolkit|react-native-reanimated|react-native-gesture-handler|@react-native-async-storage|redux|immer|reselect)/)',
  ],
};
