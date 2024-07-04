module.exports = {
  moduleNameMapper: {
    '\\@capacitor-community/barcode-scanner':
      'src/jest/__mocks__/@capacitor-community/barcode-scanner.ts',
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
