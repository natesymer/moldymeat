const { Sequelize, DataTypes } = require('sequelize');
const { diff, addedDiff, deletedDiff, updatedDiff, detailedDiff } = require('deep-object-diff'); 

const dbSettings = {
	database: 'testme12346',
	username: 'postgres',
	password: 'password',
	host: 'localhost',
}

async function initSequelize() {
	// first, connect to postgres manually.
	const { Client } = require("pg");

	const client = new Client({
		user: dbSettings.username,
		password: dbSettings.password,
		host: dbSettings.host
	});
	await client.connect();

	// then, create the database specified in dbSettings.
	// if it fails, we're assuming it failed because the
	// database already exists.
	try {
		await client.query(`CREATE DATABASE "${dbSettings.database}";`);
	} catch (err) {};

	let s = new Sequelize({
		...dbSettings,
		dialect: 'postgres'
	});

	try {
		await s.authenticate();
	} catch (error) {
		console.log("Unable to connect to the database: ");
		console.log(error.message);
		process.exit(1);
	}

	return s;
}
(async function() {
const sequelize = await initSequelize();

const MigrationState = sequelize.define("MigrationState", {
	json: DataTypes.TEXT
});

await MigrationState.sync({force: true});

async function loadMigrationState(sequelize) {
	const rs = await MigrationState.findAll({limit: 1, order: [['createdAt', 'DESC']]});
	if (rs.length > 0) {
		return JSON.parse(rs[0].json);
	}
	return {};
}

async function saveMigrationState(sequelize, state) {
	await MigrationState.create({json: JSON.stringify(state)});
}

/* Removes any undefined properties on obj. deep. */
function removeUndefined(obj) {
	for (let k in obj) {
		if (obj[k] === undefined) delete obj[k];
		else if (typeof obj[k] === 'object') removeUndefined(obj[k]);
	}
}

/* prepares attributes for serialization and storage in a MigrationState */
function moldyMeatSanitizeAttributes(atts) {
	let attributes = {};

	for (const [k, v] of Object.entries(atts)) {
		attributes[k] = moldyMeatFlattenAttribute(v);
	}

	removeUndefined(attributes); // JSON roundtrip kills undefined atts
	return attributes;
}

/* turns an attribute into something that can be JSON serialized and stored */
function moldyMeatFlattenAttribute(att) {
	// If we're working with a short def: (e.g. {column: DataTypes.INTEGER})
	if (Object.values(DataTypes).includes(att)) return att.key;

	// Otherwise, we have something like {column: {type: DataTypes.INTEGER, ...}}
	const {Model, prototype, type: _type, ..._options} = att;
	let type = {typekey: _type.key};
	for (const [k, v] of Object.entries(_type)) {
		type[k] = v;
	}	

	return {type, ..._options};
}

/* restores an attribute from its serialized form to the correct form */
function moldyMeatHydrateAttribute(_att) {
	// e.g. {column: DataTypes.INTEGER})
	if (typeof _att === 'string') return DataTypes[_att];

	// e.g. {column: {type: DataTypes.INTEGER, ...}}
	const {type: _type, ...att} = _att;
	const {typekey, ...type} = _type;
 
	return {
		type: {...DataTypes[typekey], ...type},
		...att
	};
}

async function migrate(sequelize) {
	const migState = await loadMigrationState(sequelize);
	
	const _models = sequelize.models;
	const models = {};
	const stateTableName = MigrationState.getTableName();
	for (const [k, v] of Object.entries(_models)) {
		const tableName = v.getTableName();
		if (tableName === stateTableName) continue;
		models[tableName] = moldyMeatSanitizeAttributes(v.getAttributes());
	}

	const changes = detailedDiff(migState, models);
	await saveMigrationState(sequelize, models);

	const qi = sequelize.getQueryInterface();

	// TODO: Figure out ordering

	for (const [tableName, v] of Object.entries(changes['added'])) {
		// TODO: figure out better isCreate test
		const isCreate = Object.keys(v).includes('id');
		if (isCreate) {
			let atts = {};
			for (const [k, att] of Object.entries(v)) {
				atts[k] = moldyMeatHydrateAttribute(att);
			}
			console.log(`Create Table ${tableName}`, atts);
			qi.createTable(tableName, atts);
		} else {
			for (const [fieldName, _att] of Object.entries(v)) {
				const att = moldyMeatHydrateAttribute(_att);
				console.log(`Add Column ${tableName}(${fieldName})`, att);
				qi.addColumn(tableName, fieldName, att);
			}
		}
	}

	for (const [tableName, v] of Object.entries(changes['updated'])) {
		for (const [fieldName, _att] of Object.entries(v)) {
			const att = moldyMeatHydrateAttribute(_att);
			console.log("Alter column ${tableName}(${fieldName})", att);
			qi.changeColumn(tableName, fieldName, att);
		}
	}

	for (const [tableName, v] of Object.entries(changes['deleted'])) {
		const isDrop = !Object.keys(models).includes(tableName); //Object.keys(v).includes('id');
		if (isDrop) {
			console.log(`Drop table ${tableName}`);
			qi.dropTable(tableName);
		} else {
			for (const [fieldName, options] of Object.entries(v)) {
				console.log(`Drop column ${tableName}(${fieldName})`);
				qi.removeColumn(tableName, fieldName);
			}
		}
	}
}

async function one() {
	const seq = await initSequelize();
	const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	const A = seq.define("A", {addr: {type: DataTypes.TEXT}}, {paranoid: true});

	A.hasMany(U, {foreignKey: 'a_id'});

	await migrate(seq);
}

async function two() {
	const seq = await initSequelize();
	const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	const A = seq.define("A", {addr: {type: DataTypes.TEXT}, zip: {type: DataTypes.TEXT}}, {paranoid: true});

	A.hasMany(U, {foreignKey: 'a_id'});

	await migrate(seq);
}

await one();
await two();

//await migrate(sequelize);
})();
