const { Sequelize, DataTypes } = require('sequelize');

const diff = require('./diff');
const { removeUndefined, objectMap } = require('./util');

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
	 */
	constructor({sequelize} = {}) {
		this.sequelize = sequelize;
		this.isInitialized = false;
	}

	/**
	 * Initializes MoldyMeat. Must be called before calling other methods.
	 * @async
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
	async saveSchemaState(state) {
		this._ensureInitialized();
		await this.stateModel.create({json: JSON.stringify(state)});
	}

	/**
	 * Updates the schema of the database (to which sequelize is connected) to match the
	 * models in `this.sequelize.models`
	 * @async
	 */
	async updateSchema() {
		this._ensureInitialized();
		const migState = await this.loadSchemaState();
	
		const models = {};

		// topoModels = [mostDependedUponModel, ..., least depended upon model]	
		const topoModels = this.sequelize.modelManager.getModelsTopoSortedByForeignKey();	
		const stateTableName = this.stateModel.getTableName();
		for (const v of topoModels) {
			const tableName = v.getTableName();
			if (tableName === stateTableName) continue;
			models[tableName] = objectMap(v.getAttributes(), ([k, v]) => [k, this._flattenAttribute(v)]);
		}

		removeUndefined(models);

		const changes = diff(migState, models);
		await this.saveSchemaState(models);

		const qi = this.sequelize.getQueryInterface();

		const createTables = [];
		const dropTables = [];

		for (const [tableName, v] of Object.entries(changes['added'])) {
			// TODO: figure out better isCreate test
			const isCreate = Object.keys(v).includes('id');
			if (isCreate) {
				let atts = {};
				for (const [k, att] of Object.entries(v)) {
					atts[k] = this._hydrateAttribute(att);
				}
				createTables.push([tableName, atts]);
			} else {
				for (const [fieldName, _att] of Object.entries(v)) {
					const att = this._hydrateAttribute(_att);
					console.log(`Add Column ${tableName}(${fieldName})`, att);
					qi.addColumn(tableName, fieldName, att);
				}
			}
		}

		for (const [tableName, v] of Object.entries(changes['updated'])) {
			for (const [fieldName, _att] of Object.entries(v)) {
				const att = this._hydrateAttribute(_att);
				console.log(`Alter column ${tableName}(${fieldName})`, att);
				qi.changeColumn(tableName, fieldName, att);
			}
		}

		for (const [tableName, v] of Object.entries(changes['deleted'])) {
			const isDrop = !Object.keys(models).includes(tableName); //Object.keys(v).includes('id');
			if (isDrop) {
				dropTables.push(tableName);
			} else {
				for (const [fieldName, options] of Object.entries(v)) {
					console.log(`Drop column ${tableName}(${fieldName})`);
					qi.removeColumn(tableName, fieldName);
				}
			}
		}

		// TODO: sort createTables and dropTables

		console.log("BEFORE", createTables, dropTables);
		const topoTables = topoModels.map(x => x.getTableName());
		createTables.sort((a, b) => topoTables.indexOf(a[0]) - topoTables.indexOf(b[0]));
		dropTables.sort((a, b) => topoTables.indexOf(a) - topoTables.indexOf(b));
		console.log("AFTER", createTables, dropTables);
		for (const tableName of dropTables) {
			console.log(`Drop table ${tableName}`);
			qi.dropTable(tableName);
		}
		for (const [tableName, atts] of createTables) {
			console.log(`Create Table ${tableName}`, atts);
			qi.createTable(tableName, atts);
		}
	}

	async rollback(howMany) {
		this._ensureInitialized();
		// TODO: implement
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

		return {type: {...DataTypes[typekey], ...type}, ...att};
	}
}

module.exports = MoldyMeat;
