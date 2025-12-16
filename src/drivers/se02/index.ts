import { driverFactoryRegistry } from '../../synth/factory.js';

export { SE02Driver, createSE02Driver, detectSE02, SE02CC } from './driver.js';

// Register SE-02 driver factory
driverFactoryRegistry.register({
  id: 'se02',
  name: 'Roland SE-02',
  detect: async () => {
    const { createSE02Driver } = await import('./driver.js');
    return createSE02Driver();
  },
});
