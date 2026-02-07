import '../../../shared/js/gametypes.js';

const Types = globalThis.Types || null;

if (!Types) {
    throw Error('Types global is not available. Ensure shared/js/gametypes.js is loaded before ESM bootstrap.');
}

export default Types;
