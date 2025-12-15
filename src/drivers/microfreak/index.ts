import { driverFactoryRegistry } from '../../synth/factory.js';

export { MicroFreakDriver, createMicroFreakDriver, detectMicroFreak } from './driver.js';
export { 
  MicroFreakCC, 
  getCCForParam, 
  OSCILLATOR_TYPES,
  getOscillatorTypeValue,
  getOscillatorTypeName,
  type OscillatorType,
} from './param-map.js';

// Register MicroFreak driver factory
driverFactoryRegistry.register({
  id: 'microfreak',
  name: 'MicroFreak',
  detect: async () => {
    const { createMicroFreakDriver } = await import('./driver.js');
    return createMicroFreakDriver();
  },
});
