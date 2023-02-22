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

function moldyMeatSanitizeAttributes(atts) {
	let attributes = {};

	for (const [dbName, {Model, prototype, type: _type, ..._options}] of Object.entries(atts)) {
		let type = {name: _type.key};
		for (const [k, v] of Object.entries(_type)) {
			if (v !== undefined) { // the JSON roundtrip kills these atts
				type[k] = v;
			}
		}	
	
		let options = {};
		for (const [k, v] of Object.entries(_options)) {
			options[k] = v;
		}

		attributes[dbName] = options;
	}
	
	return attributes;
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

	let ops = [];

	for (const [tableName, v] of Object.entries(changes['added'])) {
		// TODO: figure out better
		const isCreate = Object.keys(v).includes('id');
		if (isCreate) {
			console.log(`Create Table ${tableName}`, v);
			// TODO: generate CreateStatement SQL using all cols from v
		} else {
			for (const [fieldName, options] of Object.entries(v)) {
				console.log(`Add Column ${tableName}(${fieldName})`, options);
				// TODO: generate add column statement
			}
		}
	}

	for (const [tableName, v] of Object.entries(changes['updated'])) {
		for (const [fieldName, options] of Object.entries(v)) {
			console.log("Alter column ${tableName}(${fieldName})", options);
			// TODO: generate alter table statement
		}
	}

	for (const [tableName, v] of Object.entries(changes['deleted'])) {
		const isDrop = !Object.keys(models).includes(tableName); //Object.keys(v).includes('id');
		if (isDrop) {
			console.log(`Drop table ${tableName}`);
			// TODO: generate dropTable
		} else {
			for (const [fieldName, options] of Object.entries(v)) {
				console.log(`Drop column ${tableName}(${fieldName})`, options);
				// TODO: generate drop column statement
			}
		}
	}

	const qi = sequelize.getQueryInterface();
	for (const [op, args] in ops) {
		qi[op](...args);
	}
}

const U = sequelize.define('U', {name: DataTypes.STRING}, {tableName: 'u', paranoid: true});
const A = sequelize.define("A", {addr: DataTypes.STRING}, {tableName: "a", paranoid: true});

A.hasMany(U, {foreignKey: 'a_id'});

await migrate(sequelize);

const A2 = sequelize.define("A", {addr: DataTypes.STRING, zip: DataTypes.STRING}, {tableName: "a", paranoid: true});

await migrate(sequelize);
await migrate(sequelize);
