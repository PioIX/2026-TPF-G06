//Sección MySQL del código
const mySql = require("mysql2/promise");

/**
 * Objeto con la configuración de la base de datos MySQL a utilizar.
 */
const SQL_CONFIGURATION_DATA =
{
	host: process.env.MYSQL_HOST,
	user: process.env.MYSQL_USERNAME,
	password: process.env.MYSQL_PASSWORD, 
	database: process.env.MYSQL_DB,	
	port: 3306,
	charset: 'utf8mb4'
}

/**
 * Realiza una query a la base de datos MySQL indicada en el archivo "mysql.js".
 * @param {String} queryString Query que se desea realizar. Puede llevar "?" como parámetros.
 * @param {Array} params Valores que reemplazan a cada "?" de la query (opcional).
 * @returns Respuesta de la base de datos. Suele ser un vector de objetos.
 */
exports.realizarQuery = async function (queryString, params = [])
{
	let returnObject;
	let connection;
	try
	{
		connection = await mySql.createConnection(SQL_CONFIGURATION_DATA);
		returnObject = await connection.execute(queryString, params);
	}
	catch(err)
	{
		console.log(err);
		throw err; // así los try/catch del servidor se enteran del error
	}
	finally
	{
		if(connection && connection.end) await connection.end();
	}
	return returnObject[0];
}