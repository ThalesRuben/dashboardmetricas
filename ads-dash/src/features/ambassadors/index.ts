// API pública da feature `ambassadors`.
export { useAmbassadors } from './hooks/useAmbassadors';
export { AMBASSADOR_TYPES, AMBASSADOR_STATUS } from './lib/constants';
export { ambassadorsRepo } from './api/ambassadorsRepo';
export type {
  Ambassador,
  AmbassadorPayload,
  AmbassadorTypeKey,
  AmbassadorStatusKey,
  AmbassadorPlatform,
} from './api/types';
