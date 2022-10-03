jest.mock('@capacitor-community/barcode-scanner', () => {
  return {
    hideBackground: jest.fn(),
    startScan: jest.fn(),
    showBackground: jest.fn(),
    checkPermission: jest.fn(),
    openAppSettings: jest.fn(),
  };
});

export {};
