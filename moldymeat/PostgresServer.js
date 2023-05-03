const {Docker} = require('node-docker-api');
const waitPort = require('wait-port');

const CONTAINER_NAME = 'moldymeat-test-postgres';

class PostgresServer {
	constructor({password="postgres", username="postgres", database="postgres", port=5432} = {}) {
		this.container = null;
		this.password = password;
		this.username = username;
		this.database = database;
		this.port = port;
		this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
	}

	async _deleteExistingContainer() {
		let cs = await this.docker.container.list({all: true, filters: JSON.stringify({name: [CONTAINER_NAME]})});
		if (cs.length === 1) {
			console.log("Found existing container");
			const c = cs[0];
			await c.stop();
			await c.delete({force: true});
		}
	}

	async _createContainer() {
		await this._deleteExistingContainer();

		return await this.docker.container.create({
			name: CONTAINER_NAME,
			Image: 'postgres',
			Env: [
				`POSTGRES_PASSWORD=${this.password}`,
				`POSTGRES_USER=${this.username}`,
				`POSTGRES_DB=${this.database}`
			],
			ExposedPorts: {
				"5432/tcp": {}
			},
			HostConfig: {
				PortBindings: {
					"5432/tcp": [{HostPort: `${this.port}`}]
				}
			}
		});
	}

	async start() {
		this.container = await this._createContainer();
		/*let stream = await this.container.logs({
			follow: true,
			stdout: true,
			stderr: true
		});
		stream.on('data', console.log);
		stream.on('error', console.log);
*/
		await this.container.start();
		console.log("Started DB Server");
		await waitPort({host: '0.0.0.0', port: this.port});
		console.log("DB Server is up");
	}

	async shutdown() {
		if (this.container) {
			await this.container.stop();
			await this.container.delete({force: true});
			this.container = null;
			console.log("Shut down DB Server");
		}
	}
}

module.exports = PostgresServer;

