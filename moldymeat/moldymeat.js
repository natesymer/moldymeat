const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs/promises');
const {exists} = require('fs');

const patchPostgresQueryGenerator = require('./patchPostgresQueryGenerator');
const hintsfileSchema = require('./hintsfileSchema');
const diff = require('./diff');
const { removeUndefined, objectMap, boolPrompt } = require('./util');

/**
 * TODO:
 * - hints
 * - Indeces (https://sequelize.org/api/v6/class/src/model.js~model#static-method-init)
 */

/**
 * The main moldymeat class.
 * @property {Sequelize} sequelize The underlying Sequelize instance.
 * @property {Sequelize.Model} stateModel The model for schema updates
 */
class MoldyMeat {
	/**
	 * Create a MoldyMeat instance.
	 * @param {object} options
	 * @param {Sequelize} options.sequelize The sequelize instance to use.
	 * @param {string} options.hintsFile The file path to the hints file
	 */
	constructor({sequelize, hintsFile="database_hints.json"} = {}) {
		this.sequelize = sequelize;
		this.isInitialized = false;
		this.hintsFile = hintsFile;
	}

	/**
	 * Initializes MoldyMeat. Must be called before calling other methods.
	 * @async
	 * @returns {MoldyMeat} Returns a reference to this for convenience
	 */
	async initialize() {
		if (!this.sequelize) {
			// TODO: throw error
		}

		this.stateModel = this.sequelize.define("MoldyMeatState", {
			json: DataTypes.TEXT
		});

		await this.stateModel.sync(); // yes...
		this.isInitialized = true;
		return this;
	}

	async _loadHints(since = null) {
		if (exists(this.hintsFile)) {
			const hintsJson = await fs.readFile(this.hintsFile);
			let hs = await hintsfileSchema.validate(JSON.parse(hintsJson));
			if (since) return hs.filter(x => (x.createdAt - since) > 0);
			// TODO: sort it by createdAt
			return hs;
		}
		return [];
	}

	async _saveHints(_hs, _d = null) {
		let createdAt = _d ?? new Date();
		let priors = await this._loadHints();
		let hs = [...priors, ..._hs.map(x => ({...x, createdAt}))];
		await fs.writeFile(this.hintsFile, JSON.stringify(hs));
	}

	/**
	 * Ensures the class is initialized (i.e. you called MoldyMeat#initialize())
	 * @private
	 */
	_ensureInitialized() {
		if (!this.isInitialized) {
			// TODO: Throw error
		}

	}

	/**
	 * Loads the most recent schema state at the last time the database was updated.
	 * @returns {object} Schema state
	 * @async
	 * @private
	 */
	async loadSchemaState() {
		this._ensureInitialized();
		const rs = await this.stateModel.findAll({limit: 1, order: [['createdAt', 'DESC']]});
		if (rs.length > 0) {
			return JSON.parse(rs[0].json);
		}
		return {};
	}

	/**
	 * Saves a schema state.
	 * @param {object} state The schema state to save
	 * @async
	 * @private
	 */
	async saveSchemaState(state, transaction=null) {
		this._ensureInitialized();
		await this.stateModel.create({json: JSON.stringify(state)}, transaction ? {transaction} : {});
	}

	/**
	 * Updates the schema of the database (to which sequelize is connected) to match the
	 * models in `this.sequelize.models`
	 * @param {object} options
	 * @param {bool} options.forward Runs the DB updates forward if true, backwards one update if false
	 * @param {bool} options.generateHints Generates hints if true. Note: Requires an interactive shell if true
	 * @param {bool} options.useHints Whether or not to use hints.
	 * @async
	 */
	async updateSchema({forward=true, generateHints=false, useHints=true} = {}) {
		this._ensureInitialized();
		const migState = await this.loadSchemaState();

		// Load the models sorted by dependency, so that we can create tables without
		// causing postgres to error at us
		// topoModels = [mostDependedUponModel, ..., least depended upon model]	
		const topoModels = this.sequelize.modelManager.getModelsTopoSortedByForeignKey();
		if (!topoModels) {
			throw new Error("Your models have a circular association.");
		}

		// Load the models into `models`: postgres table name => "flattened" sequelize model definition
		const models = {};
		const stateTableName = this.stateModel.getTableName();
		for (const v of topoModels) {
			const tableName = v.getTableName();
			if (tableName === stateTableName) continue;
			models[tableName] = objectMap(v.getAttributes(), ([k, v]) => [k, this._flattenAttribute(v)]);
		}

		removeUndefined(models); // because JSON.stringify errors on undefined

		// Run the diff
		const {added, updated, deleted} = forward ? diff(migState, models) : diff(models, migState);

		if (Object.keys(added).length === 0 && Object.keys(updated).length === 0 && Object.keys(deleted).length === 0) {
			return false;
		}

		// Filter out hints that were already applied
		const hints = useHints ? await this._loadHints(migState.createdAt) : [];

		const hintedRenames = {}; // {table name => { old field name => new field name }}
		for (const {type, body} of hints) {
			if (type === 'renameColumn') {
				const {toField, fromField, table} = body;
				const t = forward ? toField : fromField;
				const f = forward ? fromField : toField;
				hintedRenames[table] = hintedRenames[table] ?? {};
				hintedRenames[table][f] = t;
			}
		}

		/* build database commands to implement the change */

		const createTables = [];
		const dropTables = [];
		const addColumns = [];
		const changeColumns = [];
		const removeColumns = [];
		const renameColumns = [];
		const renameSerialSequences = [];

		const newHints = [];

		// Rewrite drop/add of primary key fields to updates
		// based on primary key status, hints, and developer input
		for (const [tableName, v] of Object.entries(deleted)) {
			const isDropTable = !Object.keys(models).includes(tableName);
			if (isDropTable) continue;

			const tableHintedRenames = hintedRenames[tableName];

			// Look for primary key renames
			for (const deleteFieldName of Object.keys(v)) {
				if (deleteFieldName in hintedRenames[tableName]) {
					const renamedTo = hintedRenames[tableName][deleteFieldName];
					if (renamedTo in added[tableName]) {
						const newField = this._hydrateAttribute(models[tableName][renamedTo]);
						renameColumns.push({tableName, deleteFieldName, addFieldName: renamedTo, addField: newField});
						delete deleted[tableName][deleteFieldName];
						delete added[tableName][renamedTo];
						continue;
					}
				}

				const deleteField = this._hydrateAttribute(migState[tableName][deleteFieldName]);

				for (const addFieldName of Object.keys(added[tableName])) {
					const isAddColumn = !Object.keys(migState[tableName]).includes(addFieldName);
					if (!isAddColumn) continue;

					let addField = this._hydrateAttribute(models[tableName][addFieldName]);

					const isSameType = deleteField.type.key === addField.type.key;
					const arePKs = deleteField.primaryKey && addField.primaryKey;

					if (isSameType) {
						let shouldRename = false;
						if (arePKs) {
							// automatically rename
							addField = {
								// satisfy postgres constraints
								// https://www.postgresql.org/docs/13/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS
								primaryKey: true,
								allowNull: false,
								unique: true,
				
								// autoIncrement breaks this
								autoIncrement: addField.autoIncrement,	
								field: addField.field,
								fieldName: addField.fieldName,
								type: addField.type
							};
							shouldRename = true;
						} else {
							shouldRename = boolPrompt(`Did you rename ${tableName}(${deleteFieldName}) to ${tableName}(${addFieldName})?`);
							if (shouldRename) {
								newHints.push({
									type: 'renameColumn',
									body: {
										fromField: deleteFieldName,
										toField: addFieldName,
										table: tableName
									}
								});
							}
						}

						if (shouldRename) {
							renameColumns.push({tableName, deleteFieldName, addFieldName, addField});
							delete deleted[tableName][deleteFieldName];
							delete added[tableName][addFieldName];
							break;
						}
					}
				}
			}
		}

		for (const [tableName, v] of Object.entries(added)) {
			const isCreate = !Object.keys(migState).includes(tableName);
			if (isCreate) {
				const atts = objectMap(v, ([fieldName, att]) => [fieldName, this._hydrateAttribute(att)]);
				createTables.push([tableName, atts]);
			} else {
				for (const [fieldName, _att] of Object.entries(v)) {
					const isAddColumn = !Object.keys(migState[tableName]).includes(fieldName);
					const att = this._hydrateAttribute(models[tableName][fieldName]);
					if (isAddColumn) {
						addColumns.push([tableName, fieldName, att]);
					} else {
						changeColumns.push([tableName, fieldName, att]);
					}
				}
			}
		}

		for (const [tableName, v] of Object.entries(updated)) {
			for (const [fieldName, _att] of Object.entries(v)) {
				const att = this._hydrateAttribute(models[tableName][fieldName]);//_att);
				changeColumns.push([tableName, fieldName, att]);
			}
		}

		for (const [tableName, v] of Object.entries(deleted)) {
			const isDropTable = !Object.keys(models).includes(tableName);
			if (isDropTable) {
				dropTables.push(tableName);
			} else {
				for (const [fieldName, att] of Object.entries(v)) {
					if (att === undefined) {
						removeColumns.push([tableName, fieldName]);
					} else {
						let currentAtt = this._hydrateAttribute(migState[tableName][fieldName]);
						let newAtt = removeUndefined({...currentAtt, ...att});
						changeColumns.push([tableName, fieldName, newAtt]);
					}
				}
			}
		}

		let topoTables = topoModels.map(x => x.getTableName());
		topoTables.reverse();
		createTables.sort((a, b) => topoTables.indexOf(a[0]) - topoTables.indexOf(b[0]));
		dropTables.sort((a, b) => topoTables.indexOf(a) - topoTables.indexOf(b));

		const qi = this.sequelize.getQueryInterface();

		if (this.sequelize.getDialect() === 'postgres') {
			// Fixes some postgres-dialect specific bugs
			patchPostgresQueryGenerator(qi.queryGenerator);
		}

		const t = await this.sequelize.transaction();

		let hintDate = new Date();

		try {
			for (const [tableName, fieldName] of removeColumns) {
				console.log(`Drop column ${tableName}(${fieldName})`);
				await qi.removeColumn(tableName, fieldName, {transaction: t});
			}

			for (const tableName of dropTables) {
				console.log(`Drop table ${tableName}`);
				await qi.dropTable(tableName, {transaction: t});
			}

			for (const [tableName, atts] of createTables) {
				console.log(`Create Table ${tableName}`, atts);
				await qi.createTable(tableName, atts, {transaction: t});
			}

			for (const {tableName, deleteFieldName, addFieldName, addField} of renameColumns) {
				console.log(`Rename Column ${tableName}(${deleteFieldName}) to ${tableName}(${addFieldName})`, addField);
				await qi.renameColumn(tableName, deleteFieldName, addFieldName, {transaction: t});
				if (addField.autoIncrement) { // TODO: check to make sure the type is also an integer
					const oldName = `"${tableName}_${deleteFieldName}_seq"`;
					const newName = `"${tableName}_${addFieldName}_seq"`;
					await this.sequelize.query(`ALTER SEQUENCE IF EXISTS ${oldName} RENAME TO ${newName};`, {transaction: t});
					await this.sequelize.query(`CREATE SEQUENCE IF NOT EXISTS ${newName} AS integer;`, {transaction: t});
					await this.sequelize.query(`ALTER SEQUENCE IF EXISTS ${newName} OWNED BY "${tableName}"."${addFieldName}";`, {transaction: t});
				}

				const query = qi.queryGenerator.attributesToSQL({
					[addFieldName]: qi.normalizeAttribute(addField)
				}, {context: "changeColumn", table: tableName});
				const def = qi.queryGenerator.dataTypeMapping(tableName, addFieldName, query[addFieldName]);
				const sql = qi.queryGenerator.changeColumnQuery(tableName, query);
//				console.log("INTERMEDIATES", query, def, '\n\n', sql);

				await qi.changeColumn(tableName, addFieldName, addField, {transaction: t});
			}

			for (const [tableName, fieldName, att] of addColumns) {
				console.log(`Add Column ${tableName}(${fieldName})`, att);
				await qi.addColumn(tableName, fieldName, att, {transaction: t});
			}

			for (const [tableName, fieldName, att] of changeColumns) {
				console.log(`Alter column ${tableName}(${fieldName})`, att);
				await qi.changeColumn(tableName, fieldName, att, {transaction: t});
			}

			await this.saveSchemaState(models, t);
			t.commit();
		} catch (e) {
			t.rollback();
			console.log(e);
			throw e;
		}

		await this._saveHints(newHints, hintDate);
		
		return true;
	}

	async backwards() {
		this.updateSchema(false);
	}

	async forwards() {
		this.updateSchema(true);
	}

	/**
	 * turns an attribute into something that can be JSON serialized and stored
	 * @private
	 */
	_flattenAttribute(att) {
		// If we're working with a short def: (e.g. {column: DataTypes.INTEGER})
		if (Object.values(DataTypes).includes(att)) return att.key;

		// Otherwise, we have something like {column: {type: DataTypes.INTEGER, ...}}
		const {Model, prototype, type: _type, ..._options} = att;
		return {type: {typekey: _type.key, ..._type}, ..._options};
	}

	/**
	 * restores an attribute from its serialized form to the correct form
	 * @private
	 */
	_hydrateAttribute(_att) {
		// e.g. {column: DataTypes.INTEGER})
		if (typeof _att === 'string') return DataTypes[_att];

		// e.g. {column: {type: DataTypes.INTEGER, ...}}
		const {type: _type, ...att} = _att;
		const {typekey, ...type} = _type;

		//return {type: {...DataTypes[typekey], ...type}, ...att};

		let newType = DataTypes[typekey](type.options);
		return {type: newType, ...att};
	}
}

module.exports = MoldyMeat;
