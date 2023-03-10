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

async function withSchema(fn) {
	const seq = await initSequelize();
	await fn(seq);
	const mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.updateSchema();
	return seq;
}

async function updateSchemaTo(fn) {
	await withSchema(fn).then(x => x.close());
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
});


test('can sync a new field on a model', async () => {
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
	await updateSchemaTo(async seq => {
		const Z = seq.define('Z', {name: {type: DataTypes.TEXT}}, {paranoid: true});
		const D = seq.define("D", {addr: {type: DataTypes.TEXT}}, {paranoid: true});
		const P = seq.define("P", {number: {type: DataTypes.INTEGER}}, {paranoid: true});
		Z.hasMany(D, {foreignKey: 'z_id'});
		P.hasMany(Z, {foreignKey: 'p_id'});
	});
	await updateSchemaTo(async seq => {
		const D = seq.define("D", {addr: {type: DataTypes.TEXT}}, {paranoid: true});
	});
});

test('can add a foreign key relationship', async () => {
	await updateSchemaTo(async seq => {
		const Z = seq.define('Z', {name: {type: DataTypes.TEXT}}, {paranoid: true});
		const D = seq.define("D", {addr: {type: DataTypes.TEXT}}, {paranoid: true});
	});
	await updateSchemaTo(async seq => {
		const Z = seq.define('Z', {name: {type: DataTypes.TEXT}}, {paranoid: true});
		const D = seq.define("D", {addr: {type: DataTypes.TEXT}}, {paranoid: true});
		Z.hasMany(D, {foreignKey: 'z_id'});
	});
});

test('can handle custom primary keys', async () => {
	await updateSchemaTo(async seq => {
		const User = seq.define('User', {user_id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true}});
	});
});

test('can sync a new field on a model', async () => {
	await updateSchemaTo(async seq => {
		const U = seq.define('U', {name: {type: DataTypes.TEXT, allowNull: false}}, {paranoid: true});
	});

	await updateSchemaTo(async seq => {
		const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	});

	await updateSchemaTo(async seq => {
		const U = seq.define('U', {name: {type: DataTypes.TEXT, allowNull: true}}, {paranoid: true});
	});
});

test('can handle renaming primary keys', async () => {
	const ID_VALUE = 420;
	const seq = await withSchema(async seq => {
		const User = seq.define('User', {user_id: {type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true}});
	});

	await seq.models.User.create({user_id: ID_VALUE});
	await seq.close();
	
	const seq2 = await withSchema(async seq => {
		const User = seq.define('User', {}); // use the default, built-in primary key
	});

	let up = seq2.models.User.findOne({where: {id: ID_VALUE}})
	await expect(up).resolves.not.toThrowError();
	let user = await up;
	expect(user.id).toEqual(ID_VALUE);
	await seq2.close();
});

test('can create TSVector columns', async () => {
	await updateSchemaTo(async seq => {
		const Foo = seq.define('Foo', {asdf: DataTypes.TSVECTOR});
	});
});
