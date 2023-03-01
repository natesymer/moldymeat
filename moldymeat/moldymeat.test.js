const { Sequelize, DataTypes } = require('sequelize');
const MoldyMeat = require('./moldymeat');
const { Client } = require("pg");

const dbSettings = {
	database: 'testme1234iiii8',
	username: 'postgres',
	password: 'password',
	host: 'localhost',
}

async function ensureDb(dropDb = false) {
	const client = new Client({
		user: dbSettings.username,
		password: dbSettings.password,
		host: dbSettings.host
	});
	await client.connect();

	try {
		if (dropDb) {
			console.log("Clearing database...");
			await client.query(`DROP DATABASE IF EXISTS "${dbSettings.database}";`);
		}
		console.log("Creating database...");
		await client.query(`CREATE DATABASE "${dbSettings.database}";`);
	} catch (err) {};
	await client.end();
}

async function initSequelize() {
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

async function updateSchemaTo(fn) {
	const seq = await initSequelize();
	await fn(seq);
	const mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.updateSchema();
	await seq.close();
}

beforeEach(async () => {
	return await ensureDb(true);
});

test('can sync empty database with models', async () => {
	await updateSchemaTo(async seq => {
		const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
		const A = seq.define("A", {addr: {type: DataTypes.TEXT}}, {paranoid: true});

		A.hasMany(U, {foreignKey: 'a_id'});
	});
	expect(1).toEqual(1);
});


test('can sync existing database with model changes', async () => {
	await updateSchemaTo(async seq => {
		const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
		const A = seq.define("A", {addr: {type: DataTypes.TEXT}}, {paranoid: true});

		A.hasMany(U, {foreignKey: 'a_id'});
	});

	await updateSchemaTo(async seq => {
		const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
		const A = seq.define("A", {addr: {type: DataTypes.TEXT}, zip: {type: DataTypes.TEXT}}, {paranoid: true});

		A.hasMany(U, {foreignKey: 'a_id'});
	});
});


test('can drop many tables that have foreign key dependencies on eachother', async () => {
	const seq = await initSequelize();
	let Z = seq.define('Z', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	let D = seq.define("D", {addr: {type: DataTypes.TEXT}}, {paranoid: true});
	let P = seq.define("P", {number: {type: DataTypes.INTEGER}}, {paranoid: true});
	Z.hasMany(D, {foreignKey: 'z_id'});
	P.hasMany(Z, {foreignKey: 'p_id'});

	let mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.updateSchema();
	await seq.close();

	const seq2 = await initSequelize();
	D = seq2.define("D", {addr: {type: DataTypes.TEXT}}, {paranoid: true});

	mm = new MoldyMeat({sequelize: seq2});
	await mm.initialize();
	await mm.updateSchema();
	await seq2.close();
});

