const { Sequelize, DataTypes } = require('sequelize');
const MoldyMeat = require('./moldymeat');

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
async function one() {
	const seq = await initSequelize();
	const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	const A = seq.define("A", {addr: {type: DataTypes.TEXT}}, {paranoid: true});

	A.hasMany(U, {foreignKey: 'a_id'});

	const mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.migrate();
}

async function two() {
	const seq = await initSequelize();
	const U = seq.define('U', {name: {type: DataTypes.TEXT}}, {paranoid: true});
	const A = seq.define("A", {addr: {type: DataTypes.TEXT}, zip: {type: DataTypes.TEXT}}, {paranoid: true});

	A.hasMany(U, {foreignKey: 'a_id'});

	const mm = new MoldyMeat({sequelize: seq});
	await mm.initialize();
	await mm.migrate();
}

await one();
await two();

})();
