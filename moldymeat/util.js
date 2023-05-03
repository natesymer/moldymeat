/**
 * @module util
 */

const readline = require('readline');

/**
 * Deeply removes any `undefined` properties on obj, mutating obj.
 * @param {object} obj The object to remove `undefined`s from.
 * @returns {object} Returns obj after mutations, for convenience's sake.
 * @since 0.0.1
*/
function removeUndefined(obj) {
	for (const k in obj) {
		if (obj[k] === undefined) delete obj[k];
		else if (typeof obj[k] === 'object') removeUndefined(obj[k]);
	}
	return obj;
}

/**
 * Maps the function fn over obj's entries, returning an object.
 * @param {object} obj Any object
 * @param {function} fn Takes an entry, returns an entry
 * @returns {object} An object built from mapping fn over obj's entries.
 * @since 0.0.1
 */
function objectMap(obj, fn) {
	return Object.fromEntries(Object.entries(obj).map(fn));
}

const TRUTHY = ["t", "true", "y", "yes", "1"];

/**
 * Prompts the user for a yes/no answer via CLI.
 * @param {string} q The prompt to use. 
 * @async
 */
function boolPrompt(q) {
	const qp = `${!q.endsWith('?') ? `${q}?` : q} (yes/no) `;
	return new Promise(async (resolve, reject) => {
		while (true) {
			let v = await (new Promise((_r, _rj) => {
				const i = readline.createInterface({input: process.stdin, output: process.stdout});
				i.question(qp, _v => {
					i.close();
					const v = _v.trim().toLowerCase();
					_r(v);
				});
			}));

			if (v.length !== 0) {
				console.log(q, v, TRUTHY);
				resolve(TRUTHY.includes(v));	
				break;
			}
		}
	});
}

module.exports = {removeUndefined, objectMap, boolPrompt};

