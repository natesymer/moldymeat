const yup = require('yup');

yup.addMethod(yup.MixedSchema, "contextualOneOf", function (key, schemasObj) {
	return this.test(
		"contextual-one-of",
		"${path} doesn't match the related schema",
		function (item) {
			const kv = this.options.parent[key];
			if (!(kv in schemasObj)) return false;
			return schemasObj[kv].isValidSync(item, {strict: true});
		}
	);
});

const bodies = {
	renameColumn: yup.object({
		fromField: yup.string().required(),
		toField: yup.string().required(),
		table: yup.string().required()
	})
};

const hint = yup.object({
	type: yup.string().oneOf(Object.keys(bodies)),
	createdAt: yup.date(),
	body: yup.mixed().contextualOneOf('type', bodies)
});

module.exports = yup.array().of(hint);
