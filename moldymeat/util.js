/**
 * @module util
 */

/**
	Deeply removes any `undefined` properties on obj, mutating obj.
	@param {object} obj The object to remove `undefined`s from.
	@returns {object} Returns obj after mutations, for convenience's sake.
	@since 0.0.1
*/
export function removeUndefined(obj) {
	for (const k in obj) {
		if (obj[k] === undefined) delete obj[k];
		else if (typeof obj[k] === 'object') removeUndefined(obj[k]);
	}
	return obj;
}

/**
	Maps the function fn over obj's entries, returning an object.
	@param {object} obj Any object
	@param {function} fn Takes an entry, returns an entry
	@returns {object} An object built from mapping fn over obj's entries.
	@since 0.0.1
*/
export function objectMap(obj, fn) {
	return Object.fromEntries(Object.entries(obj).map(fn));
}

