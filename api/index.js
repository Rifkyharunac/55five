import { provider, coalesce } from '../server/provider.js';
import { createHandler } from '../server/handler.js';

export default createHandler(coalesce(provider.snapshot));
