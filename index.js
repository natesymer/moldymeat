const CONNECTION_STRING = process.env.PG_CONNECTION_STRING ?? "";

const knex = require('knex')({
	client: 'pg',
	connection: CONNECTION_STRING,
	searchPath: ['knex', 'public'],
});

const MyModel = createModel('tablename', {

});

function createModel(tableName, columns) {
	
}


async function migrate(models) {
	
}

