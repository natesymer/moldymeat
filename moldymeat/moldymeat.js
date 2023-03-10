const { Sequelize, DataTypes } = require('sequelize');

const diff = require('./diff');
const { removeUndefined, objectMap } = require('./util');

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
	 */
	constructor({sequelize} = {}) {
		this.sequelize = sequelize;
		this.isInitialized = false;
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
	 * @async
	 */
	async updateSchema(forward=true) {
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

		const {added, updated, deleted} = forward ? diff(migState, models) : diff(models, migState);

		if (Object.keys(added).length === 0 && Object.keys(updated).length === 0 && Object.keys(deleted).length === 0) {
			return false;
		}

		/* build database commands to implement the change */

		const createTables = [];
		const dropTables = [];
		const addColumns = [];
		const changeColumns = [];
		const removeColumns = [];
		const renameColumns = [];
		const renameSerialSequences = [];

		// Rewrite drop/add of primary key fields to updates
		for (const [tableName, v] of Object.entries(deleted)) {
			const isDropTable = !Object.keys(models).includes(tableName);
			if (isDropTable) continue;

//			const model = Object.values(this.sequelize.models).find(x => x.getTableName() === tableName);
			const fieldsToDelete = Object.keys(v);
			for (const deleteFieldName of fieldsToDelete) {
				const deleteField = this._hydrateAttribute(migState[tableName][deleteFieldName]);
				if (deleteField.primaryKey) {
					for (const addFieldName of Object.keys(added[tableName])) {
						const isAddColumn = !Object.keys(migState[tableName]).includes(addFieldName);
						if (!isAddColumn) continue;

						const addField = this._hydrateAttribute(models[tableName][addFieldName]);//this._hydrateAttribute(added[tableName][addFieldName]);
						if (addField.primaryKey) {
							const newField = {
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
							
							if (deleteField.type.key === addField.type.key) {
								renameColumns.push({tableName, deleteFieldName, addFieldName, addField: newField});
								delete deleted[tableName][deleteFieldName];
								delete added[tableName][addFieldName];
								break;
							}
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

// monkey patch sequelize because it uses serial 
qi.queryGenerator.changeColumnQuery = function(tableName, attributes) {
    const query = subQuery => `ALTER TABLE ${this.quoteTable(tableName)} ALTER COLUMN ${subQuery};`;
    const sql = [];
    for (const attributeName in attributes) {
      let definition = this.dataTypeMapping(tableName, attributeName, attributes[attributeName]);
      let attrSql = '';

	// START: expand SERIAL back into its real definition.
      if (definition.includes('SERIAL')) {
		if (definition.includes('BIGSERIAL')) {
			definition = definition.replace('BIGSERIAL', 'BIGINT');
		} else if (definition.includes('SMALLSERIAL')) {
			definition = definition.replace("SMALLSERIAL", 'SMALLINT');
		} else {
			definition = definition.replace('SERIAL', 'INTEGER');
		}
		definition += ` DEFAULT nextval(format('%I', '${tableName}_${attributeName}_seq'))`;
		if (attributes[attributeName].includes('NOT NULL')) {
			definition += ' NOT NULL';
		}
      }
	// END: expand SERIAL back into its real definition

      if (definition.includes('NOT NULL')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} SET NOT NULL`);

        definition = definition.replace('NOT NULL', '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP NOT NULL`);
      }

      if (definition.includes('DEFAULT')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} SET DEFAULT ${definition.match(/DEFAULT ([^;]+)/)[1]}`);

        definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP DEFAULT`);
      }

      if (attributes[attributeName].startsWith('ENUM(')) {
        attrSql += this.pgEnum(tableName, attributeName, attributes[attributeName]);
        definition = definition.replace(/^ENUM\(.+\)/, this.pgEnumName(tableName, attributeName, { schema: false }));
        definition += ` USING (${this.quoteIdentifier(attributeName)}::${this.pgEnumName(tableName, attributeName)})`;
      }

      if (/UNIQUE;*$/.test(definition)) {
        definition = definition.replace(/UNIQUE;*$/, '');
        attrSql += query(`ADD UNIQUE (${this.quoteIdentifier(attributeName)})`).replace('ALTER COLUMN', '');
      }

      if (definition.includes('REFERENCES')) {
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        attrSql += query(`ADD FOREIGN KEY (${this.quoteIdentifier(attributeName)}) ${definition}`).replace('ALTER COLUMN', '');
      } else {
        attrSql += query(`${this.quoteIdentifier(attributeName)} TYPE ${definition}`);
      }

      sql.push(attrSql);
    }

    return sql.join('');
  }
		const t = await this.sequelize.transaction();

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
				console.log("INTERMEDIATES", query, def, '\n\n', sql);

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
