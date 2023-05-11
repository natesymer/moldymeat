const { diff:_diff,
	addedDiff:_addedDiff,
	deletedDiff:_deletedDiff,
	updatedDiff:_updatedDiff,
	detailedDiff:_detailedDiff } = require('deep-object-diff');

/**
 * @typedef {object} Diff
 * @property {object} added
 * @property {object} deleted
 * @property {object} updated
 */

/**
 * Returns the difference between `lhs` and `rhs`.
 * @function diff
 * @param {object} lhs
 * @param {object} rhs
 * @returns {Diff} The difference between `lhs` and `rhs`. 
 */
function diff(lhs, rhs) {
	return _detailedDiff(lhs, rhs);
}

module.exports = diff;
