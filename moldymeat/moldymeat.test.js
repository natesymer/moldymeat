const { Sequelize, DataTypes } = require('sequelize');
const MoldyMeat = require('./moldymeat');

const dbSettings = {
	database: 'testme12347',
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
	await client.end();

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


beforeEach(async () => {
	console.log("Clearing database...");
	const s = await initSequelize();
	await s.drop();
	return s.close();
});

test('can sync empty database with models', async () => {
	const seq = await initSequelize();
	const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	const A = seq.define("A", {addr: {type: DataTypes.TEXT}}, {paranoid: true});

	A.hasMany(U, {foreignKey: 'a_id'});

	const mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.updateSchema();
	await seq.close();
});

test('can sync existing database with model changes', async () => {
	/* First time moldymeat is ran against models */
	const seq = await initSequelize();
	let U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	let A = seq.define("A", {addr: {type: DataTypes.TEXT}}, {paranoid: true});
	A.hasMany(U, {foreignKey: 'a_id'});

	let mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.updateSchema();
	await seq.close();

	/* run moldymeat again against the same models */
	const seq2 = await initSequelize();
	U = seq2.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	A = seq2.define("A", {addr: {type: DataTypes.TEXT}, zip: {type: DataTypes.TEXT}}, {paranoid: true});
	A.hasMany(U, {foreignKey: 'a_id'});

	mm = new MoldyMeat({sequelize: seq2});
	await mm.initialize();
	await mm.updateSchema();
	await seq2.close();
});

